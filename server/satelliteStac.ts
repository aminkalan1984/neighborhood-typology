import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router, type Request } from 'express';
import { SatelliteCatalog } from './satelliteCatalog';

export type SatelliteProviderName = 'cdse' | 'earth-search' | 'nasa-lance' | 'hls';
export type SatelliteCollection = 'sentinel-2-l2a' | 'sentinel-1-grd' | 'hls-s30' | 'hls-l30' | 'modis-nrt';
export type SatelliteSearchPurpose = 'auto' | 'optical' | 'radar' | 'time-series' | 'alert';

export interface SatelliteSearchCriteria {
  bbox: [number, number, number, number];
  datetime: string;
  collections: SatelliteCollection[];
  limit: number;
  maxAgeHours?: number;
  maxCloudCover?: number;
  minimumCoverage?: number;
  purpose?: SatelliteSearchPurpose;
  provider: 'auto' | SatelliteProviderName;
}

export interface SatelliteAssetMetadata {
  href: string;
  type?: string;
  title?: string;
  roles?: string[];
  bands?: Array<{ name?: string; common_name?: string; gsd?: number; scale?: number; offset?: number; nodata?: number }>;
  gsd?: number;
  scale?: number;
  offset?: number;
  nodata?: number;
  checksum?: string;
}

export interface SatelliteSelectionBreakdown {
  total: number;
  freshness: number;
  cloud: number;
  resolution: number;
  coverage: number;
  provider_health: number;
  provider_priority: number;
  quota_penalty: number;
  coverage_fraction: number;
  reasons: string[];
}

export interface SatelliteItemMetadata {
  metadata_id: string;
  provider: SatelliteProviderName;
  collection: SatelliteCollection;
  item_id: string;
  datetime: string;
  published_datetime?: string;
  latency_minutes?: number;
  bbox?: [number, number, number, number];
  geometry?: unknown;
  cloud_cover?: number | null;
  platform?: string;
  instruments?: string[];
  processing_level?: string;
  product_timeliness?: string;
  resolution_m?: number;
  bands?: string[];
  assets: Record<string, SatelliteAssetMetadata>;
  quicklook_url?: string;
  license?: string;
  source_url: string;
  acquired_age_hours: number;
  freshness_status: 'fresh' | 'stale' | 'unknown';
  selection_score?: number;
  selection?: SatelliteSelectionBreakdown;
  ingested_at?: string;
  registered_at: string;
}

export interface SatelliteProviderHealth {
  provider: SatelliteProviderName;
  status: 'online' | 'degraded' | 'offline';
  requests: number;
  successes: number;
  failures: number;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_latency_ms: number | null;
  last_error: string | null;
  quota_penalty: number;
  circuit_open_until?: string | null;
}

export interface SatelliteRasterWindowDescriptor {
  provider: SatelliteProviderName;
  metadata_id: string;
  bbox: [number, number, number, number];
  bands: string[];
  assets: Record<string, SatelliteAssetMetadata>;
  access: 'remote-cog-window' | 'provider-raster-window';
  expires_at?: string;
}

export interface SatelliteProvider {
  readonly name: SatelliteProviderName;
  readonly collections: Partial<Record<SatelliteCollection, string>>;
  supports(collection: SatelliteCollection): boolean;
  search(criteria: SatelliteSearchCriteria): Promise<SatelliteItemMetadata[]>;
  getItem(collection: SatelliteCollection, itemId: string): Promise<SatelliteItemMetadata>;
  getAssets(item: SatelliteItemMetadata): Promise<Record<string, SatelliteAssetMetadata>>;
  getQuicklook(item: SatelliteItemMetadata): Promise<string | null>;
  getRasterWindow(item: SatelliteItemMetadata, bbox: [number, number, number, number], bands: string[]): Promise<SatelliteRasterWindowDescriptor>;
  health(): SatelliteProviderHealth;
}

type FetchLike = typeof fetch;
export type StacItem = {
  id?: unknown;
  type?: unknown;
  collection?: unknown;
  properties?: Record<string, unknown>;
  bbox?: unknown;
  geometry?: unknown;
  assets?: Record<string, Record<string, unknown>>;
  links?: Array<Record<string, unknown>>;
};

interface ProviderAdapterOptions {
  fetch?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  circuitFailureThreshold?: number;
  circuitCooldownMs?: number;
}

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SATELLITE_METADATA_PATH = path.join(SERVER_DIR, 'data', 'satellite-items.json');
export const DEFAULT_IRAN_BBOX: [number, number, number, number] = [44, 25, 63, 40];
const DEFAULT_LOOKBACK_HOURS = 48;
const DEFAULT_LIMIT = 20;
const MAX_METADATA_RECORDS = 10_000;
const COLLECTIONS = new Set<SatelliteCollection>(['sentinel-2-l2a', 'sentinel-1-grd', 'hls-s30', 'hls-l30', 'modis-nrt']);
const PROVIDER_NAMES = new Set<SatelliteProviderName>(['cdse', 'earth-search', 'nasa-lance', 'hls']);
const OPTICAL_COLLECTIONS = new Set<SatelliteCollection>(['sentinel-2-l2a', 'hls-s30', 'hls-l30', 'modis-nrt']);
const PROVIDER_PRIORITY: Record<SatelliteProviderName, number> = { cdse: 5, 'earth-search': 4, hls: 3, 'nasa-lance': 2 };

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function parseBbox(value: unknown): [number, number, number, number] | null {
  const values = String(value ?? '').split(',').map((part) => Number(part.trim()));
  if (values.length !== 4 || values.some((part) => !Number.isFinite(part))) return null;
  const [west, south, east, north] = values;
  if (west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90 || west >= east || south >= north) return null;
  return [west, south, east, north];
}

