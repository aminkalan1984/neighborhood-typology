export type SatelliteProviderName = 'cdse' | 'earth-search' | 'nasa-lance' | 'hls';
export type SatelliteCollection = 'sentinel-2-l2a' | 'sentinel-1-grd' | 'hls-s30' | 'hls-l30' | 'modis-nrt';
export type SatelliteSearchPurpose = 'auto' | 'optical' | 'radar' | 'time-series' | 'alert';
export type SatelliteIndexName = 'rgb' | 'false_color' | 'ndvi' | 'ndwi' | 'mndwi' | 'ndbi' | 'ndmi' | 'nbr' | 'vv' | 'vh' | 'vv_vh_ratio';
export type SatelliteTilePalette = 'ndvi' | 'viridis' | 'magma' | 'gray' | 'water' | 'change';

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
  processing_level?: string;
  product_timeliness?: string;
  resolution_m?: number;
  bands?: string[];
  assets: Record<string, SatelliteAssetMetadata>;
  quicklook_url?: string;
  license?: string;
  acquired_age_hours: number;
  freshness_status: 'fresh' | 'stale' | 'unknown';
  selection_score?: number;
  selection?: SatelliteSelectionBreakdown;
  ingested_at?: string;
  registered_at: string;
}

export interface SatelliteValidationMatrix {
  valid: boolean;
  checks: Array<{ name: string; status: 'passed' | 'warning' | 'failed' | 'not_applicable'; message: string; metrics?: Record<string, number | string | boolean> }>;
  errors: string[];
  warnings: string[];
  generated_at: string;
}

export interface SatelliteArtifact {
  artifact_id: string;
  kind: 'band' | 'index' | 'mask' | 'composite' | 'classification';
  name: string;
  relative_path: string;
  checksum_sha256: string;
  bytes: number;
  bounds: [number, number, number, number];
  crs: string | null;
  is_cog: boolean;
  valid_pixel_count: number;
  total_pixel_count: number;
  valid_fraction: number;
  band_count?: number;
  statistics?: { min: number; max: number; mean: number };
}

export interface SatelliteProcessingJob {
  job_id: string;
  job_type?: 'scene' | 'change' | 'composite' | 'segmentation';
  metadata_id: string;
  source_metadata_ids?: string[];
  resolved_metadata_id?: string;
  collection: SatelliteCollection;
  aoi: { bbox: [number, number, number, number]; geometry?: unknown; crs?: string };
  indices: SatelliteIndexName[];
  status: 'queued' | 'downloading' | 'processing' | 'ready' | 'failed';
  progress: number;
  attempts: number;
  artifacts: SatelliteArtifact[];
  validation?: SatelliteValidationMatrix;
  fallback_history?: Array<{ metadata_id: string; provider: string; failed_at: string; error: string }>;
  result?: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface SatelliteFeatureRecord {
  feature_id: string;
  feature: string;
  value: number;
  unit?: string;
  source_item: string;
  metadata_id: string;
  source_job_id?: string;
  source_artifact_id?: string;
  provider: SatelliteProviderName;
  acquired_at: string;
  published_at?: string;
  latency_minutes?: number;
  cloud_cover?: number | null;
  resolution_m?: number;
  mask_fraction: number;
  method: string;
  confidence: number;
  status: 'observed' | 'derived' | 'inferred' | 'synthetic' | 'estimated';
  bbox?: [number, number, number, number];
  geometry?: unknown;
  created_at: string;
  properties?: Record<string, unknown>;
}

export interface SatelliteSearchOptions {
  bbox?: [number, number, number, number];
  datetime?: string;
  collections?: SatelliteCollection[];
  limit?: number;
  maxAgeHours?: number;
  maxCloudCover?: number;
  minimumCoverage?: number;
  purpose?: SatelliteSearchPurpose;
  provider?: 'auto' | SatelliteProviderName;
  signal?: AbortSignal;
}

export interface SatelliteStatusSummary {
  catalog: { items: number; assets: number; jobs: number; features: number; alerts: number; latest_acquisition: string | null; average_latency_minutes: number | null; failed_jobs: number };
  jobs: Record<SatelliteProcessingJob['status'], number>;
  queue: { concurrency: number; active: number; pending: number; completed: number; failed: number };
  cache: { files: number; bytes: number };
  infrastructure: {
    object_storage: { driver: string; status: 'ready' | 'degraded' | 'unconfigured'; details: Record<string, string | number | boolean | null> };
    tile_cache: { driver: string; status: 'ready' | 'degraded' | 'unconfigured'; details: Record<string, string | number | boolean | null> };
  };
  providers: Array<{ provider: SatelliteProviderName; status: 'online' | 'degraded' | 'offline'; last_latency_ms: number | null; last_error: string | null; quota_penalty: number; consecutive_failures?: number; circuit_open_until?: string | null }>;
  latest_usable_image: { datetime: string; provider?: SatelliteProviderName; collection: SatelliteCollection; cloud_cover?: number | null; latency_minutes?: number; job_id: string } | null;
  freshness_sla_hours: number;
}

export interface SatelliteConnectorHealth {
  ok: boolean;
  providers: Array<{ provider: SatelliteProviderName; status: 'online' | 'degraded' | 'offline'; last_latency_ms: number | null; last_error: string | null; quota_penalty: number }>;
  metadata: { records: number; storage: string };
  catalog: SatelliteStatusSummary['catalog'];
}

export interface SatelliteAlertRecord {
  alert_id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  provider?: SatelliteProviderName;
  metadata_id?: string;
  job_id?: string;
  bbox?: [number, number, number, number];
  acknowledged_at?: string;
  created_at: string;
  details?: Record<string, unknown>;
}

export interface SatelliteAuditEvent {
  event_id: string;
  at: string;
  action: string;
  job_id?: string;
  metadata_id?: string;
  actor: string;
  correlation_id?: string;
  details?: Record<string, unknown>;
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers }, ...init });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { message?: string } } | T | null;
  if (!response.ok) throw new Error((payload && typeof payload === 'object' && 'error' in payload ? payload.error?.message : undefined) || `satellite API returned ${response.status}`);
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data as T;
  return payload as T;
}

