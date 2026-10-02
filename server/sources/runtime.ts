/**
 * P0 — Runtime مشترک منابع.
 *
 * یک پیاده‌سازی برای همه: کش دو‌لایه (حافظهٔ فرایندی + دیسک اختیاری)،
 * مهلت زمانی، retry با backoff، circuit breaker، و سلامت هر منبع.
 * قبلاً هر provider این‌ها را دست‌ساز و بدون tier داشت.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CircuitState, SourceHealth } from './types';

export interface RuntimeOptions {
  /** برای تست تزریق می‌شود */
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  /** مسیر کش سطح‌دوم روی دیسک؛ null = فقط حافظه */
  diskCacheDir?: string | null;
  /** آستانهٔ باز شدن مدار */
  failureThreshold?: number;
  /** مدت باز ماندن مدار (میلی‌ثانیه) */
  breakerCooldownMs?: number;
}

export interface CachedResult<T> {
  value: T;
  cache: 'MISS' | 'HIT' | 'STALE';
  latencyMs: number;
}

interface CacheEntry {
  value: unknown;
  storedAt: number;
  /** پنجرهٔ تازه */
  freshTtlMs: number;
  /** پنجرهٔ کهنه پس از پایان تازگی */
  staleTtlMs: number;
}

interface MutableHealth {
  state: CircuitState;
  requests: number;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  openedAt: number | null;
}

export class SourceRuntime {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly states = new Map<string, MutableHealth>();
  private readonly fetchImpl: typeof fetch;
  private readonly nowFn: () => number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly diskCacheDir: string | null;
  private readonly failureThreshold: number;
  private readonly breakerCooldownMs: number;

  constructor(options: RuntimeOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.nowFn = options.now ?? (() => Date.now());
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 400;
    this.diskCacheDir = options.diskCacheDir ?? null;
    this.failureThreshold = options.failureThreshold ?? 4;
    this.breakerCooldownMs = options.breakerCooldownMs ?? 60_000;
  }

  now(): number {
    return this.nowFn();
  }

  private stateFor(sourceId: string): MutableHealth {
    const existing = this.states.get(sourceId);
    if (existing) return existing;
    const fresh: MutableHealth = {
      state: 'closed',
      requests: 0,
      successes: 0,
      failures: 0,
      consecutiveFailures: 0,
      lastLatencyMs: null,
      lastSuccessAt: null,
      lastError: null,
      openedAt: null,
    };
    this.states.set(sourceId, fresh);
    return fresh;
  }