function parseCollections(value: unknown): SatelliteCollection[] | null {
  const raw = String(value ?? '').trim();
  if (!raw) return ['sentinel-2-l2a', 'sentinel-1-grd'];
  const requested = raw.split(',').map((item) => item.trim()).filter(Boolean);
  const collections = requested.filter((item): item is SatelliteCollection => COLLECTIONS.has(item as SatelliteCollection));
  return collections.length === requested.length && collections.length > 0 ? [...new Set(collections)] : null;
}

function isoInterval(start: Date, end: Date): string {
  return `${start.toISOString()}/${end.toISOString()}`;
}

function parseDatetime(value: unknown, now: () => number): string | null {
  const raw = String(value ?? '').trim();
  if (raw) {
    if (raw.includes('/')) {
      const [start, end] = raw.split('/', 2).map((part) => asIso(part));
      return start && end ? `${start}/${end}` : null;
    }
    const exact = asIso(raw);
    return exact ? `${exact}/${exact}` : null;
  }
  const end = new Date(now());
  return isoInterval(new Date(end.getTime() - DEFAULT_LOOKBACK_HOURS * 3_600_000), end);
}

function safeAssetHref(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|signature|sig|credential|secret|key/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}

function sourceChecksum(raw: Record<string, unknown>): string | undefined {
  const value = raw.checksum ?? raw['file:checksum'] ?? raw['checksum:multihash'];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeAssets(rawAssets: StacItem['assets']): Record<string, SatelliteAssetMetadata> {
  const output: Record<string, SatelliteAssetMetadata> = {};
  for (const [key, raw] of Object.entries(rawAssets ?? {})) {
    const href = safeAssetHref(raw.href);
    if (!href) continue;
    const rasterBand = Array.isArray(raw['raster:bands']) && raw['raster:bands'][0] && typeof raw['raster:bands'][0] === 'object'
      ? raw['raster:bands'][0] as Record<string, unknown>
      : {};
    const bands = Array.isArray(raw.bands)
      ? raw.bands.flatMap((band) => {
          if (!band || typeof band !== 'object') return [];
          const item = band as Record<string, unknown>;
          return [{
            name: typeof item.name === 'string' ? item.name : undefined,
            common_name: typeof item['eo:common_name'] === 'string' ? item['eo:common_name'] : undefined,
            gsd: asFiniteNumber(item.gsd) ?? undefined,
            scale: asFiniteNumber(item.scale) ?? asFiniteNumber(rasterBand.scale) ?? undefined,
            offset: asFiniteNumber(item.offset) ?? asFiniteNumber(rasterBand.offset) ?? undefined,
            nodata: asFiniteNumber(item.nodata) ?? asFiniteNumber(rasterBand.nodata) ?? undefined,
          }];
        })
      : undefined;
    output[key] = {
      href,
      type: typeof raw.type === 'string' ? raw.type : undefined,
      title: typeof raw.title === 'string' ? raw.title : undefined,
      roles: Array.isArray(raw.roles) ? raw.roles.filter((role): role is string => typeof role === 'string') : undefined,
      bands,
      gsd: asFiniteNumber(raw.gsd) ?? undefined,
      scale: asFiniteNumber(raw.scale) ?? asFiniteNumber(rasterBand.scale) ?? undefined,
      offset: asFiniteNumber(raw.offset) ?? asFiniteNumber(rasterBand.offset) ?? undefined,
      nodata: asFiniteNumber(raw.nodata) ?? asFiniteNumber(rasterBand.nodata) ?? undefined,
      checksum: sourceChecksum(raw),
    };
  }
  return output;
}

function extractResolution(properties: Record<string, unknown>, assets: Record<string, SatelliteAssetMetadata>): number | undefined {
  const summary = asFiniteNumber(properties.gsd);
  if (summary !== null) return summary;
  const values = Object.values(assets).flatMap((asset) => [asset.gsd, ...(asset.bands ?? []).map((band) => band.gsd)]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? Math.min(...values) : undefined;
}

function extractBands(assets: Record<string, SatelliteAssetMetadata>): string[] {
  return [...new Set(Object.entries(assets).flatMap(([assetKey, asset]) => [assetKey, ...(asset.bands ?? []).flatMap((band) => [band.name, band.common_name])]).filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

function quicklookFromAssets(assets: Record<string, SatelliteAssetMetadata>): string | undefined {
  const entries = Object.entries(assets);
  const preferred = entries.find(([key, asset]) => /thumbnail|quicklook|preview|rendered_preview/i.test(key) || asset.roles?.some((role) => /thumbnail|overview/i.test(role)))
    ?? entries.find(([key, asset]) => /visual|overview/i.test(key) && asset.type?.startsWith('image/'));
  return preferred?.[1].href;
}

function metadataKey(provider: SatelliteProviderName, collection: SatelliteCollection, itemId: string): string {
  return `${provider}:${collection}:${itemId}`;
}

function bboxCoverage(requested: [number, number, number, number], available?: [number, number, number, number]): number {
  if (!available) return 0;
  const overlapWidth = Math.max(0, Math.min(requested[2], available[2]) - Math.max(requested[0], available[0]));
  const overlapHeight = Math.max(0, Math.min(requested[3], available[3]) - Math.max(requested[1], available[1]));
  const requestedArea = Math.max(0, requested[2] - requested[0]) * Math.max(0, requested[3] - requested[1]);
  return requestedArea > 0 ? clamp((overlapWidth * overlapHeight) / requestedArea, 0, 1) : 0;
}

function normalizeCollection(collections: SatelliteProvider['collections'], collection: unknown): SatelliteCollection | null {
  const value = String(Array.isArray(collection) ? collection[0] : collection ?? '');
  const internal = Object.entries(collections).find(([, source]) => source === value)?.[0];
  return internal && COLLECTIONS.has(internal as SatelliteCollection)
    ? internal as SatelliteCollection
    : COLLECTIONS.has(value as SatelliteCollection)
      ? value as SatelliteCollection
      : null;
}

function normalizeItem(provider: Pick<SatelliteProvider, 'name' | 'collections'> & { endpoint: string }, raw: StacItem, now: () => number): SatelliteItemMetadata | null {
  const itemId = typeof raw.id === 'string' ? raw.id.trim() : '';
  const properties = raw.properties ?? {};
  const collection = normalizeCollection(provider.collections, raw.collection);
  const datetime = asIso(properties.datetime) ?? asIso(properties.start_datetime) ?? asIso(properties.end_datetime);
  if (!itemId || !collection || !datetime) return null;
  const assets = normalizeAssets(raw.assets);
  const publishedDatetime = asIso(properties.published) ?? asIso(properties.created) ?? asIso(properties.updated);
  const acquiredAgeHours = Math.max(0, (now() - new Date(datetime).getTime()) / 3_600_000);
  const cloudCover = asFiniteNumber(properties['eo:cloud_cover'] ?? properties.cloud_cover);
  const latencyMinutes = publishedDatetime ? Math.max(0, (new Date(publishedDatetime).getTime() - new Date(datetime).getTime()) / 60_000) : undefined;
  const ingestedAt = new Date(now()).toISOString();
  return {
    metadata_id: metadataKey(provider.name, collection, itemId), provider: provider.name, collection, item_id: itemId, datetime,
    published_datetime: publishedDatetime ?? undefined,
    latency_minutes: latencyMinutes === undefined ? undefined : Number(latencyMinutes.toFixed(1)),
    bbox: Array.isArray(raw.bbox) && raw.bbox.length >= 4 && raw.bbox.slice(0, 4).every((value) => Number.isFinite(Number(value))) ? raw.bbox.slice(0, 4).map(Number) as [number, number, number, number] : undefined,
    geometry: raw.geometry, cloud_cover: cloudCover,
    platform: typeof properties.platform === 'string' ? properties.platform : typeof properties['sat:platform_international_designator'] === 'string' ? properties['sat:platform_international_designator'] : undefined,
    instruments: Array.isArray(properties.instruments) ? properties.instruments.filter((item): item is string => typeof item === 'string') : undefined,
    processing_level: typeof properties['processing:level'] === 'string' ? properties['processing:level'] : typeof properties['hls:processing_level'] === 'string' ? properties['hls:processing_level'] : undefined,
    product_timeliness: typeof properties['product:timeliness'] === 'string' ? properties['product:timeliness'] : undefined,
    resolution_m: extractResolution(properties, assets), bands: extractBands(assets), assets, quicklook_url: quicklookFromAssets(assets),
    license: typeof properties.license === 'string' ? properties.license : undefined,
    source_url: `${provider.endpoint}/collections/${encodeURIComponent(String(provider.collections[collection] ?? collection))}/items/${encodeURIComponent(itemId)}`,
    acquired_age_hours: Number(acquiredAgeHours.toFixed(2)), freshness_status: acquiredAgeHours <= 24 ? 'fresh' : acquiredAgeHours <= 72 ? 'stale' : 'unknown',
    ingested_at: ingestedAt, registered_at: ingestedAt,
  };
}

abstract class StacSatelliteProvider implements SatelliteProvider {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly circuitFailureThreshold: number;
  private readonly circuitCooldownMs: number;
  private circuitOpenUntil = 0;
  private readonly state: SatelliteProviderHealth;

  constructor(
    readonly name: SatelliteProviderName,
    readonly endpoint: string,
    readonly collections: Partial<Record<SatelliteCollection, string>>,
    options: ProviderAdapterOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 1;
    this.retryDelayMs = options.retryDelayMs ?? 200;
    this.circuitFailureThreshold = Math.max(1, Math.trunc(options.circuitFailureThreshold ?? 3));
    this.circuitCooldownMs = Math.max(1_000, Math.trunc(options.circuitCooldownMs ?? 30_000));
    this.state = { provider: name, status: 'offline', requests: 0, successes: 0, failures: 0, consecutive_failures: 0, last_success_at: null, last_failure_at: null, last_latency_ms: null, last_error: null, quota_penalty: 0 };
  }

  supports(collection: SatelliteCollection): boolean { return Boolean(this.collections[collection]); }
  health(): SatelliteProviderHealth { return { ...this.state, circuit_open_until: this.circuitOpenUntil > this.now() ? new Date(this.circuitOpenUntil).toISOString() : null }; }

  async search(criteria: SatelliteSearchCriteria): Promise<SatelliteItemMetadata[]> {
    const supported = criteria.collections.filter((collection) => this.supports(collection));
    if (supported.length === 0) return [];
    const payload = await this.requestJson(`${this.endpoint}/search`, {
      method: 'POST',
      headers: { Accept: 'application/geo+json, application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ collections: supported.map((collection) => this.collections[collection]), bbox: criteria.bbox, datetime: criteria.datetime, limit: Math.min(100, criteria.limit) }),
    }) as { features?: StacItem[] };
    return (Array.isArray(payload.features) ? payload.features : []).flatMap((raw) => {
      const item = normalizeItem(this, raw, this.now);
      return item ? [item] : [];
    });
  }

  async getItem(collection: SatelliteCollection, itemId: string): Promise<SatelliteItemMetadata> {
    const sourceCollection = this.collections[collection];
    if (!sourceCollection) throw new Error(`${this.name} does not support ${collection}`);
    const raw = await this.requestJson(`${this.endpoint}/collections/${encodeURIComponent(sourceCollection)}/items/${encodeURIComponent(itemId)}`, { method: 'GET', headers: { Accept: 'application/geo+json, application/json' } }) as StacItem;
    const item = normalizeItem(this, raw, this.now);
    if (!item) throw new Error('STAC item is missing id, collection, or datetime');
    return item;
  }

  async getAssets(item: SatelliteItemMetadata): Promise<Record<string, SatelliteAssetMetadata>> { return item.assets; }
  async getQuicklook(item: SatelliteItemMetadata): Promise<string | null> { return item.quicklook_url ?? quicklookFromAssets(item.assets) ?? null; }
  async getRasterWindow(item: SatelliteItemMetadata, bbox: [number, number, number, number], bands: string[]): Promise<SatelliteRasterWindowDescriptor> {
    const wanted = new Set(bands.map((band) => band.toLowerCase()));
    const assets = Object.fromEntries(Object.entries(item.assets).filter(([key, asset]) => {
      if (wanted.size === 0) return true;
      const names = [key, ...(asset.bands ?? []).flatMap((band) => [band.name, band.common_name])].filter((name): name is string => typeof name === 'string').map((name) => name.toLowerCase());
      return names.some((name) => wanted.has(name));
    }));
    return { provider: this.name, metadata_id: item.metadata_id, bbox, bands, assets, access: 'remote-cog-window' };
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    if (this.circuitOpenUntil > this.now()) throw new Error(`${this.name} circuit is open until ${new Date(this.circuitOpenUntil).toISOString()}`);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const started = this.now();
      this.state.requests += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        if (!response.ok) {
          this.state.quota_penalty = response.status === 429 ? Math.min(25, this.state.quota_penalty + 10) : this.state.quota_penalty;
          throw new Error(`${this.name} STAC returned HTTP ${response.status}`);
        }
        const payload = await response.json();
        this.state.successes += 1;
        this.state.consecutive_failures = 0;
        this.state.status = 'online';
        this.state.last_success_at = new Date(this.now()).toISOString();
        this.state.last_latency_ms = Math.max(0, this.now() - started);
        this.state.last_error = null;
        this.state.quota_penalty = Math.max(0, this.state.quota_penalty - 1);
        this.circuitOpenUntil = 0;
        return payload;
      } catch (error) {
        lastError = error instanceof Error && error.name === 'AbortError' ? new Error(`${this.name} STAC timed out after ${this.timeoutMs}ms`) : error;
        this.state.failures += 1;
        this.state.consecutive_failures += 1;
        this.state.status = this.state.successes > 0 ? 'degraded' : 'offline';
        this.state.last_failure_at = new Date(this.now()).toISOString();
        this.state.last_latency_ms = Math.max(0, this.now() - started);
        this.state.last_error = lastError instanceof Error ? lastError.message : 'STAC request failed';
        if (this.state.consecutive_failures >= this.circuitFailureThreshold) this.circuitOpenUntil = this.now() + this.circuitCooldownMs;
        if (attempt < this.maxRetries) await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('STAC request failed');
  }
}

export class CdseStacProvider extends StacSatelliteProvider {
  constructor(options: ProviderAdapterOptions = {}) {
    super('cdse', process.env.SATELLITE_CDSE_STAC_URL ?? 'https://stac.dataspace.copernicus.eu/v1', { 'sentinel-2-l2a': 'sentinel-2-l2a', 'sentinel-1-grd': 'sentinel-1-grd' }, options);
  }
}

export class AwsEarthSearchProvider extends StacSatelliteProvider {
  constructor(options: ProviderAdapterOptions = {}) {
    super('earth-search', process.env.SATELLITE_EARTH_SEARCH_URL ?? 'https://earth-search.aws.element84.com/v1', { 'sentinel-2-l2a': 'sentinel-2-c1-l2a', 'sentinel-1-grd': 'sentinel-1-grd' }, options);
  }
}

export class NasaLanceProvider extends StacSatelliteProvider {
  constructor(options: ProviderAdapterOptions = {}) {
    super('nasa-lance', process.env.SATELLITE_LANCE_STAC_URL ?? 'https://cmr.earthdata.nasa.gov/stac/LANCEMODIS', { 'modis-nrt': process.env.SATELLITE_LANCE_COLLECTION ?? 'MODIS_NRT' }, options);
  }
}

export class HlsProvider extends StacSatelliteProvider {
  constructor(options: ProviderAdapterOptions = {}) {
    super('hls', process.env.SATELLITE_HLS_STAC_URL ?? 'https://cmr.earthdata.nasa.gov/stac/LPCLOUD', { 'hls-s30': 'HLSS30.v2.0', 'hls-l30': 'HLSL30.v2.0' }, options);
  }
}

export function createDefaultSatelliteProviders(options: ProviderAdapterOptions = {}): SatelliteProvider[] {
  return [new CdseStacProvider(options), new AwsEarthSearchProvider(options), new HlsProvider(options), new NasaLanceProvider(options)];
}

export class SatelliteMetadataStore {
  private readonly records = new Map<string, SatelliteItemMetadata>();
  readonly catalog: SatelliteCatalog;

  constructor(private readonly filePath = DEFAULT_SATELLITE_METADATA_PATH, catalog?: SatelliteCatalog) {
    this.catalog = catalog ?? new SatelliteCatalog(path.join(path.dirname(filePath), 'satellite-catalog.sqlite'), path.resolve(filePath) === path.resolve(DEFAULT_SATELLITE_METADATA_PATH));
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const raw of parsed) {
        if (!raw || typeof raw !== 'object' || typeof (raw as SatelliteItemMetadata).metadata_id !== 'string') continue;
        const item = raw as SatelliteItemMetadata;
        const ingestedAt = item.ingested_at ?? item.registered_at ?? new Date().toISOString();
        this.records.set(item.metadata_id, { ...item, bands: item.bands ?? extractBands(item.assets ?? {}), ingested_at: ingestedAt, registered_at: item.registered_at ?? ingestedAt });
      }
    } catch {
      // A corrupt optional cache must not prevent the API from starting.
    }
  }

  upsert(items: SatelliteItemMetadata[]): number {
    for (const item of items) {
      this.records.set(item.metadata_id, item);
      this.catalog.upsertItem(item as unknown as Parameters<SatelliteCatalog['upsertItem']>[0]);
    }
    if (items.length > 0) {
      if (this.records.size > MAX_METADATA_RECORDS) {
        const oldest = [...this.records.values()].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(MAX_METADATA_RECORDS);
        for (const item of oldest) this.records.delete(item.metadata_id);
      }
      this.flush();
    }
    return items.length;
  }

  list(limit = 100): SatelliteItemMetadata[] { return [...this.records.values()].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, clamp(Math.trunc(limit), 1, 500)); }
  get(provider: SatelliteProviderName, collection: SatelliteCollection, itemId: string): SatelliteItemMetadata | null { return this.records.get(metadataKey(provider, collection, itemId)) ?? null; }
  getByMetadataId(metadataId: string): SatelliteItemMetadata | null { return this.records.get(metadataId) ?? null; }
  count(): number { return this.records.size; }

  private flush(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify([...this.records.values()].sort((a, b) => b.datetime.localeCompare(a.datetime)), null, 2), 'utf8');
      fs.renameSync(temporaryPath, this.filePath);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    }
  }
}

export interface SatelliteStacServiceOptions extends ProviderAdapterOptions {
  store?: SatelliteMetadataStore;
  providers?: SatelliteProvider[];
  service?: SatelliteStacService;
}

function scoreItem(item: SatelliteItemMetadata, criteria: SatelliteSearchCriteria, health: SatelliteProviderHealth): SatelliteSelectionBreakdown {
  const targetAge = Math.max(1, criteria.maxAgeHours ?? (criteria.purpose === 'time-series' ? 168 : 24));
  const freshness = clamp(35 * (1 - item.acquired_age_hours / Math.max(targetAge * 2, 1)), 0, 35);
  const cloud = OPTICAL_COLLECTIONS.has(item.collection) ? clamp(20 * (1 - (item.cloud_cover ?? 100) / 100), 0, 20) : 20;
  const resolution = item.resolution_m ? clamp(15 * (30 / Math.max(10, item.resolution_m)), 0, 15) : 4;
  const coverageFraction = bboxCoverage(criteria.bbox, item.bbox);
  const coverage = 15 * coverageFraction;
  const providerHealth = health.status === 'online' ? 10 : health.status === 'degraded' ? 5 : health.successes === 0 && health.failures === 0 ? 6 : 0;
  const providerPriority = PROVIDER_PRIORITY[item.provider];
  const quotaPenalty = clamp(health.quota_penalty + health.consecutive_failures * 2, 0, 25);
  const total = Number((freshness + cloud + resolution + coverage + providerHealth + providerPriority - quotaPenalty).toFixed(3));
  const reasons = [
    `${item.acquired_age_hours.toFixed(1)}h old`, `${coverageFraction.toFixed(2)} AOI coverage`, `${item.resolution_m ?? 'unknown'}m`,
    OPTICAL_COLLECTIONS.has(item.collection) ? `${item.cloud_cover ?? 'unknown'}% cloud` : 'cloud-independent radar', `${health.status} provider`,
  ];
  return { total, freshness: Number(freshness.toFixed(3)), cloud: Number(cloud.toFixed(3)), resolution: Number(resolution.toFixed(3)), coverage: Number(coverage.toFixed(3)), provider_health: providerHealth, provider_priority: providerPriority, quota_penalty: quotaPenalty, coverage_fraction: Number(coverageFraction.toFixed(6)), reasons };
}

export class SatelliteStacService {
  readonly store: SatelliteMetadataStore;
  readonly providers: SatelliteProvider[];

  constructor(options: SatelliteStacServiceOptions = {}) {
    this.store = options.store ?? new SatelliteMetadataStore();
    this.providers = options.providers ?? createDefaultSatelliteProviders(options);
  }

  health(): SatelliteProviderHealth[] { return this.providers.map((provider) => provider.health()); }
  provider(name: SatelliteProviderName): SatelliteProvider {
    const provider = this.providers.find((candidate) => candidate.name === name);
    if (!provider) throw new Error(`Satellite provider ${name} is not configured`);
    return provider;
  }

  async search(criteria: SatelliteSearchCriteria): Promise<{ items: SatelliteItemMetadata[]; recommended: SatelliteItemMetadata | null; providers: SatelliteProviderName[]; errors: Array<{ provider: SatelliteProviderName; message: string }>; fallback?: string }> {
    const selectedProviders = criteria.provider === 'auto' ? this.providers : [this.provider(criteria.provider)];
    const errors: Array<{ provider: SatelliteProviderName; message: string }> = [];
    const successful: SatelliteProviderName[] = [];
    const all: SatelliteItemMetadata[] = [];
    for (const provider of selectedProviders.filter((candidate) => criteria.collections.some((collection) => candidate.supports(collection)))) {
      try {
        const rows = await provider.search(criteria);
        successful.push(provider.name);
        for (const row of rows) {
          if (criteria.maxAgeHours !== undefined && row.acquired_age_hours > criteria.maxAgeHours) continue;
          if (criteria.maxCloudCover !== undefined && OPTICAL_COLLECTIONS.has(row.collection) && (row.cloud_cover === null || row.cloud_cover === undefined || row.cloud_cover > criteria.maxCloudCover)) continue;
          const selection = scoreItem(row, criteria, provider.health());
          if (criteria.minimumCoverage !== undefined && selection.coverage_fraction < criteria.minimumCoverage) continue;
          all.push({ ...row, selection_score: selection.total, selection });
        }
      } catch (error) {
        errors.push({ provider: provider.name, message: error instanceof Error ? error.message : 'STAC provider request failed' });
      }
    }

    let fallback: string | undefined;
    if (criteria.provider === 'auto' && all.length === 0 && criteria.collections.includes('sentinel-2-l2a') && !criteria.collections.includes('sentinel-1-grd')) {
      fallback = 'No usable optical scene met the freshness/cloud constraints; Sentinel-1 radar fallback was searched.';
      const radarCriteria: SatelliteSearchCriteria = { ...criteria, collections: ['sentinel-1-grd'], maxCloudCover: undefined, purpose: 'radar' };
      for (const provider of this.providers.filter((candidate) => candidate.supports('sentinel-1-grd'))) {
        try {
          const rows = await provider.search(radarCriteria);
          if (!successful.includes(provider.name)) successful.push(provider.name);
          for (const row of rows) {
            if (criteria.maxAgeHours !== undefined && row.acquired_age_hours > criteria.maxAgeHours) continue;
            const selection = scoreItem(row, radarCriteria, provider.health());
            all.push({ ...row, selection_score: selection.total, selection });
          }
        } catch (error) {
          errors.push({ provider: provider.name, message: error instanceof Error ? error.message : 'Radar fallback failed' });
        }
      }
    }

    const deduplicated = new Map<string, SatelliteItemMetadata>();
    for (const item of all) deduplicated.set(item.metadata_id, item);
    const items = [...deduplicated.values()].sort((a, b) => (b.selection_score ?? 0) - (a.selection_score ?? 0) || b.datetime.localeCompare(a.datetime)).slice(0, criteria.limit);
    this.store.upsert(items);
    return { items, recommended: items[0] ?? null, providers: successful, errors, fallback };
  }

  async getItem(providerName: SatelliteProviderName, collection: SatelliteCollection, itemId: string): Promise<SatelliteItemMetadata> {
    const item = await this.provider(providerName).getItem(collection, itemId);
    this.store.upsert([item]);
    return item;
  }

  getItemByMetadataId(metadataId: string): SatelliteItemMetadata | null { return this.store.getByMetadataId(metadataId); }

  async getProcessingCandidates(metadataId: string, bbox: [number, number, number, number]): Promise<SatelliteItemMetadata[]> {
    const source = this.store.getByMetadataId(metadataId);
    if (!source) throw new Error('Source metadata was not found');
    const acquired = new Date(source.datetime).getTime();
    const criteria: SatelliteSearchCriteria = {
      bbox, datetime: isoInterval(new Date(acquired - 24 * 3_600_000), new Date(acquired + 24 * 3_600_000)),
      collections: [source.collection], limit: 20, provider: 'auto', purpose: source.collection === 'sentinel-1-grd' ? 'radar' : 'optical',
    };
    const result = await this.search(criteria);
    return [source, ...result.items.filter((item) => item.metadata_id !== source.metadata_id)].sort((a, b) => (b.selection_score ?? 0) - (a.selection_score ?? 0));
  }

  register(raw: StacItem, providerName: SatelliteProviderName, collection?: SatelliteCollection): SatelliteItemMetadata {
    const provider = this.provider(providerName);
    const endpoint = provider instanceof StacSatelliteProvider ? provider.endpoint : '';
    const normalizedRaw = collection && !raw.collection ? { ...raw, collection: provider.collections[collection] ?? collection } : raw;
    const item = normalizeItem({ name: provider.name, collections: provider.collections, endpoint }, normalizedRaw, Date.now);
    if (!item) throw new Error('Metadata requires id, collection, and valid datetime');
    this.store.upsert([item]);
    return item;
  }
}

function correlationId(req: Request): string {
  const incoming = req.header('x-correlation-id')?.trim();
  return incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
}

function parseCriteria(req: Request, now: () => number): SatelliteSearchCriteria | null {
  const bbox = req.query.bbox ? parseBbox(req.query.bbox) : DEFAULT_IRAN_BBOX;
  const collections = parseCollections(req.query.collection ?? req.query.collections);
  const datetime = parseDatetime(req.query.datetime ?? (req.query.start && `${req.query.start}/${req.query.end ?? new Date(now()).toISOString()}`), now);
  const limit = Number(req.query.limit ?? DEFAULT_LIMIT);
  const maxAge = req.query.maxAgeHours === undefined ? undefined : Number(req.query.maxAgeHours);
  const maxCloud = req.query.maxCloudCover === undefined ? undefined : Number(req.query.maxCloudCover);
  const minimumCoverage = req.query.minimumCoverage === undefined ? undefined : Number(req.query.minimumCoverage);
  const provider = String(req.query.provider ?? 'auto') as SatelliteSearchCriteria['provider'];
  const purpose = String(req.query.purpose ?? 'auto') as SatelliteSearchPurpose;
  if (!bbox || !collections || !datetime || !Number.isFinite(limit) || limit < 1 || limit > 100 || (maxAge !== undefined && (!Number.isFinite(maxAge) || maxAge < 0)) || (maxCloud !== undefined && (!Number.isFinite(maxCloud) || maxCloud < 0 || maxCloud > 100)) || (minimumCoverage !== undefined && (!Number.isFinite(minimumCoverage) || minimumCoverage < 0 || minimumCoverage > 1)) || (provider !== 'auto' && !PROVIDER_NAMES.has(provider)) || !['auto', 'optical', 'radar', 'time-series', 'alert'].includes(purpose)) return null;
  return { bbox, collections, datetime, limit: Math.trunc(limit), maxAgeHours: maxAge, maxCloudCover: maxCloud, minimumCoverage, provider, purpose };
}

export function createSatelliteRouter(options: SatelliteStacServiceOptions = {}): Router {
  const service = options.service ?? new SatelliteStacService(options);
  const router = Router();

  router.get('/health', (_req, res) => res.json({ ok: true, service: 'satellite-provider-gateway', providers: service.health(), metadata: { records: service.store.count(), storage: 'server/data/satellite-items.json' }, catalog: service.store.catalog.metrics() }));

  router.get('/search', async (req, res) => {
    const id = correlationId(req);
    const criteria = parseCriteria(req, options.now ?? Date.now);
    if (!criteria) { res.status(400).json({ success: false, error: { code: 'INVALID_SATELLITE_SEARCH', message: 'bbox, datetime, collection, provider, purpose, and limits must be valid.' }, correlation_id: id }); return; }
    try {
      const result = await service.search(criteria);
      res.setHeader('X-Correlation-ID', id);
      res.json({ success: true, data: { criteria, ...result, registered: result.items.length, source: 'Provider-neutral STAC discovery with scored selection' }, correlation_id: id });
    } catch (error) {
      res.status(502).json({ success: false, error: { code: 'SATELLITE_STAC_UNAVAILABLE', message: error instanceof Error ? error.message : 'STAC provider unavailable' }, correlation_id: id });
    }
  });

  router.get('/metadata', (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ success: true, data: { items: service.store.list(Number.isFinite(limit) ? limit : 100), count: service.store.count() } });
  });

  router.get('/catalog/items/:metadataId', (req, res) => {
    const item = service.getItemByMetadataId(req.params.metadataId);
    if (!item) { res.status(404).json({ success: false, error: { code: 'SATELLITE_ITEM_NOT_FOUND', message: 'Catalog item was not found.' } }); return; }
    res.json({ success: true, data: item });
  });

  router.post('/metadata/register', (req, res) => {
    const id = correlationId(req);
    const provider = String(req.body?.provider ?? 'cdse') as SatelliteProviderName;
    const collection = req.body?.collection ? String(req.body.collection) as SatelliteCollection : undefined;
    if (!PROVIDER_NAMES.has(provider) || (collection && !COLLECTIONS.has(collection))) { res.status(400).json({ success: false, error: { code: 'INVALID_SATELLITE_METADATA', message: 'provider or collection is invalid.' }, correlation_id: id }); return; }
    try {
      const item = service.register((req.body?.item ?? req.body) as StacItem, provider, collection);
      res.status(201).json({ success: true, data: item, correlation_id: id });
    } catch (error) {
      res.status(422).json({ success: false, error: { code: 'INVALID_SATELLITE_METADATA', message: error instanceof Error ? error.message : 'Metadata is invalid.' }, correlation_id: id });
    }
  });

  router.get('/items/:provider/:collection/:itemId', async (req, res) => {
    const provider = req.params.provider as SatelliteProviderName;
    const collection = req.params.collection as SatelliteCollection;
    if (!PROVIDER_NAMES.has(provider) || !COLLECTIONS.has(collection)) { res.status(400).json({ success: false, error: { code: 'INVALID_SATELLITE_ITEM', message: 'provider or collection is invalid.' } }); return; }
    try { res.json({ success: true, data: await service.getItem(provider, collection, req.params.itemId) }); }
    catch (error) { res.status(502).json({ success: false, error: { code: 'SATELLITE_ITEM_UNAVAILABLE', message: error instanceof Error ? error.message : 'STAC item unavailable.' } }); }
  });

  router.get('/items/:provider/:collection/:itemId/assets', async (req, res) => {
    try {
      const item = await service.getItem(req.params.provider as SatelliteProviderName, req.params.collection as SatelliteCollection, req.params.itemId);
      res.json({ success: true, data: await service.provider(item.provider).getAssets(item) });
    } catch (error) { res.status(502).json({ success: false, error: { code: 'SATELLITE_ASSETS_UNAVAILABLE', message: error instanceof Error ? error.message : 'Assets unavailable.' } }); }
  });

  router.get('/items/:provider/:collection/:itemId/quicklook', async (req, res) => {
    try {
      const item = await service.getItem(req.params.provider as SatelliteProviderName, req.params.collection as SatelliteCollection, req.params.itemId);
      res.json({ success: true, data: { url: await service.provider(item.provider).getQuicklook(item) } });
    } catch (error) { res.status(502).json({ success: false, error: { code: 'SATELLITE_QUICKLOOK_UNAVAILABLE', message: error instanceof Error ? error.message : 'Quicklook unavailable.' } }); }
  });

  router.post('/items/:provider/:collection/:itemId/window', async (req, res) => {
    const bbox = parseBbox(Array.isArray(req.body?.bbox) ? req.body.bbox.join(',') : req.body?.bbox);
    const bands = Array.isArray(req.body?.bands) ? req.body.bands.filter((value: unknown): value is string => typeof value === 'string') : [];
    if (!bbox) { res.status(400).json({ success: false, error: { code: 'INVALID_RASTER_WINDOW', message: 'bbox is required.' } }); return; }
    try {
      const item = await service.getItem(req.params.provider as SatelliteProviderName, req.params.collection as SatelliteCollection, req.params.itemId);
      res.json({ success: true, data: await service.provider(item.provider).getRasterWindow(item, bbox, bands) });
    } catch (error) { res.status(502).json({ success: false, error: { code: 'SATELLITE_WINDOW_UNAVAILABLE', message: error instanceof Error ? error.message : 'Raster window unavailable.' } }); }
  });

  return router;
}