export async function searchSatelliteMetadata(options: SatelliteSearchOptions = {}): Promise<{
  items: SatelliteItemMetadata[];
  recommended: SatelliteItemMetadata | null;
  providers: SatelliteProviderName[];
  errors: Array<{ provider: SatelliteProviderName; message: string }>;
  fallback?: string;
}> {
  const params = new URLSearchParams();
  if (options.bbox) params.set('bbox', options.bbox.join(','));
  if (options.datetime) params.set('datetime', options.datetime);
  if (options.collections?.length) params.set('collection', options.collections.join(','));
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.maxAgeHours !== undefined) params.set('maxAgeHours', String(options.maxAgeHours));
  if (options.maxCloudCover !== undefined) params.set('maxCloudCover', String(options.maxCloudCover));
  if (options.minimumCoverage !== undefined) params.set('minimumCoverage', String(options.minimumCoverage));
  if (options.purpose) params.set('purpose', options.purpose);
  if (options.provider) params.set('provider', options.provider);
  return api(`/api/satellite/search?${params}`, { signal: options.signal });
}

const EMPTY_SATELLITE_CATALOG: SatelliteStatusSummary['catalog'] = {
  items: 0,
  assets: 0,
  jobs: 0,
  features: 0,
  alerts: 0,
  latest_acquisition: null,
  average_latency_minutes: null,
  failed_jobs: 0,
};

/**
 * Older/standalone SCI processes can answer the health route without the
 * newer catalog fields. Normalize at this boundary so a stale backend can
 * never crash the operations panel during a rolling restart.
 */
export async function getSatelliteConnectorHealth(signal?: AbortSignal): Promise<SatelliteConnectorHealth> {
  const payload = (await api<Partial<SatelliteConnectorHealth> | null>('/api/satellite/health', { signal })) ?? {};
  const catalog = { ...EMPTY_SATELLITE_CATALOG, ...(payload.catalog ?? {}) };
  const metadata = payload.metadata ?? { records: catalog.items, storage: 'unknown' };
  return {
    ok: payload.ok !== false,
    providers: Array.isArray(payload.providers) ? payload.providers : [],
    metadata: { records: Number(metadata.records) || 0, storage: String(metadata.storage || 'unknown') },
    catalog,
  };
}

export async function getSatelliteStatusSummary(signal?: AbortSignal): Promise<SatelliteStatusSummary | null> {
  return (await api<SatelliteStatusSummary | null>('/api/satellite/status/summary', { signal })) ?? null;
}

