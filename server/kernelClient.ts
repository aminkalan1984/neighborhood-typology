// ============================================================
// Kernel Client (فاز سه: اتصال Express به سرویس Python)
// ------------------------------------------------------------
// کلاینت HTTP به سرویس هستهٔ محاسبات (kernel/service/kernel_service.py).
// اگر سرویس در دسترس نباشد، خودکار آن را launch می‌کند و منتظر
// health می‌ماند. هیچ fallback عددی یا دادهٔ ساختگی وجود ندارد:
// خطا = خطای استاندارد قرارداد.
// ============================================================
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  KernelRunResult, KernelBoundary, KernelError,
} from './kernelTypes';
import { normalizeKernelError } from './kernelTypes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KROOT = path.resolve(__dirname, '..', 'kernel');
const SERVICE_SCRIPT = path.join(KROOT, 'service', 'kernel_service.py');

const PORT = Number(process.env.KERNEL_SERVICE_PORT || 4105);
const BASE = process.env.KERNEL_SERVICE_URL || `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = Number(process.env.KERNEL_SERVICE_TIMEOUT_MS || 120_000);

let child: ChildProcess | null = null;
let ensurePromise: Promise<void> | null = null;

// ---------- low-level fetch with timeout ----------
async function fetchJson<T>(method: string, urlPath: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<{ status: number; payload: T }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: { code: 'CALCULATION_BLOCKED', message: `non-JSON response: ${text.slice(0, 200)}` } };
    }
    return { status: res.status, payload: payload as T };
  } finally {
    clearTimeout(timer);
  }
}

export function findPython(): string {
  const candidates = process.env.KERNEL_PYTHON
    ? [process.env.KERNEL_PYTHON]
    : ['python', 'python3', 'py'];
  // در ESM نمی‌توان از require استفاده کرد؛ spawnSync از import سطح‌بالا می‌آید.
  // اولین مفسری که واقعاً اجرا می‌شود برگردانده می‌شود (ویندوز: py/python، لینوکس: python3).
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ['--version'], { stdio: 'ignore', timeout: 5_000 });
      if (!r.error) return c;
    } catch { /* try next */ }
  }
  return 'python';
}

/** سرویس را راه‌اندازی می‌کند (اگر لازم باشد) و تا health OK منتظر می‌ماند. */
export async function ensureKernelService(): Promise<void> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    // already reachable?
    try {
      const { status } = await fetchJson<unknown>('GET', '/v1/health', undefined, 2_000);
      if (status === 200) return;
    } catch { /* not running — launch */ }

    if (!fs.existsSync(SERVICE_SCRIPT)) {
      throw new Error(`kernel service script missing: ${SERVICE_SCRIPT}`);
    }
    const python = findPython();
    let spawnError: Error | null = null;
    // UTF-8 console + unbuffered output for reliable logs on Windows
    child = spawn(python, ['-X', 'utf8', '-u', SERVICE_SCRIPT], {
      cwd: KROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', KERNEL_SERVICE_PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (d: Buffer) => console.log('[kernel-svc]', d.toString().trim()));
    child.stderr?.on('data', (d: Buffer) => console.log('[kernel-svc]', d.toString().trim()));
    // بدون این هندلر، خطای راه‌اندازی (مثل نبود مفسر) به‌صورت رویداد error
    // مدیریت‌نشده کل سرور Express را از پا می‌اندازد و همهٔ APIها ۵۰۰ می‌دهند.
    child.on('error', (error: Error) => {
      spawnError = error;
      console.warn(`[kernel-svc] failed to launch '${python}': ${error.message}`);
      child = null;
      ensurePromise = null;
    });
    child.on('exit', (code) => {
      console.warn(`[kernel-svc] service exited (code=${code})`);
      child = null;
      ensurePromise = null;
    });

    // wait for health
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`kernel service failed to launch with '${python}': ${(spawnError as Error).message}`);
      }
      try {
        const { status } = await fetchJson<unknown>('GET', '/v1/health', undefined, 1_500);
        if (status === 200) return;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error('kernel service did not become healthy within 20s');
  })().catch((error: unknown) => {
    // شکست راه‌اندازی نباید فراخوانی‌های بعدی را برای همیشه قفل کند؛ اجازهٔ تلاش مجدد می‌دهیم.
    ensurePromise = null;
    throw error;
  });
  return ensurePromise;
}

/** خاموش‌کردن سرویس راه‌اندازی‌شده توسط این فرایند (برای تست‌ها) */
export async function stopKernelService(): Promise<void> {
  const c = child;
  child = null;
  ensurePromise = null;
  if (c) {
    await new Promise<void>((resolve) => {
      c.once('exit', () => resolve());
      c.kill('SIGTERM');
      setTimeout(() => { try { c.kill('SIGKILL'); } catch { /* already dead */ } resolve(); }, 2_000);
    });
  }
}

// ---------- typed API calls ----------
export interface KernelClient {
  health(): Promise<{ status: number; payload: Record<string, unknown> }>;
  calculationRun(req: { data_version: string; records?: unknown[]; neighborhood?: Record<string, unknown>; weight_override?: Record<string, number>; use_pilot_records?: boolean }): Promise<KernelRunResult>;
  pilotArtifacts(): Promise<{ status: number; payload: Record<string, unknown> }>;
  boundary(neighborhoodId: string): Promise<KernelBoundary>;
  registries(): Promise<Record<string, unknown>>;
  drilldown(runId: string, valueId: string): Promise<{ status: number; payload: unknown }>;
  // ---- canonical Decision Support API (§63) — thin pass-through, no computation
  decisionSupportRegistries(): Promise<Record<string, unknown>>;
  decisionSupportSources(): Promise<Record<string, unknown>>;
  decisionSupportObservations(req: { observations: unknown[] }): Promise<Record<string, unknown>>;
  decisionSupportRun(req: Record<string, unknown>): Promise<Record<string, unknown>>;
  decisionSupportRunById(runId: string): Promise<Record<string, unknown>>;
  decisionSupportRunSection(runId: string, section: string): Promise<Record<string, unknown>>;
  decisionSupportDrilldown(runId: string, observationId: string): Promise<Record<string, unknown>>;
  decisionSupportBoundary(neighborhoodId: string): Promise<Record<string, unknown>>;
}

export const kernelClient: KernelClient = {
  async health() {
    await ensureKernelService();
    return fetchJson<Record<string, unknown>>('GET', '/v1/health');
  },

  async calculationRun(req) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<KernelRunResult | KernelError>('POST', '/v1/calculation-runs', req);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload as KernelRunResult;
  },

  async pilotArtifacts() {
    await ensureKernelService();
    return fetchJson<Record<string, unknown>>('GET', '/v1/pilot/mvp2');
  },

  async boundary(neighborhoodId) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<KernelBoundary | KernelError>('GET', `/v1/gis/boundaries/${encodeURIComponent(neighborhoodId)}`);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload as KernelBoundary;
  },

  async registries() {
    await ensureKernelService();
    const { payload } = await fetchJson<Record<string, unknown>>('GET', '/v1/registries');
    return payload;
  },

  async drilldown(runId, valueId) {
    await ensureKernelService();
    return fetchJson<unknown>('GET', `/v1/calculation-runs/${encodeURIComponent(runId)}/drilldown/${encodeURIComponent(valueId)}`);
  },

  // ---- canonical Decision Support API (§63) --------------------------------
  // Each method forwards to the kernel service and surfaces a kernel error as
  // an HTTP-shaped error. No number is created, adjusted or substituted here.
  async decisionSupportRegistries() {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>('GET', '/v1/decision-support/registries');
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportSources() {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>('GET', '/v1/decision-support/sources');
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportObservations(req) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>('POST', '/v1/decision-support/observations', req);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportRun(req) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>('POST', '/v1/decision-support/runs', req);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportRunById(runId) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>('GET', `/v1/decision-support/runs/${encodeURIComponent(runId)}`);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportRunSection(runId, section) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>(
      'GET', `/v1/decision-support/runs/${encodeURIComponent(runId)}/${encodeURIComponent(section)}`);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportDrilldown(runId, observationId) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>(
      'GET', `/v1/decision-support/runs/${encodeURIComponent(runId)}/drilldown/${encodeURIComponent(observationId)}`);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },

  async decisionSupportBoundary(neighborhoodId) {
    await ensureKernelService();
    const { status, payload } = await fetchJson<Record<string, unknown>>(
      'GET', `/v1/decision-support/neighborhoods/${encodeURIComponent(neighborhoodId)}/boundary`);
    if (status !== 200) throw kernelErrorToHttp(status, payload);
    return payload;
  },
};

export class KernelServiceError extends Error {
  status: number;
  code: string;
  detail: unknown;
  constructor(status: number, code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'KernelServiceError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function kernelErrorToHttp(status: number, payload: unknown): KernelServiceError {
  const e = normalizeKernelError(payload);
  return new KernelServiceError(status, e.code, e.message, payload);
}