  /** آیا مدار باز است؟ (و اگر مهلت گذشته، نیم‌باز می‌شود) */
  private circuitAllows(sourceId: string): boolean {
    const state = this.stateFor(sourceId);
    if (state.state === 'open') {
      const openedAt = state.openedAt ?? 0;
      if (this.nowFn() - openedAt >= this.breakerCooldownMs) {
        state.state = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }

  private recordSuccess(sourceId: string, latencyMs: number): void {
    const state = this.stateFor(sourceId);
    state.requests += 1;
    state.successes += 1;
    state.consecutiveFailures = 0;
    state.lastLatencyMs = latencyMs;
    state.lastSuccessAt = new Date(this.nowFn()).toISOString();
    state.lastError = null;
    state.state = 'closed';
    state.openedAt = null;
  }

  private recordFailure(sourceId: string, message: string, latencyMs: number): void {
    const state = this.stateFor(sourceId);
    state.requests += 1;
    state.failures += 1;
    state.consecutiveFailures += 1;
    state.lastLatencyMs = latencyMs;
    state.lastError = message;
    if (state.consecutiveFailures >= this.failureThreshold) {
      state.state = 'open';
      state.openedAt = this.nowFn();
    }
  }

  /** ثبت fallback به‌عنوان «موفق اما نه زنده» */
  recordFallback(sourceId: string, reason: string): void {
    const state = this.stateFor(sourceId);
    state.lastError = reason;
  }

  health(sourceId: string): SourceHealth {
    const state = this.stateFor(sourceId);
    return { sourceId, ...state };
  }

  listHealth(): SourceHealth[] {
    return Array.from(this.states.keys()).map(id => this.health(id));
  }

  /** کش دو‌لایه با ttl تازه/کهنه */
  async cached<T>(
    sourceId: string,
    key: string,
    ttlMs: number,
    staleTtlMs: number,
    loader: () => Promise<T>,
  ): Promise<CachedResult<T>> {
    const cacheKey = `${sourceId}::${key}`;
    const started = this.nowFn();
    const age = (entry: CacheEntry) => started - entry.storedAt;
    const memory = this.cache.get(cacheKey);
    if (memory && age(memory) <= memory.freshTtlMs) {
      return { value: memory.value as T, cache: 'HIT', latencyMs: this.nowFn() - started };
    }

    let staleValue: T | undefined;
    if (memory && age(memory) <= memory.freshTtlMs + memory.staleTtlMs) staleValue = memory.value as T;
    if (staleValue === undefined && this.diskCacheDir) {
      const disk = this.readDisk(cacheKey, ttlMs + staleTtlMs);
      if (disk !== undefined) staleValue = disk as T;
    }

    try {
      const value = await loader();
      const entry: CacheEntry = { value, storedAt: this.nowFn(), freshTtlMs: ttlMs, staleTtlMs };
      this.cache.set(cacheKey, entry);
      this.writeDisk(cacheKey, value);
      return { value, cache: 'MISS', latencyMs: this.nowFn() - started };
    } catch (error) {
      if (staleValue !== undefined) {
        this.recordFallback(sourceId, `served stale cache: ${describeError(error)}`);
        return { value: staleValue, cache: 'STALE', latencyMs: this.nowFn() - started };
      }
      throw error;
    }
  }

  /**
   * بدنهٔ مشترک درخواست: مهلت زمانی، retry نمایی و circuit breaker.
   * در صورت باز بودن مدار مستقیماً خطا می‌دهد تا بالا‌دست به fallback برود.
   */
  private async request<T>(
    sourceId: string,
    url: string,
    init: RequestInit,
    read: (response: Response) => Promise<T>,
  ): Promise<T> {
    if (!this.circuitAllows(sourceId)) {
      throw new Error(`source ${sourceId} circuit open`);
    }
    const started = this.nowFn();
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const external = init.signal;
      const onAbort = () => controller.abort();
      if (external) {
        if (external.aborted) controller.abort();
        else external.addEventListener('abort', onAbort, { once: true });
      }
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const payload = await read(response);
        this.recordSuccess(sourceId, this.nowFn() - started);
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await sleep(delay);
        }
      } finally {
        clearTimeout(timer);
        if (external) external.removeEventListener('abort', onAbort);
      }
    }
    this.recordFailure(sourceId, describeError(lastError), this.nowFn() - started);
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** درخواست JSON */
  async fetchJson(sourceId: string, url: string, init: RequestInit = {}): Promise<unknown> {
    return this.request(sourceId, url, init, response => response.json() as Promise<unknown>);
  }

  /** درخواست متن خام (CSV/XML) — همان کش، مهلت و مدار */
  async fetchText(sourceId: string, url: string, init: RequestInit = {}): Promise<string> {
    return this.request(sourceId, url, init, response => response.text());
  }

  private diskPath(cacheKey: string): string {
    const hash = crypto.createHash('sha1').update(cacheKey).digest('hex');
    return path.join(this.diskCacheDir as string, `${hash}.json`);
  }

  private readDisk(cacheKey: string, maxAgeMs: number): unknown {
    if (!this.diskCacheDir) return undefined;
    try {
      const file = this.diskPath(cacheKey);
      const stat = fs.statSync(file);
      const maxAge = Math.max(maxAgeMs, 24 * 60 * 60 * 1000);
      if (this.nowFn() - stat.mtimeMs > maxAge) return undefined;
      const wrapped = JSON.parse(fs.readFileSync(file, 'utf8')) as { value?: unknown };
      return wrapped.value;
    } catch {
      return undefined;
    }
  }

  private writeDisk(cacheKey: string, value: unknown): void {
    if (!this.diskCacheDir) return;
    try {
      fs.mkdirSync(this.diskCacheDir, { recursive: true });
      fs.writeFileSync(this.diskPath(cacheKey), JSON.stringify({ value }), 'utf8');
    } catch {
      /* کش دیسک اختیاری است؛ شکست آن هرگز اجرا را متوقف نمی‌کند */
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