export async function createSatelliteProcessingJob(input: { metadata_id: string; aoi: { bbox: [number, number, number, number]; geometry?: unknown; crs?: string }; assets?: string[]; indices?: SatelliteIndexName[]; signal?: AbortSignal }): Promise<SatelliteProcessingJob> {
  return api('/api/satellite/pipeline/jobs', { method: 'POST', body: JSON.stringify({ metadata_id: input.metadata_id, aoi: input.aoi, assets: input.assets, indices: input.indices }), signal: input.signal });
}

export async function getSatelliteProcessingJob(jobId: string, signal?: AbortSignal): Promise<SatelliteProcessingJob> { return api(`/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}`, { signal }); }

export async function listSatelliteProcessingJobs(options: { limit?: number; signal?: AbortSignal } = {}): Promise<{ jobs: SatelliteProcessingJob[]; count: number }> {
  const params = new URLSearchParams(); if (options.limit !== undefined) params.set('limit', String(options.limit));
  return api(`/api/satellite/pipeline/jobs${params.size ? `?${params}` : ''}`, { signal: options.signal });
}

export async function retrySatelliteProcessingJob(jobId: string, signal?: AbortSignal): Promise<SatelliteProcessingJob> { return api(`/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST', signal }); }

export async function replaySatelliteProcessingJob(jobId: string, signal?: AbortSignal): Promise<SatelliteProcessingJob> { return api(`/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/replay`, { method: 'POST', signal }); }

export async function backfillSatelliteProcessingJobs(input: { metadataIds: string[]; aoi: SatelliteProcessingJob['aoi']; indices?: SatelliteIndexName[]; signal?: AbortSignal }): Promise<{ jobs: SatelliteProcessingJob[]; count: number }> {
  return api('/api/satellite/pipeline/backfill', { method: 'POST', body: JSON.stringify({ metadata_ids: input.metadataIds, aoi: input.aoi, indices: input.indices }), signal: input.signal });
}

export async function getSatelliteTimeline(options: { artifact?: string; bbox?: [number, number, number, number]; limit?: number; signal?: AbortSignal } = {}): Promise<{
  entries: Array<{ job_id: string; job_type: string; metadata_id: string; datetime: string; provider?: SatelliteProviderName; collection: SatelliteCollection; cloud_cover?: number | null; latency_minutes?: number; artifact: SatelliteArtifact }>;
  temporal?: { observations: Array<{ timestamp: string; value: number | null }>; anomaly: { status: 'stable' | 'anomaly' | 'insufficient_data'; observations: number; anomalies: Array<{ timestamp: string; value: number; robust_z: number }> } };
}> {
  const params = new URLSearchParams(); if (options.artifact) params.set('artifact', options.artifact); if (options.bbox) params.set('bbox', options.bbox.join(',')); if (options.limit) params.set('limit', String(options.limit));
  return api(`/api/satellite/pipeline/timeline?${params}`, { signal: options.signal });
}

export async function getSatelliteFeatures(options: { feature?: string; metadataId?: string; bbox?: [number, number, number, number]; limit?: number; signal?: AbortSignal } = {}): Promise<{ features: SatelliteFeatureRecord[]; count: number }> {
  const params = new URLSearchParams(); if (options.feature) params.set('feature', options.feature); if (options.metadataId) params.set('metadata_id', options.metadataId); if (options.bbox) params.set('bbox', options.bbox.join(',')); if (options.limit) params.set('limit', String(options.limit));
  const payload = await api<Partial<{ features: SatelliteFeatureRecord[]; count: number }> | null>(`/api/satellite/features?${params}`, { signal: options.signal });
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return { features, count: Number.isFinite(payload?.count) ? Number(payload?.count) : features.length };
}

export async function getSatelliteAlerts(options: { limit?: number; signal?: AbortSignal } = {}): Promise<{ alerts: SatelliteAlertRecord[]; count: number }> {
  const params = new URLSearchParams(); if (options.limit) params.set('limit', String(options.limit));
  return api(`/api/satellite/alerts${params.size ? `?${params}` : ''}`, { signal: options.signal });
}

export async function acknowledgeSatelliteAlert(alertId: string, signal?: AbortSignal): Promise<SatelliteAlertRecord> {
  return api(`/api/satellite/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', signal });
}

export async function getSatelliteAuditEvents(options: { jobId?: string; action?: string; limit?: number; signal?: AbortSignal } = {}): Promise<{ events: SatelliteAuditEvent[]; count: number }> {
  const params = new URLSearchParams(); if (options.jobId) params.set('job_id', options.jobId); if (options.action) params.set('action', options.action); if (options.limit) params.set('limit', String(options.limit));
  return api(`/api/satellite/pipeline/audit${params.size ? `?${params}` : ''}`, { signal: options.signal });
}

export async function cleanupSatelliteTileCache(input: { ttlMs?: number; maxBytes?: number; signal?: AbortSignal } = {}): Promise<{ removed: number; removed_bytes: number; remaining: { files: number; bytes: number } }> {
  return api('/api/satellite/pipeline/cache/cleanup', { method: 'POST', body: JSON.stringify({ ttl_ms: input.ttlMs, max_bytes: input.maxBytes }), signal: input.signal });
}

export async function runSatelliteRetention(input: { completedBefore?: string; failedBefore?: string; dryRun?: boolean; signal?: AbortSignal } = {}): Promise<{ candidates: string[]; removed: string[]; bytes: number; object_count: number; dry_run: boolean }> {
  return api('/api/satellite/pipeline/retention', { method: 'POST', body: JSON.stringify({ completed_before: input.completedBefore, failed_before: input.failedBefore, dry_run: input.dryRun ?? true }), signal: input.signal });
}

export async function createSatelliteChange(input: { beforeJobId: string; afterJobId: string; artifact: string; aoi?: SatelliteProcessingJob['aoi']; threshold?: number; signal?: AbortSignal }): Promise<SatelliteProcessingJob> {
  return api('/api/satellite/pipeline/change', { method: 'POST', body: JSON.stringify({ before_job_id: input.beforeJobId, after_job_id: input.afterJobId, artifact: input.artifact, aoi: input.aoi, threshold: input.threshold }), signal: input.signal });
}

export async function createSatelliteComposite(input: { jobIds: string[]; artifact: string; aoi?: SatelliteProcessingJob['aoi']; signal?: AbortSignal }): Promise<SatelliteProcessingJob> {
  return api('/api/satellite/pipeline/composite', { method: 'POST', body: JSON.stringify({ job_ids: input.jobIds, artifact: input.artifact, aoi: input.aoi }), signal: input.signal });
}

export async function createSatelliteSegmentation(input: { jobId: string; artifact: string; classes?: number; aoi?: SatelliteProcessingJob['aoi']; signal?: AbortSignal }): Promise<SatelliteProcessingJob> {
  return api('/api/satellite/pipeline/segment', { method: 'POST', body: JSON.stringify({ job_id: input.jobId, artifact: input.artifact, classes: input.classes, aoi: input.aoi }), signal: input.signal });
}

export async function getSatelliteZonalStatistics(input: { jobId: string; artifact: string; aoi: SatelliteProcessingJob['aoi']; signal?: AbortSignal }): Promise<{ statistics: Record<string, number>; feature: SatelliteFeatureRecord }> {
  return api('/api/satellite/pipeline/statistics/zonal', { method: 'POST', body: JSON.stringify({ job_id: input.jobId, artifact: input.artifact, aoi: input.aoi }), signal: input.signal });
}

export function satelliteArtifactUrl(jobId: string, relativePath: string): string { return `${API_BASE_URL}/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(relativePath)}`; }

export function satelliteArtifactTileUrl(jobId: string, artifactName: string, style: { palette?: SatelliteTilePalette; min?: number; max?: number } = {}): string {
  const params = new URLSearchParams(); if (style.palette) params.set('palette', style.palette); if (style.min !== undefined) params.set('min', String(style.min)); if (style.max !== undefined) params.set('max', String(style.max));
  return `${API_BASE_URL}/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/tiles/${encodeURIComponent(artifactName)}/{z}/{x}/{y}.png${params.size ? `?${params}` : ''}`;
}

export function satelliteArtifactPreviewUrl(jobId: string, artifactName: string, options: { bbox?: [number, number, number, number]; width?: number; height?: number; palette?: SatelliteTilePalette; min?: number; max?: number } = {}): string {
  const params = new URLSearchParams(); if (options.bbox) params.set('bbox', options.bbox.join(',')); if (options.width) params.set('width', String(options.width)); if (options.height) params.set('height', String(options.height)); if (options.palette) params.set('palette', options.palette); if (options.min !== undefined) params.set('min', String(options.min)); if (options.max !== undefined) params.set('max', String(options.max));
  return `${API_BASE_URL}/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/preview/${encodeURIComponent(artifactName)}.png${params.size ? `?${params}` : ''}`;
}

export function satelliteTileJsonUrl(jobId: string, artifactName: string): string { return `${API_BASE_URL}/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/tilejson/${encodeURIComponent(artifactName)}`; }
