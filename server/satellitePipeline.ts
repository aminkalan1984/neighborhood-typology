import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Router, type Request, type Response } from 'express';
import { SatelliteMetadataStore, SatelliteStacService, type SatelliteCollection, type SatelliteItemMetadata } from './satelliteStac';
import { type SatelliteFeatureRecord, SatelliteCatalog } from './satelliteCatalog';
import { buildSatelliteValidationMatrix, detectTemporalAnomalies, type SatelliteValidationMatrix, type TemporalObservation } from './satelliteValidation';
import { BoundedSatelliteJobQueue, SatelliteAuditStore, type SatelliteJobQueue } from './satelliteRuntime';
import {
  createSatelliteObjectStorage,
  createSatelliteTileCache,
  type SatelliteObjectStorage,
  type SatelliteTileCache,
} from './satelliteInfrastructure';

export type SatelliteProcessingStatus = 'queued' | 'downloading' | 'processing' | 'ready' | 'failed';
export type SatelliteIndexName = 'ndvi' | 'ndwi' | 'mndwi' | 'ndbi' | 'ndmi' | 'nbr' | 'vv' | 'vh' | 'vv_vh_ratio' | 'rgb' | 'false_color';
export type SatelliteJobType = 'scene' | 'change' | 'composite' | 'segmentation';

export interface SatelliteAoi {
  bbox: [number, number, number, number];
  geometry?: unknown;
  crs?: string;
}

export interface SatelliteAssetSelection {
  logical_name: string;
  asset_key: string;
  href: string;
  type?: string;
  scale?: number;
  offset?: number;
  nodata?: number;
}

export interface SatelliteCogArtifact {
  artifact_id: string;
  metadata_id: string;
  job_id: string;
  kind: 'band' | 'index' | 'mask' | 'composite' | 'classification';
  name: string;
  relative_path: string;
  media_type: 'image/tiff; application=geotiff; profile=cloud-optimized';
  is_cog: boolean;
  checksum_sha256: string;
  bytes: number;
  width: number;
  height: number;
  dtype: string;
  nodata: number | null;
  crs: string | null;
  bounds: [number, number, number, number];
  native_bounds?: [number, number, number, number];
  overviews: number[];
  valid_pixel_count: number;
  total_pixel_count: number;
  valid_fraction: number;
  statistics?: { min: number; max: number; mean: number };
  source_asset?: string;
  source_artifacts?: string[];
  band_count?: number;
  storage_uri?: string;
  created_at: string;
}

export interface SatelliteProcessingJob {
  job_id: string;
  job_type?: SatelliteJobType;
  metadata_id: string;
  source_metadata_ids?: string[];
  resolved_metadata_id?: string;
  collection: SatelliteCollection;
  aoi: SatelliteAoi;
  assets: SatelliteAssetSelection[];
  indices: SatelliteIndexName[];
  status: SatelliteProcessingStatus;
  progress: number;
  attempts: number;
  output_dir: string;
  artifacts: SatelliteCogArtifact[];
  validation?: SatelliteValidationMatrix;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  fallback_history?: Array<{ metadata_id: string; provider: string; failed_at: string; error: string }>;
  result?: Record<string, unknown>;
}

export interface SatellitePipelineStoreData {
  version: 1;
  jobs: SatelliteProcessingJob[];
}

export interface SatelliteWorkerInput {
  job_id: string;
  metadata_id: string;
  collection: SatelliteCollection;
  aoi: SatelliteAoi;
  assets: SatelliteAssetSelection[];
  indices: SatelliteIndexName[];
  output_dir: string;
}

export interface SatelliteWorkerOutput {
  job_id: string;
  artifacts: Array<Omit<SatelliteCogArtifact, 'artifact_id' | 'metadata_id' | 'job_id' | 'created_at'>>;
  validation: {
    valid: boolean;
    checks: string[];
    errors: string[];
    warnings?: string[];
    qa?: {
      total_pixels: number;
      valid_pixels: number;
      clear_pixels?: number;
      invalid_class_counts?: Record<string, number>;
    };
    aoi_coverage_fraction?: number;
    grids?: Array<{ id: string; crs: string | null; width: number; height: number; transform: number[] }>;
    temporal?: { status: 'stable' | 'anomaly' | 'insufficient_data' | 'not_applicable'; reason?: string };
  };
}

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(SERVER_DIR, 'data');
export const DEFAULT_PIPELINE_STORE_PATH = path.join(DATA_DIR, 'satellite-pipeline.json');
export const DEFAULT_SPATIAL_INDEX_PATH = path.join(DATA_DIR, 'satellite-spatial.sqlite');
export const DEFAULT_PIPELINE_WORK_DIR = path.join(DATA_DIR, 'satellite-pipeline', 'jobs');
export const DEFAULT_PIPELINE_AUDIT_PATH = path.join(DATA_DIR, 'satellite-pipeline-audit.json');
export const DEFAULT_TILE_CACHE_PATH = path.join(DATA_DIR, 'satellite-tile-cache');
const COG_MEDIA_TYPE = 'image/tiff; application=geotiff; profile=cloud-optimized' as const;

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

function safeRelativePath(value: string): string {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) {
    throw new Error('Worker returned an unsafe artifact path');
  }
  return normalized;
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export class SatellitePipelineStore {
  private readonly jobs = new Map<string, SatelliteProcessingJob>();

  constructor(private readonly filePath = DEFAULT_PIPELINE_STORE_PATH) {
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<SatellitePipelineStoreData>;
      for (const job of parsed.jobs ?? []) {
        if (job && typeof job.job_id === 'string') this.jobs.set(job.job_id, job as SatelliteProcessingJob);
      }
    } catch {
      // An optional cache must never prevent the API from starting.
    }
  }

  save(job: SatelliteProcessingJob): SatelliteProcessingJob {
    this.jobs.set(job.job_id, job);
    atomicWrite(this.filePath, { version: 1, jobs: [...this.jobs.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) } satisfies SatellitePipelineStoreData);
    return job;
  }

  get(jobId: string): SatelliteProcessingJob | null { return this.jobs.get(jobId) ?? null; }

  list(limit = 100): SatelliteProcessingJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, Math.max(1, Math.min(500, Math.trunc(limit))));
  }

  count(): number { return this.jobs.size; }

  delete(jobId: string): boolean {
    const removed = this.jobs.delete(jobId);
    if (removed) atomicWrite(this.filePath, { version: 1, jobs: [...this.jobs.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) } satisfies SatellitePipelineStoreData);
    return removed;
  }

  countByStatus(): Record<SatelliteProcessingStatus, number> {
    const counts: Record<SatelliteProcessingStatus, number> = { queued: 0, downloading: 0, processing: 0, ready: 0, failed: 0 };
    for (const job of this.jobs.values()) counts[job.status] += 1;
    return counts;
  }
}

interface SpatialRecord {
  feature_id: string;
  metadata_id: string;
  kind: string;
  minx: number;
  maxx: number;
  miny: number;
  maxy: number;
  properties: Record<string, unknown>;
}

interface SqliteStatement {
  run(...parameters: unknown[]): { lastInsertRowid?: number | bigint };
  get(...parameters: unknown[]): Record<string, unknown> | undefined;
  all(...parameters: unknown[]): Record<string, unknown>[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type DatabaseConstructor = new (filePath: string) => SqliteDatabase;

function loadDatabaseConstructor(): DatabaseConstructor | null {
  try {
    const require = createRequire(import.meta.url);
    const sqlite = require('node:sqlite') as { DatabaseSync?: DatabaseConstructor };
    return sqlite.DatabaseSync ?? null;
  } catch {
    return null;
  }
}

/**
 * Bounding-box index for COGs. Node 22+ uses SQLite R*Tree; older runtimes
 * transparently use an atomic JSON sidecar so development remains portable.
 */
export class SatelliteSpatialIndex {
  private readonly db: SqliteDatabase | null;
  private readonly fallbackPath: string;
  private readonly fallback = new Map<string, SpatialRecord>();

  constructor(private readonly filePath = DEFAULT_SPATIAL_INDEX_PATH) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const Database = loadDatabaseConstructor();
    this.db = Database ? new Database(filePath) : null;
    this.fallbackPath = `${filePath}.json`;
    if (this.db) {
      this.db.exec(`
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS spatial_features (
          id INTEGER PRIMARY KEY,
          feature_id TEXT NOT NULL UNIQUE,
          metadata_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          minx REAL NOT NULL,
          maxx REAL NOT NULL,
          miny REAL NOT NULL,
          maxy REAL NOT NULL,
          properties_json TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS spatial_features_rtree USING rtree(id, minx, maxx, miny, maxy);
        CREATE INDEX IF NOT EXISTS idx_spatial_metadata ON spatial_features(metadata_id);
        CREATE INDEX IF NOT EXISTS idx_spatial_kind ON spatial_features(kind);
      `);
    } else {
      this.loadFallback();
    }
  }

  private loadFallback(): void {
    if (!fs.existsSync(this.fallbackPath)) return;
    try {
      const records = JSON.parse(fs.readFileSync(this.fallbackPath, 'utf8')) as SpatialRecord[];
      for (const record of records) this.fallback.set(record.feature_id, record);
    } catch {
      // Rebuild the optional sidecar on the next upsert.
    }
  }

  upsert(record: SpatialRecord): void {
    if (this.db) {
      const existing = this.db.prepare('SELECT id FROM spatial_features WHERE feature_id = ?').get(record.feature_id);
      const id = existing ? Number(existing.id) : Number(this.db.prepare(`INSERT INTO spatial_features (feature_id, metadata_id, kind, minx, maxx, miny, maxy, properties_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(record.feature_id, record.metadata_id, record.kind, record.minx, record.maxx, record.miny, record.maxy, JSON.stringify(record.properties)).lastInsertRowid);
      if (existing) this.db.prepare(`UPDATE spatial_features SET metadata_id=?, kind=?, minx=?, maxx=?, miny=?, maxy=?, properties_json=? WHERE id=?`).run(record.metadata_id, record.kind, record.minx, record.maxx, record.miny, record.maxy, JSON.stringify(record.properties), id);
      this.db.prepare('DELETE FROM spatial_features_rtree WHERE id=?').run(id);
      this.db.prepare('INSERT INTO spatial_features_rtree (id, minx, maxx, miny, maxy) VALUES (?, ?, ?, ?, ?)').run(id, record.minx, record.maxx, record.miny, record.maxy);
      return;
    }
    this.fallback.set(record.feature_id, record);
    atomicWrite(this.fallbackPath, [...this.fallback.values()]);
  }

  query(bbox: [number, number, number, number], kind?: string): SpatialRecord[] {
    const [minx, miny, maxx, maxy] = bbox;
    if (this.db) {
      const rows = this.db.prepare(`
        SELECT f.feature_id, f.metadata_id, f.kind, f.minx, f.maxx, f.miny, f.maxy, f.properties_json
        FROM spatial_features_rtree r JOIN spatial_features f ON f.id = r.id
        WHERE r.minx <= ? AND r.maxx >= ? AND r.miny <= ? AND r.maxy >= ? ${kind ? 'AND f.kind = ?' : ''}
        ORDER BY f.feature_id
      `).all(...(kind ? [maxx, minx, maxy, miny, kind] : [maxx, minx, maxy, miny]));
      return rows.map((row) => ({ ...row, properties: JSON.parse(String(row.properties_json)) } as unknown as SpatialRecord));
    }
    return [...this.fallback.values()].filter((record) => (!kind || record.kind === kind) && record.minx <= maxx && record.maxx >= minx && record.miny <= maxy && record.maxy >= miny);
  }

  close(): void { this.db?.close(); }
}

function normalizeAssetKey(value: string): string {
  return value.toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
}

function findAsset(item: SatelliteItemMetadata, logicalName: string, aliases: string[]): SatelliteAssetSelection | null {
  const candidates = new Set([logicalName, ...aliases].map(normalizeAssetKey));
  for (const [assetKey, asset] of Object.entries(item.assets)) {
    const names = [assetKey, asset.title ?? '', ...(asset.bands ?? []).flatMap((band) => [band.name ?? '', band.common_name ?? ''])].map(normalizeAssetKey);
    if (names.some((name) => candidates.has(name) || [...candidates].some((candidate) => name.startsWith(`${candidate}_`) || candidate.startsWith(`${name}_`)))) {
      return { logical_name: logicalName, asset_key: assetKey, href: asset.href, type: asset.type, scale: asset.scale ?? asset.bands?.[0]?.scale, offset: asset.offset ?? asset.bands?.[0]?.offset, nodata: asset.nodata ?? asset.bands?.[0]?.nodata };
    }
  }
  return null;
}

const S2_DEFAULT_ASSETS: Array<[string, string[]]> = [
  ['blue', ['b02_10m', 'b02']],
  ['green', ['b03_10m', 'b03']],
  ['red', ['b04_10m', 'b04']],
  ['nir', ['b08_10m', 'b8_10m', 'b08', 'b8']],
  ['swir1', ['b11_20m', 'b11', 'swir16', 'swir1']],
  ['swir2', ['b12_20m', 'b12', 'swir22', 'swir2']],
  ['scl', ['scl_20m', 'scl']],
];

const S1_DEFAULT_ASSETS: Array<[string, string[]]> = [
  ['vv', ['vv', 'measurement_vv', 'sigma0_vv']],
  ['vh', ['vh', 'measurement_vh', 'sigma0_vh']],
];

const HLS_DEFAULT_ASSETS: Array<[string, string[]]> = [
  ['blue', ['b02', 'blue']],
  ['green', ['b03', 'green']],
  ['red', ['b04', 'red', 'sur_refl_b01']],
  ['nir', ['b8a', 'b08', 'b05', 'nir', 'sur_refl_b02']],
  ['swir1', ['b11', 'b06', 'swir1', 'swir16']],
  ['swir2', ['b12', 'b07', 'swir2', 'swir22']],
  ['qa', ['fmask', 'qa', 'quality']],
];

function opticalCollection(collection: SatelliteCollection): boolean {
  return collection !== 'sentinel-1-grd';
}

export function selectSatelliteAssets(item: SatelliteItemMetadata, requested: string[] = []): SatelliteAssetSelection[] {
  const definitions = item.collection === 'sentinel-1-grd' ? S1_DEFAULT_ASSETS : item.collection === 'sentinel-2-l2a' ? S2_DEFAULT_ASSETS : HLS_DEFAULT_ASSETS;
  const wanted = requested.length > 0 ? new Set(requested.map((value) => value.trim().toLowerCase())) : null;
  return definitions.flatMap(([logicalName, aliases]) => {
    if (wanted && !wanted.has(logicalName)) return [];
    const asset = findAsset(item, logicalName, aliases);
    return asset ? [asset] : [];
  });
}

export function defaultSatelliteIndices(collection: SatelliteCollection): SatelliteIndexName[] {
  return opticalCollection(collection) ? ['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr'] : ['vv', 'vh', 'vv_vh_ratio'];
}

function validBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((part) => typeof part === 'number' && Number.isFinite(part)) && value[0] < value[2] && value[1] < value[3] && value[0] >= -180 && value[2] <= 180 && value[1] >= -90 && value[3] <= 90;
}

export interface SatellitePipelineServiceOptions {
  store?: SatellitePipelineStore;
  spatialIndex?: SatelliteSpatialIndex;
  now?: () => number;
  worker?: (input: SatelliteWorkerInput) => Promise<SatelliteWorkerOutput>;
  workDir?: string;
  catalog?: SatelliteCatalog;
  stac?: SatelliteStacService;
  maxAssetFailovers?: number;
  audit?: SatelliteAuditStore;
  queue?: SatelliteJobQueue;
  objectStorage?: SatelliteObjectStorage;
  tileCache?: SatelliteTileCache;
}

export class SatellitePipelineService {
  readonly store: SatellitePipelineStore;
  readonly spatialIndex: SatelliteSpatialIndex;
  private readonly now: () => number;
  private readonly worker: (input: SatelliteWorkerInput) => Promise<SatelliteWorkerOutput>;
  private readonly workDir: string;
  readonly catalog: SatelliteCatalog;
  private readonly stac: SatelliteStacService | null;
  private readonly maxAssetFailovers: number;
  readonly audit: SatelliteAuditStore;
  readonly objectStorage: SatelliteObjectStorage;
  readonly tileCache: SatelliteTileCache;

  constructor(private readonly metadata: Pick<SatelliteMetadataStore, 'getByMetadataId'>, options: SatellitePipelineServiceOptions = {}) {
    this.store = options.store ?? new SatellitePipelineStore();
    this.spatialIndex = options.spatialIndex ?? new SatelliteSpatialIndex();
    this.now = options.now ?? Date.now;
    this.workDir = options.workDir ?? DEFAULT_PIPELINE_WORK_DIR;
    this.worker = options.worker ?? runPythonSatelliteWorker;
    this.catalog = options.catalog ?? (metadata instanceof SatelliteMetadataStore ? metadata.catalog : new SatelliteCatalog());
    this.stac = options.stac ?? null;
    this.maxAssetFailovers = Math.max(0, Math.min(4, Math.trunc(options.maxAssetFailovers ?? 2)));
    this.audit = options.audit ?? new SatelliteAuditStore(DEFAULT_PIPELINE_AUDIT_PATH);
    this.objectStorage = options.objectStorage ?? createSatelliteObjectStorage({ workDir: this.workDir });
    this.tileCache = options.tileCache ?? createSatelliteTileCache({ root: DEFAULT_TILE_CACHE_PATH });
  }

  health() {
    return {
      jobs: this.store.countByStatus(),
      storage: { jobs: DEFAULT_PIPELINE_STORE_PATH, spatial_index: DEFAULT_SPATIAL_INDEX_PATH, cog_root: this.workDir, catalog: this.catalog.filePath, audit: this.audit.filePath },
      infrastructure: { object_storage: this.objectStorage.health(), tile_cache: this.tileCache.health() },
      worker: 'python-rasterio',
      failover: { enabled: Boolean(this.stac), max_attempts: this.maxAssetFailovers },
    };
  }

  createJob(input: { metadata_id: string; aoi: SatelliteAoi; assets?: string[]; indices?: SatelliteIndexName[] }): SatelliteProcessingJob {
    if (!validBbox(input.aoi?.bbox)) throw new Error('aoi.bbox must be a valid [west, south, east, north] array');
    const item = this.metadata.getByMetadataId(input.metadata_id);
    if (!item) throw new Error('metadata_id was not found in the satellite metadata catalog');
    const selected = selectSatelliteAssets(item, input.assets ?? []);
    if (selected.length === 0) throw new Error('No usable raster assets were found for this item');
    const allowedIndices = new Set<SatelliteIndexName>(opticalCollection(item.collection) ? ['rgb', 'false_color', 'ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr'] : ['vv', 'vh', 'vv_vh_ratio']);
    const requestedIndices = input.indices?.length ? input.indices : defaultSatelliteIndices(item.collection);
    const indices = requestedIndices.filter((name): name is SatelliteIndexName => allowedIndices.has(name));
    const created = new Date(this.now()).toISOString();
    const jobId = crypto.randomUUID();
    const job: SatelliteProcessingJob = {
      job_id: jobId,
      job_type: 'scene',
      metadata_id: input.metadata_id,
      source_metadata_ids: [input.metadata_id],
      resolved_metadata_id: input.metadata_id,
      collection: item.collection,
      aoi: input.aoi,
      assets: selected,
      indices,
      status: 'queued',
      progress: 0,
      attempts: 0,
      output_dir: path.join(this.workDir, jobId),
      artifacts: [],
      validation: undefined,
      error: null,
      created_at: created,
      updated_at: created,
      fallback_history: [],
    };
    const saved = this.store.save(job);
    this.catalog.recordJob(saved as unknown as Record<string, unknown>);
    this.audit.record({ action: 'job_created', actor: 'pipeline', job_id: saved.job_id, metadata_id: saved.metadata_id, details: { collection: saved.collection, indices: saved.indices, aoi: saved.aoi } });
    return saved;
  }

  async run(jobId: string): Promise<SatelliteProcessingJob> {
    const current = this.store.get(jobId);
    if (!current) throw new Error('Processing job was not found');
    if (current.status === 'ready') return current;
    const item = this.metadata.getByMetadataId(current.metadata_id);
    if (!item) return this.fail(current, 'Source metadata was removed from the catalog');
    const downloading = this.store.save({ ...current, status: 'downloading', progress: 10, attempts: current.attempts + 1, started_at: new Date(this.now()).toISOString(), updated_at: new Date(this.now()).toISOString(), error: null });
    this.catalog.recordJob(downloading as unknown as Record<string, unknown>);
    this.audit.record({ action: 'job_downloading', actor: 'pipeline', job_id: downloading.job_id, metadata_id: downloading.metadata_id, details: { attempt: downloading.attempts } });
    let activeJob = downloading;
    try {
      const job = this.store.save({ ...downloading, status: 'processing', progress: 35, updated_at: new Date(this.now()).toISOString() });
      this.catalog.recordJob(job as unknown as Record<string, unknown>);
      this.audit.record({ action: 'job_processing', actor: 'pipeline', job_id: job.job_id, metadata_id: job.metadata_id });
      activeJob = job;
      let output: SatelliteWorkerOutput;
      try {
        output = await this.worker({ job_id: activeJob.job_id, metadata_id: activeJob.metadata_id, collection: activeJob.collection, aoi: activeJob.aoi, assets: activeJob.assets, indices: activeJob.indices, output_dir: activeJob.output_dir });
      } catch (firstError) {
        if (!this.stac || this.maxAssetFailovers <= 0) throw firstError;
        const candidates = await this.stac.getProcessingCandidates(activeJob.metadata_id, activeJob.aoi.bbox);
        let lastError: unknown = firstError;
        let attempts = 0;
        for (const candidate of candidates.filter((item) => item.metadata_id !== activeJob.metadata_id).slice(0, this.maxAssetFailovers)) {
          attempts += 1;
          const message = lastError instanceof Error ? lastError.message : 'asset processing failed';
          const failedMetadataId = activeJob.metadata_id;
          const failedProvider = this.metadata.getByMetadataId(failedMetadataId)?.provider ?? item.provider;
          const history = [...(activeJob.fallback_history ?? []), { metadata_id: failedMetadataId, provider: failedProvider, failed_at: new Date(this.now()).toISOString(), error: message }];
          activeJob = this.store.save({ ...activeJob, metadata_id: candidate.metadata_id, resolved_metadata_id: candidate.metadata_id, collection: candidate.collection, assets: selectSatelliteAssets(candidate), source_metadata_ids: [...new Set([...(activeJob.source_metadata_ids ?? []), candidate.metadata_id])], fallback_history: history, progress: 20, updated_at: new Date(this.now()).toISOString() });
          this.catalog.recordJob(activeJob as unknown as Record<string, unknown>);
          this.audit.record({ action: 'provider_failover', actor: 'pipeline', job_id: activeJob.job_id, metadata_id: candidate.metadata_id, details: { failed_metadata_id: failedMetadataId, failed_provider: failedProvider, selected_provider: candidate.provider, error: message } });
          try {
            output = await this.worker({ job_id: activeJob.job_id, metadata_id: activeJob.metadata_id, collection: activeJob.collection, aoi: activeJob.aoi, assets: activeJob.assets, indices: activeJob.indices, output_dir: activeJob.output_dir });
            break;
          } catch (error) {
            lastError = error;
            if (attempts >= this.maxAssetFailovers) throw lastError;
          }
        }
        if (!output!) throw lastError;
      }
      if (!output.validation.valid) throw new Error(output.validation.errors.join('; ') || 'COG validation failed');
      const artifacts = await Promise.all(output.artifacts.map((artifact) => this.persistArtifact(activeJob, artifact)));
      const firstBounds = artifacts[0]?.bounds ?? activeJob.aoi.bbox;
      const temporalArtifact = artifacts.find((artifact) => artifact.kind === 'index' && typeof artifact.statistics?.mean === 'number');
      const activeItem = this.metadata.getByMetadataId(activeJob.metadata_id) ?? item;
      const temporal = temporalArtifact
        ? [
            ...this.temporalSeries(temporalArtifact.name, activeJob.aoi.bbox).observations,
            { timestamp: activeItem.datetime, value: temporalArtifact.statistics!.mean },
          ]
        : undefined;
      const validation = output.validation.qa && output.validation.grids
        ? buildSatelliteValidationMatrix({
            aoi: activeJob.aoi.bbox,
            output_bounds: firstBounds,
            qa: output.validation.qa,
            grids: output.validation.grids,
            temporal,
            generated_at: new Date(this.now()).toISOString(),
          })
        : undefined;
      if (validation && !validation.valid) throw new Error(validation.errors.join('; '));
      for (const artifact of artifacts) {
        this.spatialIndex.upsert({ feature_id: artifact.artifact_id, metadata_id: artifact.metadata_id, kind: artifact.kind, minx: artifact.bounds[0], maxx: artifact.bounds[2], miny: artifact.bounds[1], maxy: artifact.bounds[3], properties: { name: artifact.name, relative_path: artifact.relative_path, is_cog: artifact.is_cog, checksum_sha256: artifact.checksum_sha256 } });
        if (artifact.kind === 'index' && artifact.statistics?.mean !== undefined) {
          const source = activeItem;
          const feature: SatelliteFeatureRecord = {
            feature_id: artifact.artifact_id,
            feature: `${artifact.name}_mean`, value: artifact.statistics.mean, unit: artifact.name.startsWith('nd') ? 'ratio' : undefined,
            source_item: source.item_id, metadata_id: source.metadata_id, source_job_id: activeJob.job_id, source_artifact_id: artifact.artifact_id,
            provider: source.provider, acquired_at: source.datetime, published_at: source.published_datetime, latency_minutes: source.latency_minutes,
            cloud_cover: source.cloud_cover, resolution_m: source.resolution_m, mask_fraction: 1 - artifact.valid_fraction,
            method: 'COG artifact statistics after QA/cloud mask', confidence: validation ? (validation.valid ? 0.9 : 0.5) : 0.75,
            status: 'derived', bbox: artifact.bounds, created_at: new Date(this.now()).toISOString(), properties: { statistics: artifact.statistics, validation, source_license: source.license, source_url: source.source_url },
          };
          this.catalog.upsertFeature(feature);
        }
      }
      const temporalCheck = validation?.checks.find((check) => check.name === 'temporal-anomaly');
      if (temporalCheck?.status === 'warning') this.catalog.addAlert({ type: 'temporal_anomaly', severity: 'warning', title: 'Satellite temporal anomaly requires review', message: temporalCheck.message, provider: activeItem.provider, metadata_id: activeItem.metadata_id, job_id: activeJob.job_id, bbox: activeJob.aoi.bbox, details: temporalCheck.metrics });
      for (const warning of validation?.warnings ?? []) this.catalog.addAlert({ type: 'quality', severity: 'warning', title: 'Satellite quality validation warning', message: warning, provider: activeItem.provider, metadata_id: activeItem.metadata_id, job_id: activeJob.job_id, bbox: activeJob.aoi.bbox });
      const ready = this.store.save({ ...activeJob, status: 'ready', progress: 100, artifacts, validation, completed_at: new Date(this.now()).toISOString(), updated_at: new Date(this.now()).toISOString(), result: { provider: activeItem.provider, source_item: activeItem.item_id } });
      this.catalog.recordJob(ready as unknown as Record<string, unknown>);
      this.audit.record({ action: 'job_ready', actor: 'pipeline', job_id: ready.job_id, metadata_id: ready.metadata_id, details: { artifacts: artifacts.map((artifact) => artifact.name), validation_valid: validation?.valid ?? output.validation.valid } });
      return ready;
    } catch (error) {
      return this.fail(activeJob ?? downloading, error instanceof Error ? error.message : 'Satellite processing failed');
    }
  }

  retry(jobId: string): SatelliteProcessingJob {
    const current = this.store.get(jobId);
    if (!current) throw new Error('Processing job was not found');
    if (current.status !== 'failed') throw new Error('Only failed processing jobs can be retried');
    const reset: SatelliteProcessingJob = {
      ...current,
      status: 'queued',
      progress: 0,
      error: null,
      artifacts: [],
      updated_at: new Date(this.now()).toISOString(),
    };
    const saved = this.store.save(reset);
    this.catalog.recordJob(saved as unknown as Record<string, unknown>);
    this.audit.record({ action: 'job_retry_queued', actor: 'api', job_id: saved.job_id, metadata_id: saved.metadata_id, details: { attempts: saved.attempts } });
    return saved;
  }

  timeline(options: { artifact?: string; bbox?: [number, number, number, number]; limit?: number } = {}): Array<{ job: SatelliteProcessingJob; item: SatelliteItemMetadata | null; artifact: SatelliteCogArtifact }> {
    const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 100)));
    return this.store.list(500).flatMap((job) => {
      if (job.status !== 'ready') return [];
      const artifact = options.artifact ? job.artifacts.find((candidate) => candidate.name === options.artifact) : job.artifacts.find((candidate) => candidate.kind === 'index') ?? job.artifacts[0];
      if (!artifact) return [];
      if (options.bbox && !(artifact.bounds[0] <= options.bbox[2] && artifact.bounds[2] >= options.bbox[0] && artifact.bounds[1] <= options.bbox[3] && artifact.bounds[3] >= options.bbox[1])) return [];
      return [{ job, item: this.metadata.getByMetadataId(job.metadata_id), artifact }];
    }).sort((a, b) => (b.item?.datetime ?? b.job.created_at).localeCompare(a.item?.datetime ?? a.job.created_at)).slice(0, limit);
  }

  temporalSeries(artifactName: string, bbox?: [number, number, number, number]): { observations: TemporalObservation[]; anomaly: ReturnType<typeof detectTemporalAnomalies> } {
    const observations = this.timeline({ artifact: artifactName, bbox, limit: 500 }).flatMap(({ item, job, artifact }) => artifact.statistics?.mean === undefined ? [] : [{ timestamp: item?.datetime ?? job.completed_at ?? job.updated_at, value: artifact.statistics.mean }]);
    return { observations, anomaly: detectTemporalAnomalies(observations) };
  }

  async zonalStatistics(jobId: string, artifactName: string, aoi: SatelliteAoi): Promise<{ statistics: Record<string, number>; feature: SatelliteFeatureRecord }> {
    const { job, artifact, sourcePath } = this.requireArtifact(jobId, artifactName);
    const output = await runPythonSatelliteAnalysis({ operation: 'zonal', source: sourcePath, aoi }, path.join(job.output_dir, 'analytics')) as { statistics?: Record<string, number> };
    if (!output.statistics || typeof output.statistics.mean !== 'number') throw new Error('Zonal analysis returned no valid pixels');
    const item = this.metadata.getByMetadataId(job.metadata_id);
    if (!item) throw new Error('Source metadata was not found');
    const feature: SatelliteFeatureRecord = {
      feature_id: `${artifact.artifact_id}:zonal:${crypto.createHash('sha1').update(JSON.stringify(aoi)).digest('hex').slice(0, 16)}`,
      feature: `${artifact.name}_mean`, value: output.statistics.mean, unit: artifact.name.startsWith('nd') ? 'ratio' : undefined,
      source_item: item.item_id, metadata_id: item.metadata_id, source_job_id: job.job_id, source_artifact_id: artifact.artifact_id,
      provider: item.provider, acquired_at: item.datetime, published_at: item.published_datetime, latency_minutes: item.latency_minutes,
      cloud_cover: item.cloud_cover, resolution_m: item.resolution_m, mask_fraction: 1 - Number(output.statistics.valid_fraction ?? artifact.valid_fraction),
      method: 'polygon-raster mask + zonal descriptive statistics', confidence: Math.max(0.2, Math.min(0.98, Number(output.statistics.valid_fraction ?? artifact.valid_fraction) * 0.95)),
      status: 'derived', bbox: aoi.bbox, geometry: aoi.geometry, created_at: new Date(this.now()).toISOString(), properties: { statistics: output.statistics },
    };
    this.catalog.upsertFeature(feature);
    return { statistics: output.statistics, feature };
  }

  async createChangeJob(input: { beforeJobId: string; afterJobId: string; artifactName: string; aoi?: SatelliteAoi; threshold?: number }): Promise<SatelliteProcessingJob> {
    const before = this.requireArtifact(input.beforeJobId, input.artifactName);
    const after = this.requireArtifact(input.afterJobId, input.artifactName);
    const created = new Date(this.now()).toISOString();
    const jobId = crypto.randomUUID();
    const outputDir = path.join(this.workDir, jobId);
    const pending: SatelliteProcessingJob = {
      job_id: jobId, job_type: 'change', metadata_id: after.job.metadata_id, source_metadata_ids: [before.job.metadata_id, after.job.metadata_id], resolved_metadata_id: after.job.metadata_id,
      collection: after.job.collection, aoi: input.aoi ?? after.job.aoi, assets: [], indices: [], status: 'processing', progress: 45, attempts: 1,
      output_dir: outputDir, artifacts: [], error: null, created_at: created, updated_at: created,
    };
    this.store.save(pending); this.catalog.recordJob(pending as unknown as Record<string, unknown>);
    try {
      const output = await runPythonSatelliteAnalysis({ operation: 'change', before: before.sourcePath, after: after.sourcePath, output: path.join(outputDir, `change-${input.artifactName}.tif`), name: `change_${input.artifactName}`, threshold: input.threshold ?? 0.1, aoi: pending.aoi }, outputDir) as { statistics?: Record<string, number>; artifact?: Omit<SatelliteCogArtifact, 'artifact_id' | 'metadata_id' | 'job_id' | 'created_at'> };
      if (!output.artifact) throw new Error('Change worker returned no artifact');
      const artifact = await this.persistArtifact(pending, output.artifact);
      const ready = this.store.save({ ...pending, status: 'ready', progress: 100, artifacts: [artifact], result: { statistics: output.statistics ?? {}, before_job_id: before.job.job_id, after_job_id: after.job.job_id }, completed_at: new Date(this.now()).toISOString(), updated_at: new Date(this.now()).toISOString() });
      this.catalog.recordJob(ready as unknown as Record<string, unknown>);
      this.spatialIndex.upsert({ feature_id: artifact.artifact_id, metadata_id: artifact.metadata_id, kind: artifact.kind, minx: artifact.bounds[0], maxx: artifact.bounds[2], miny: artifact.bounds[1], maxy: artifact.bounds[3], properties: { name: artifact.name, checksum_sha256: artifact.checksum_sha256 } });
      const mean = output.statistics?.mean;
      const item = this.metadata.getByMetadataId(after.job.metadata_id);
      if (item && typeof mean === 'number') this.catalog.upsertFeature({ feature_id: artifact.artifact_id, feature: `${input.artifactName}_change_mean`, value: mean, unit: 'difference', source_item: item.item_id, metadata_id: item.metadata_id, source_job_id: jobId, source_artifact_id: artifact.artifact_id, provider: item.provider, acquired_at: item.datetime, published_at: item.published_datetime, latency_minutes: item.latency_minutes, cloud_cover: item.cloud_cover, resolution_m: item.resolution_m, mask_fraction: 1 - artifact.valid_fraction, method: 'co-registered after-minus-before COG', confidence: 0.86, status: 'derived', bbox: artifact.bounds, created_at: new Date(this.now()).toISOString(), properties: { ...output.statistics, before_metadata_id: before.job.metadata_id } });
      return ready;
    } catch (error) { return this.fail(pending, error instanceof Error ? error.message : 'Change processing failed'); }
  }

  async createCompositeJob(input: { jobIds: string[]; artifactName: string; aoi?: SatelliteAoi }): Promise<SatelliteProcessingJob> {
    if (input.jobIds.length < 2) throw new Error('At least two ready jobs are required');
    const sources = input.jobIds.map((jobId) => this.requireArtifact(jobId, input.artifactName));
    const created = new Date(this.now()).toISOString();
    const jobId = crypto.randomUUID();
    const outputDir = path.join(this.workDir, jobId);
    const pending: SatelliteProcessingJob = { job_id: jobId, job_type: 'composite', metadata_id: sources[0].job.metadata_id, source_metadata_ids: sources.map((source) => source.job.metadata_id), resolved_metadata_id: sources[0].job.metadata_id, collection: sources[0].job.collection, aoi: input.aoi ?? sources[0].job.aoi, assets: [], indices: [], status: 'processing', progress: 45, attempts: 1, output_dir: outputDir, artifacts: [], error: null, created_at: created, updated_at: created };
    this.store.save(pending); this.catalog.recordJob(pending as unknown as Record<string, unknown>);
    try {
      const output = await runPythonSatelliteAnalysis({ operation: 'composite', sources: sources.map((source) => source.sourcePath), output: path.join(outputDir, `composite-${input.artifactName}.tif`), name: `composite_${input.artifactName}`, aoi: pending.aoi }, outputDir) as { observations?: number; artifact?: Omit<SatelliteCogArtifact, 'artifact_id' | 'metadata_id' | 'job_id' | 'created_at'> };
      if (!output.artifact) throw new Error('Composite worker returned no artifact');
      const artifact = await this.persistArtifact(pending, output.artifact);
      const ready = this.store.save({ ...pending, status: 'ready', progress: 100, artifacts: [artifact], result: { observations: output.observations ?? sources.length }, completed_at: new Date(this.now()).toISOString(), updated_at: new Date(this.now()).toISOString() });
      this.catalog.recordJob(ready as unknown as Record<string, unknown>);
      return ready;
    } catch (error) { return this.fail(pending, error instanceof Error ? error.message : 'Composite processing failed'); }
  }

  async createSegmentationJob(input: { jobId: string; artifactName: string; aoi?: SatelliteAoi; classes?: number }): Promise<SatelliteProcessingJob> {
    const source = this.requireArtifact(input.jobId, input.artifactName);
    const created = new Date(this.now()).toISOString();
    const jobId = crypto.randomUUID();
    const outputDir = path.join(this.workDir, jobId);
    const pending: SatelliteProcessingJob = { job_id: jobId, job_type: 'segmentation', metadata_id: source.job.metadata_id, source_metadata_ids: [source.job.metadata_id], resolved_metadata_id: source.job.metadata_id, collection: source.job.collection, aoi: input.aoi ?? source.job.aoi, assets: [], indices: [], status: 'processing', progress: 45, attempts: 1, output_dir: outputDir, artifacts: [], error: null, created_at: created, updated_at: created };
    this.store.save(pending); this.catalog.recordJob(pending as unknown as Record<string, unknown>);
    try {
      const output = await runPythonSatelliteAnalysis({ operation: 'segment', source: source.sourcePath, output: path.join(outputDir, `segmentation-${input.artifactName}.tif`), name: `segmentation_${input.artifactName}`, classes: input.classes ?? 4, aoi: pending.aoi }, outputDir) as { model?: string; thresholds?: number[]; class_counts?: Record<string, number>; artifact?: Omit<SatelliteCogArtifact, 'artifact_id' | 'metadata_id' | 'job_id' | 'created_at'> };
      if (!output.artifact) throw new Error('Segmentation worker returned no artifact');
      const artifact = await this.persistArtifact(pending, output.artifact);
      const ready = this.store.save({ ...pending, status: 'ready', progress: 100, artifacts: [artifact], result: { model: output.model, thresholds: output.thresholds, class_counts: output.class_counts }, completed_at: new Date(this.now()).toISOString(), updated_at: new Date(this.now()).toISOString() });
      this.catalog.recordJob(ready as unknown as Record<string, unknown>);
      return ready;
    } catch (error) { return this.fail(pending, error instanceof Error ? error.message : 'Segmentation failed'); }
  }

  tileCacheMetrics() { return this.tileCache.metrics(); }

  cleanupTileCache(options: { ttlMs?: number; maxBytes?: number } = {}) { return this.tileCache.cleanup(options); }

  recoverInterruptedJobs(): SatelliteProcessingJob[] {
    const recovered: SatelliteProcessingJob[] = [];
    for (const job of this.store.list(10_000)) {
      if (!['queued', 'downloading', 'processing'].includes(job.status)) continue;
      const next = this.store.save({
        ...job,
        status: 'queued',
        progress: 0,
        error: null,
        updated_at: new Date(this.now()).toISOString(),
        result: { ...(job.result ?? {}), recovered_after_restart: true },
      });
      this.catalog.recordJob(next as unknown as Record<string, unknown>);
      this.audit.record({ action: 'job_recovered', actor: 'startup', job_id: next.job_id, metadata_id: next.metadata_id, details: { previous_status: job.status } });
      recovered.push(next);
    }
    return recovered;
  }

  replayJob(jobId: string): SatelliteProcessingJob {
    const source = this.store.get(jobId);
    if (!source) throw new Error('Processing job was not found');
    if ((source.job_type ?? 'scene') !== 'scene') throw new Error('Only scene ingestion jobs can be replayed directly');
    const replay = this.createJob({ metadata_id: source.metadata_id, aoi: source.aoi, assets: source.assets.map((asset) => asset.logical_name), indices: source.indices });
    const saved = this.store.save({ ...replay, result: { replay_of: source.job_id }, source_metadata_ids: [...new Set([...(source.source_metadata_ids ?? []), source.metadata_id])] });
    this.catalog.recordJob(saved as unknown as Record<string, unknown>);
    this.audit.record({ action: 'job_replayed', actor: 'api', job_id: saved.job_id, metadata_id: saved.metadata_id, details: { source_job_id: source.job_id } });
    return saved;
  }

  createBackfillJobs(input: { metadataIds: string[]; aoi: SatelliteAoi; indices?: SatelliteIndexName[] }): SatelliteProcessingJob[] {
    const unique = [...new Set(input.metadataIds.map((value) => value.trim()).filter(Boolean))].slice(0, 100);
    if (unique.length === 0) throw new Error('At least one metadata_id is required for backfill');
    const jobs = unique.map((metadataId) => this.createJob({ metadata_id: metadataId, aoi: input.aoi, indices: input.indices }));
    this.audit.record({ action: 'backfill_created', actor: 'api', details: { jobs: jobs.map((job) => job.job_id), metadata_ids: unique, aoi: input.aoi } });
    return jobs;
  }

  async enforceRetention(options: { completedBefore?: string; failedBefore?: string; dryRun?: boolean } = {}): Promise<{ candidates: string[]; removed: string[]; bytes: number; object_count: number; dry_run: boolean }> {
    const completedBefore = Date.parse(options.completedBefore ?? new Date(this.now() - 30 * 24 * 3_600_000).toISOString());
    const failedBefore = Date.parse(options.failedBefore ?? new Date(this.now() - 14 * 24 * 3_600_000).toISOString());
    const dryRun = options.dryRun !== false;
    const candidates = this.store.list(10_000).filter((job) => {
      const timestamp = Date.parse(job.completed_at ?? job.updated_at);
      return (job.status === 'ready' && timestamp < completedBefore) || (job.status === 'failed' && timestamp < failedBefore);
    });
    if (dryRun) return { candidates: candidates.map((job) => job.job_id), removed: [], bytes: 0, object_count: 0, dry_run: true };
    const root = path.resolve(this.workDir);
    let bytes = 0;
    let objectCount = 0;
    const removed: string[] = [];
    for (const job of candidates) {
      const directory = path.resolve(job.output_dir);
      if (directory !== root && directory.startsWith(`${root}${path.sep}`) && fs.existsSync(directory)) {
        const stack = [directory];
        while (stack.length > 0) {
          const current = stack.pop()!;
          for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(target);
            else bytes += fs.statSync(target).size;
          }
        }
      }
      objectCount += (await this.objectStorage.deletePrefix(job.job_id)).deleted;
      if (directory !== root && directory.startsWith(`${root}${path.sep}`) && fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
      if (this.store.delete(job.job_id)) removed.push(job.job_id);
      this.audit.record({ action: 'job_retained_deleted', actor: 'retention', job_id: job.job_id, metadata_id: job.metadata_id });
    }
    return { candidates: candidates.map((job) => job.job_id), removed, bytes, object_count: objectCount, dry_run: false };
  }

  evaluateOperationalAlerts(): void {
    const slaHours = Math.max(1, Number(process.env.SATELLITE_FRESHNESS_SLA_HOURS ?? 24));
    const latest = this.timeline({ limit: 1 })[0];
    const latestAt = latest?.item?.datetime ?? latest?.job.completed_at ?? latest?.job.updated_at;
    const ageHours = latestAt ? Math.max(0, (this.now() - Date.parse(latestAt)) / 3_600_000) : Number.POSITIVE_INFINITY;
    if (ageHours > slaHours) {
      const bucket = Math.floor(this.now() / (6 * 3_600_000));
      this.catalog.addAlert({ alert_id: `freshness:${bucket}`, type: 'freshness_sla', severity: ageHours > slaHours * 2 ? 'critical' : 'warning', title: 'Satellite freshness SLA breached', message: Number.isFinite(ageHours) ? `Latest usable image is ${ageHours.toFixed(1)} hours old.` : 'No usable processed satellite image is available.', job_id: latest?.job.job_id, metadata_id: latest?.job.metadata_id, bbox: latest?.job.aoi.bbox, details: { age_hours: ageHours, sla_hours: slaHours } });
    }
    for (const provider of this.stac?.health() ?? []) {
      if (provider.status === 'online' && provider.consecutive_failures === 0) continue;
      const bucket = Math.floor(this.now() / (6 * 3_600_000));
      this.catalog.addAlert({ alert_id: `provider:${provider.provider}:${bucket}`, type: 'provider_health', severity: provider.status === 'offline' && provider.failures > 0 ? 'critical' : 'warning', title: `Satellite provider ${provider.provider} is ${provider.status}`, message: provider.last_error ?? `${provider.consecutive_failures} consecutive provider failures.`, provider: provider.provider, details: provider as unknown as Record<string, unknown> });
    }
  }

  private requireArtifact(jobId: string, artifactName: string): { job: SatelliteProcessingJob; artifact: SatelliteCogArtifact; sourcePath: string } {
    const job = this.store.get(jobId);
    if (!job || job.status !== 'ready') throw new Error('Ready processing job was not found');
    const artifact = job.artifacts.find((candidate) => candidate.name === artifactName);
    if (!artifact) throw new Error(`Artifact ${artifactName} was not found`);
    const sourcePath = safeArtifactPath(job, artifact.relative_path);
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('Artifact file was not found');
    return { job, artifact, sourcePath };
  }

  private fail(job: SatelliteProcessingJob, message: string): SatelliteProcessingJob {
    const failed = this.store.save({ ...job, status: 'failed', progress: 0, error: message, updated_at: new Date(this.now()).toISOString() });
    this.catalog.recordJob(failed as unknown as Record<string, unknown>);
    this.catalog.addAlert({ type: 'ingestion_failure', severity: 'warning', title: 'Satellite ingestion failed', message, provider: this.metadata.getByMetadataId(job.metadata_id)?.provider, metadata_id: job.metadata_id, job_id: job.job_id });
    this.audit.record({ action: 'job_failed', actor: 'pipeline', job_id: failed.job_id, metadata_id: failed.metadata_id, details: { error: message, attempts: failed.attempts } });
    return failed;
  }

  private async persistArtifact(job: SatelliteProcessingJob, raw: Omit<SatelliteCogArtifact, 'artifact_id' | 'metadata_id' | 'job_id' | 'created_at'>): Promise<SatelliteCogArtifact> {
    const artifact = this.materializeArtifact(job, raw);
    const sourcePath = safeArtifactPath(job, artifact.relative_path);
    if (!sourcePath) throw new Error('Artifact path could not be persisted');
    const stored = await this.objectStorage.putFile(`${job.job_id}/${artifact.relative_path}`, sourcePath, artifact.media_type);
    if (stored.checksum_sha256 !== artifact.checksum_sha256) throw new Error(`Object storage checksum mismatch for ${artifact.relative_path}`);
    this.audit.record({ action: 'artifact_persisted', actor: 'pipeline', job_id: job.job_id, metadata_id: job.metadata_id, details: { artifact: artifact.name, storage_uri: stored.uri, bytes: stored.bytes, driver: this.objectStorage.driver } });
    return { ...artifact, storage_uri: stored.uri };
  }

  private materializeArtifact(job: SatelliteProcessingJob, raw: Omit<SatelliteCogArtifact, 'artifact_id' | 'metadata_id' | 'job_id' | 'created_at'>): SatelliteCogArtifact {
    const relativePath = safeRelativePath(raw.relative_path);
    const absolutePath = path.resolve(job.output_dir, relativePath);
    const outputRoot = path.resolve(job.output_dir);
    if (absolutePath !== outputRoot && !absolutePath.startsWith(`${outputRoot}${path.sep}`)) throw new Error('Worker returned an artifact outside the job output directory');
    if (!fs.existsSync(absolutePath)) throw new Error(`Worker artifact is missing: ${relativePath}`);
    const stat = fs.statSync(absolutePath);
    const checksum = sha256File(absolutePath);
    if (raw.checksum_sha256 && raw.checksum_sha256 !== checksum) throw new Error(`Checksum mismatch for ${relativePath}`);
    if (!raw.is_cog || raw.media_type !== COG_MEDIA_TYPE || raw.width < 1 || raw.height < 1 || raw.overviews.length === 0 || raw.valid_pixel_count < 1 || raw.valid_fraction <= 0) throw new Error(`Invalid or empty COG validation metadata for ${relativePath}`);
    return { ...raw, artifact_id: `${job.job_id}:${raw.kind}:${raw.name}`, metadata_id: job.metadata_id, job_id: job.job_id, relative_path: relativePath, checksum_sha256: checksum, bytes: stat.size, created_at: new Date(this.now()).toISOString() };
  }

}

async function runPythonSatelliteWorker(input: SatelliteWorkerInput): Promise<SatelliteWorkerOutput> {
  const jobDir = path.resolve(input.output_dir);
  fs.mkdirSync(jobDir, { recursive: true });
  const inputPath = path.join(jobDir, 'worker-input.json');
  atomicWrite(inputPath, input);
  const workerPath = path.resolve(SERVER_DIR, '..', 'scripts', 'satellite_cog_worker.py');
  const executable = process.env.SATELLITE_PYTHON || 'python';
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [workerPath, '--input', inputPath], { windowsHide: true, cwd: path.resolve(SERVER_DIR, '..') });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) { reject(new Error(stderr.trim() || `satellite worker exited with code ${code ?? 'unknown'}`)); return; }
      try { resolve(JSON.parse(stdout) as SatelliteWorkerOutput); } catch { reject(new Error(`satellite worker returned invalid JSON: ${stdout.slice(0, 400)}`)); }
    });
  });
}

async function runPythonSatelliteAnalysis(payload: Record<string, unknown>, workingDirectory: string): Promise<Record<string, unknown>> {
  const directory = path.resolve(workingDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const inputPath = path.join(directory, `analysis-${crypto.randomUUID()}.json`);
  atomicWrite(inputPath, payload);
  const workerPath = path.resolve(SERVER_DIR, '..', 'scripts', 'satellite_analysis_worker.py');
  const executable = process.env.SATELLITE_PYTHON || 'python';
  try {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      const child = spawn(executable, [workerPath, '--input', inputPath], { windowsHide: true, cwd: path.resolve(SERVER_DIR, '..') });
      let stdout = ''; let stderr = '';
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code !== 0) { reject(new Error(stderr.trim() || `satellite analysis worker exited with code ${code ?? 'unknown'}`)); return; }
        try { resolve(JSON.parse(stdout) as Record<string, unknown>); } catch { reject(new Error(`satellite analysis worker returned invalid JSON: ${stdout.slice(0, 400)}`)); }
      });
    });
  } finally {
    if (fs.existsSync(inputPath)) fs.rmSync(inputPath, { force: true });
  }
}

type SatelliteTilePalette = 'ndvi' | 'viridis' | 'magma' | 'gray' | 'water' | 'change';

async function renderSatelliteTile(sourcePath: string, outputPath: string, z: number, x: number, y: number, minimum: number, maximum: number, palette: SatelliteTilePalette): Promise<void> {
  const rendererPath = path.resolve(SERVER_DIR, '..', 'scripts', 'satellite_tile_renderer.py');
  const executable = process.env.SATELLITE_PYTHON || 'python';
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [rendererPath, '--source', sourcePath, '--output', outputPath, '--z', String(z), '--x', String(x), '--y', String(y), '--minimum', String(minimum), '--maximum', String(maximum), '--palette', palette], { windowsHide: true, cwd: path.resolve(SERVER_DIR, '..') });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `tile renderer exited with code ${code ?? 'unknown'}`)));
  });
}

async function renderSatellitePreview(sourcePath: string, outputPath: string, bbox: [number, number, number, number], width: number, height: number, minimum: number, maximum: number, palette: SatelliteTilePalette): Promise<void> {
  const rendererPath = path.resolve(SERVER_DIR, '..', 'scripts', 'satellite_tile_renderer.py');
  const executable = process.env.SATELLITE_PYTHON || 'python';
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [rendererPath, '--source', sourcePath, '--output', outputPath, '--bbox', ...bbox.map(String), '--width', String(width), '--height', String(height), '--minimum', String(minimum), '--maximum', String(maximum), '--palette', palette], { windowsHide: true, cwd: path.resolve(SERVER_DIR, '..') });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `preview renderer exited with code ${code ?? 'unknown'}`)));
  });
}

export function isSupportedSatelliteIndex(value: unknown): value is SatelliteIndexName {
  return typeof value === 'string' && ['rgb', 'false_color', 'ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr', 'vv', 'vh', 'vv_vh_ratio'].includes(value);
}

export function satelliteArtifactPublicPath(jobId: string, relativePath: string): string {
  return `/api/satellite/pipeline/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(relativePath)}`;
}

function pipelineCorrelationId(req: Request): string {
  return req.header('x-correlation-id')?.trim() || crypto.randomUUID();
}

function parseAoi(value: unknown): SatelliteAoi | null {
  if (!value || typeof value !== 'object') return null;
  const aoi = value as { bbox?: unknown; geometry?: unknown; crs?: unknown };
  return validBbox(aoi.bbox) ? { bbox: aoi.bbox, geometry: aoi.geometry, crs: typeof aoi.crs === 'string' ? aoi.crs : undefined } : null;
}

function safeArtifactPath(job: SatelliteProcessingJob, relativePath: string): string | null {
  const normalized = safeRelativePath(relativePath);
  const root = path.resolve(job.output_dir);
  const absolute = path.resolve(root, normalized);
  return absolute === root || !absolute.startsWith(`${root}${path.sep}`) ? null : absolute;
}

export function createSatellitePipelineRouter(
  metadataStore: SatelliteMetadataStore,
  options: SatellitePipelineServiceOptions = {},
): Router {
  const service = new SatellitePipelineService(metadataStore, options);
  const queue = options.queue ?? new BoundedSatelliteJobQueue();
  const router = Router();

  const schedule = (job: SatelliteProcessingJob, actor: string, correlationId?: string): void => {
    if (queue.has(job.job_id)) return;
    service.audit.record({ action: 'job_enqueued', actor, correlation_id: correlationId, job_id: job.job_id, metadata_id: job.metadata_id, details: queue.stats() as unknown as Record<string, unknown> });
    void queue.enqueue(job.job_id, async () => { await service.run(job.job_id); })
      .catch((error) => console.error('[satellite] queued job failed', error));
  };

  if (process.env.SATELLITE_RECOVER_ON_START !== 'false') {
    for (const recovered of service.recoverInterruptedJobs()) schedule(recovered, 'startup-recovery');
  }

  router.get('/pipeline/health', (_req, res) => res.json({ success: true, data: { ...service.health(), queue: queue.stats() } }));

  router.get('/pipeline/jobs', (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ success: true, data: { jobs: service.store.list(Number.isFinite(limit) ? limit : 100), count: service.store.count() } });
  });

  router.get('/pipeline/jobs/:jobId', (req, res) => {
    const job = service.store.get(req.params.jobId);
    if (!job) { res.status(404).json({ success: false, error: { code: 'SATELLITE_JOB_NOT_FOUND', message: 'Processing job was not found.' } }); return; }
    res.json({ success: true, data: job });
  });

  router.post('/pipeline/jobs', (req, res) => {
    const correlationId = pipelineCorrelationId(req);
    try {
      const metadataId = typeof req.body?.metadata_id === 'string' ? req.body.metadata_id.trim() : '';
      const aoi = parseAoi(req.body?.aoi);
      const assets = Array.isArray(req.body?.assets) ? req.body.assets.filter((item: unknown): item is string => typeof item === 'string') : undefined;
      const indices = Array.isArray(req.body?.indices) ? req.body.indices.filter(isSupportedSatelliteIndex) : undefined;
      if (!metadataId || !aoi) throw new Error('metadata_id and aoi.bbox are required');
      const job = service.createJob({ metadata_id: metadataId, aoi, assets, indices });
      schedule(job, 'api', correlationId);
      res.status(202).setHeader('X-Correlation-ID', correlationId).json({ success: true, data: job, correlation_id: correlationId });
    } catch (error) {
      res.status(422).setHeader('X-Correlation-ID', correlationId).json({ success: false, error: { code: 'INVALID_SATELLITE_JOB', message: error instanceof Error ? error.message : 'Invalid processing job.' }, correlation_id: correlationId });
    }
  });

  router.post('/pipeline/jobs/:jobId/retry', (req, res) => {
    const correlationId = pipelineCorrelationId(req);
    try {
      const job = service.retry(req.params.jobId);
      schedule(job, 'api-retry', correlationId);
      res.status(202).setHeader('X-Correlation-ID', correlationId).json({ success: true, data: job, correlation_id: correlationId });
    } catch (error) {
      res.status(422).setHeader('X-Correlation-ID', correlationId).json({ success: false, error: { code: 'INVALID_SATELLITE_RETRY', message: error instanceof Error ? error.message : 'Invalid retry request.' }, correlation_id: correlationId });
    }
  });

  router.post('/pipeline/jobs/:jobId/replay', (req, res) => {
    const correlationId = pipelineCorrelationId(req);
    try {
      const job = service.replayJob(req.params.jobId);
      schedule(job, 'api-replay', correlationId);
      res.status(202).setHeader('X-Correlation-ID', correlationId).json({ success: true, data: job, correlation_id: correlationId });
    } catch (error) {
      res.status(422).json({ success: false, error: { code: 'SATELLITE_REPLAY_FAILED', message: error instanceof Error ? error.message : 'Replay failed.' } });
    }
  });

  router.post('/pipeline/backfill', (req, res) => {
    const correlationId = pipelineCorrelationId(req);
    const aoi = parseAoi(req.body?.aoi);
    const metadataIds = Array.isArray(req.body?.metadata_ids) ? req.body.metadata_ids.filter((value: unknown): value is string => typeof value === 'string') : [];
    const indices = Array.isArray(req.body?.indices) ? req.body.indices.filter(isSupportedSatelliteIndex) : undefined;
    if (!aoi) { res.status(400).json({ success: false, error: { code: 'INVALID_BACKFILL_REQUEST', message: 'metadata_ids and aoi.bbox are required.' } }); return; }
    try {
      const jobs = service.createBackfillJobs({ metadataIds, aoi, indices });
      for (const job of jobs) schedule(job, 'api-backfill', correlationId);
      res.status(202).setHeader('X-Correlation-ID', correlationId).json({ success: true, data: { jobs, count: jobs.length }, correlation_id: correlationId });
    } catch (error) {
      res.status(422).json({ success: false, error: { code: 'SATELLITE_BACKFILL_FAILED', message: error instanceof Error ? error.message : 'Backfill failed.' } });
    }
  });

  router.get('/pipeline/jobs/:jobId/tiles/:artifactName/:z/:x/:y.png', async (req, res) => {
    const job = service.store.get(req.params.jobId);
    if (!job) { res.status(404).json({ success: false, error: { code: 'SATELLITE_JOB_NOT_FOUND', message: 'Processing job was not found.' } }); return; }
    if (job.status !== 'ready') { res.status(409).json({ success: false, error: { code: 'SATELLITE_JOB_NOT_READY', message: 'Tiles are available after the processing job is ready.' } }); return; }
    const artifactName = String(req.params.artifactName || '').trim();
    const artifact = job.artifacts.find((candidate) => candidate.name === artifactName && candidate.kind === 'index') ?? job.artifacts.find((candidate) => candidate.name === artifactName);
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    const palette = String(req.query.palette ?? 'ndvi') as SatelliteTilePalette;
    const allowedPalettes = new Set<SatelliteTilePalette>(['ndvi', 'viridis', 'magma', 'gray', 'water', 'change']);
    const normalizedDifference = ['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr'].includes(artifact?.name ?? '');
    const defaultMinimum = normalizedDifference ? -1 : artifact?.statistics?.min ?? -1;
    const defaultMaximum = normalizedDifference ? 1 : artifact?.statistics?.max ?? 1;
    const minimum = req.query.min === undefined ? defaultMinimum : Number(req.query.min);
    const maximum = req.query.max === undefined ? defaultMaximum : Number(req.query.max);
    if (!artifact || !allowedPalettes.has(palette) || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum || !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 24 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SATELLITE_TILE', message: 'Unknown artifact or invalid tile coordinates.' } }); return;
    }
    let sourcePath: string;
    try { sourcePath = safeArtifactPath(job, artifact.relative_path) ?? ''; } catch { sourcePath = ''; }
    if (!sourcePath || !fs.existsSync(sourcePath)) { res.status(404).json({ success: false, error: { code: 'SATELLITE_ARTIFACT_NOT_FOUND', message: 'Artifact was not found.' } }); return; }
    const styleKey = `${palette}-${minimum.toFixed(4)}-${maximum.toFixed(4)}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cacheKey = `${job.job_id}/${artifact.name}/${artifact.checksum_sha256}/${styleKey}/${z}/${x}/${y}.png`;
    const etag = `"${crypto.createHash('sha1').update(cacheKey).digest('hex')}"`;
    if (req.header('if-none-match') === etag) { res.status(304).end(); return; }
    try {
      let tile = await service.tileCache.get(cacheKey);
      let cacheStatus = 'HIT';
      if (!tile) {
        cacheStatus = 'MISS';
        const temporaryDirectory = path.join(job.output_dir, '.tile-render');
        const tilePath = path.join(temporaryDirectory, `${crypto.randomUUID()}.png`);
        try {
          await renderSatelliteTile(sourcePath, tilePath, z, x, y, minimum, maximum, palette);
          if (!fs.existsSync(tilePath)) throw new Error('Tile renderer did not create an output image');
          tile = fs.readFileSync(tilePath);
          await service.tileCache.set(cacheKey, tile);
          void service.cleanupTileCache().catch((error) => console.warn('[satellite] tile cache cleanup failed', error));
        } finally {
          if (fs.existsSync(tilePath)) fs.rmSync(tilePath, { force: true });
        }
      }
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('ETag', etag);
      res.setHeader('X-Satellite-Cache', cacheStatus);
      res.type('image/png').send(tile);
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'SATELLITE_TILE_RENDER_FAILED', message: error instanceof Error ? error.message : 'Tile rendering failed.' } });
    }
  });

  router.get('/pipeline/jobs/:jobId/preview/:artifactName.png', async (req, res) => {
    const job = service.store.get(req.params.jobId);
    const artifact = job?.artifacts.find((candidate) => candidate.name === req.params.artifactName);
    if (!job || job.status !== 'ready' || !artifact) { res.status(404).json({ success: false, error: { code: 'SATELLITE_ARTIFACT_NOT_FOUND', message: 'Ready artifact was not found.' } }); return; }
    const rawBbox = req.query.bbox ? String(req.query.bbox).split(',').map(Number) : artifact.bounds;
    const bbox = validBbox(rawBbox) ? rawBbox : null;
    const width = Math.max(64, Math.min(2048, Math.trunc(Number(req.query.width ?? 768))));
    const height = Math.max(64, Math.min(2048, Math.trunc(Number(req.query.height ?? 512))));
    const palette = String(req.query.palette ?? (artifact.name.includes('ndwi') ? 'water' : artifact.name.startsWith('change_') ? 'change' : 'ndvi')) as SatelliteTilePalette;
    const allowedPalettes = new Set<SatelliteTilePalette>(['ndvi', 'viridis', 'magma', 'gray', 'water', 'change']);
    const normalizedDifference = ['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr'].includes(artifact.name);
    const minimum = Number(req.query.min ?? (normalizedDifference ? -1 : artifact.statistics?.min ?? 0));
    const maximum = Number(req.query.max ?? (normalizedDifference ? 1 : artifact.statistics?.max ?? 1));
    if (!bbox || !allowedPalettes.has(palette) || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SATELLITE_PREVIEW', message: 'Preview bbox, dimensions or style are invalid.' } }); return;
    }
    let sourcePath: string;
    try { sourcePath = safeArtifactPath(job, artifact.relative_path) ?? ''; } catch { sourcePath = ''; }
    if (!sourcePath || !fs.existsSync(sourcePath)) { res.status(404).json({ success: false, error: { code: 'SATELLITE_ARTIFACT_NOT_FOUND', message: 'Artifact was not found.' } }); return; }
    const cacheKey = `${job.job_id}/${artifact.name}/${artifact.checksum_sha256}/preview/${bbox.join(',')}/${width}x${height}/${palette}/${minimum}/${maximum}.png`;
    try {
      let preview = await service.tileCache.get(cacheKey);
      let cacheStatus = 'HIT';
      if (!preview) {
        cacheStatus = 'MISS';
        const temporaryDirectory = path.join(job.output_dir, '.preview-render');
        const previewPath = path.join(temporaryDirectory, `${crypto.randomUUID()}.png`);
        try {
          await renderSatellitePreview(sourcePath, previewPath, bbox, width, height, minimum, maximum, palette);
          preview = fs.readFileSync(previewPath);
          await service.tileCache.set(cacheKey, preview);
        } finally {
          if (fs.existsSync(previewPath)) fs.rmSync(previewPath, { force: true });
        }
      }
      res.setHeader('Cache-Control', 'public, max-age=900');
      res.setHeader('X-Satellite-Cache', cacheStatus);
      res.type('image/png').send(preview);
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'SATELLITE_PREVIEW_RENDER_FAILED', message: error instanceof Error ? error.message : 'Preview rendering failed.' } });
    }
  });

  router.get('/pipeline/jobs/:jobId/artifacts/:relativePath(*)', (req, res) => {
    const job = service.store.get(req.params.jobId);
    if (!job) { res.status(404).json({ success: false, error: { code: 'SATELLITE_JOB_NOT_FOUND', message: 'Processing job was not found.' } }); return; }
    let filePath: string | null = null;
    try { filePath = safeArtifactPath(job, req.params.relativePath); } catch { filePath = null; }
    if (!filePath || !fs.existsSync(filePath) || !job.artifacts.some((artifact) => path.resolve(job.output_dir, artifact.relative_path) === filePath)) {
      res.status(404).json({ success: false, error: { code: 'SATELLITE_ARTIFACT_NOT_FOUND', message: 'Artifact was not found.' } });
      return;
    }
    res.type('image/tiff').sendFile(filePath);
  });

  router.get('/pipeline/spatial/search', (req, res) => {
    const raw = String(req.query.bbox ?? '').split(',').map(Number);
    if (!validBbox(raw)) { res.status(400).json({ success: false, error: { code: 'INVALID_SPATIAL_BBOX', message: 'bbox must be west,south,east,north.' } }); return; }
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    res.json({ success: true, data: { bbox: raw, kind: kind ?? null, features: service.spatialIndex.query(raw, kind) } });
  });

  router.get('/pipeline/timeline', (req, res) => {
    const bbox = req.query.bbox ? String(req.query.bbox).split(',').map(Number) as [number, number, number, number] : undefined;
    if (bbox && !validBbox(bbox)) { res.status(400).json({ success: false, error: { code: 'INVALID_TIMELINE_BBOX', message: 'bbox must be west,south,east,north.' } }); return; }
    const artifact = req.query.artifact ? String(req.query.artifact) : undefined;
    const limit = Number(req.query.limit ?? 100);
    const entries = service.timeline({ artifact, bbox, limit: Number.isFinite(limit) ? limit : 100 }).map(({ job, item, artifact: output }) => ({ job_id: job.job_id, job_type: job.job_type ?? 'scene', metadata_id: job.metadata_id, datetime: item?.datetime ?? job.completed_at ?? job.updated_at, provider: item?.provider, collection: job.collection, cloud_cover: item?.cloud_cover, latency_minutes: item?.latency_minutes, artifact: output }));
    const temporal = artifact ? service.temporalSeries(artifact, bbox) : undefined;
    res.json({ success: true, data: { entries, temporal } });
  });

  router.get('/pipeline/jobs/:jobId/tilejson/:artifactName', (req, res) => {
    const job = service.store.get(req.params.jobId);
    const artifact = job?.artifacts.find((candidate) => candidate.name === req.params.artifactName);
    if (!job || job.status !== 'ready' || !artifact) { res.status(404).json({ success: false, error: { code: 'SATELLITE_ARTIFACT_NOT_FOUND', message: 'Ready artifact was not found.' } }); return; }
    const palette = String(req.query.palette ?? (artifact.name.startsWith('change_') ? 'change' : 'ndvi'));
    const minimum = Number(req.query.min ?? (['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr'].includes(artifact.name) ? -1 : artifact.statistics?.min ?? 0));
    const maximum = Number(req.query.max ?? (['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr'].includes(artifact.name) ? 1 : artifact.statistics?.max ?? 1));
    const base = `${req.protocol}://${req.get('host')}`;
    res.json({ tilejson: '3.0.0', name: artifact.name, bounds: artifact.bounds, minzoom: 0, maxzoom: 24, tiles: [`${base}/api/satellite/pipeline/jobs/${encodeURIComponent(job.job_id)}/tiles/${encodeURIComponent(artifact.name)}/{z}/{x}/{y}.png?palette=${encodeURIComponent(palette)}&min=${minimum}&max=${maximum}`], attribution: `ARA · ${job.collection}`, vector_layers: [], metadata: { job_id: job.job_id, checksum_sha256: artifact.checksum_sha256, statistics: artifact.statistics } });
  });

  router.post('/pipeline/statistics/zonal', async (req, res) => {
    const aoi = parseAoi(req.body?.aoi);
    const jobId = typeof req.body?.job_id === 'string' ? req.body.job_id : '';
    const artifactName = typeof req.body?.artifact === 'string' ? req.body.artifact : '';
    if (!aoi || !jobId || !artifactName) { res.status(400).json({ success: false, error: { code: 'INVALID_ZONAL_REQUEST', message: 'job_id, artifact and aoi.bbox are required.' } }); return; }
    try { res.json({ success: true, data: await service.zonalStatistics(jobId, artifactName, aoi) }); }
    catch (error) { res.status(422).json({ success: false, error: { code: 'ZONAL_ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Zonal analysis failed.' } }); }
  });

  router.post('/pipeline/change', async (req, res) => {
    const beforeJobId = typeof req.body?.before_job_id === 'string' ? req.body.before_job_id : '';
    const afterJobId = typeof req.body?.after_job_id === 'string' ? req.body.after_job_id : '';
    const artifactName = typeof req.body?.artifact === 'string' ? req.body.artifact : 'ndvi';
    const aoi = req.body?.aoi ? parseAoi(req.body.aoi) : undefined;
    if (!beforeJobId || !afterJobId || (req.body?.aoi && !aoi)) { res.status(400).json({ success: false, error: { code: 'INVALID_CHANGE_REQUEST', message: 'before_job_id, after_job_id and a valid optional AOI are required.' } }); return; }
    try { res.status(201).json({ success: true, data: await service.createChangeJob({ beforeJobId, afterJobId, artifactName, aoi, threshold: Number(req.body?.threshold ?? 0.1) }) }); }
    catch (error) { res.status(422).json({ success: false, error: { code: 'CHANGE_ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Change analysis failed.' } }); }
  });

  router.post('/pipeline/composite', async (req, res) => {
    const jobIds = Array.isArray(req.body?.job_ids) ? req.body.job_ids.filter((value: unknown): value is string => typeof value === 'string') : [];
    const artifactName = typeof req.body?.artifact === 'string' ? req.body.artifact : 'ndvi';
    const aoi = req.body?.aoi ? parseAoi(req.body.aoi) : undefined;
    try { res.status(201).json({ success: true, data: await service.createCompositeJob({ jobIds, artifactName, aoi }) }); }
    catch (error) { res.status(422).json({ success: false, error: { code: 'COMPOSITE_ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Composite analysis failed.' } }); }
  });

  router.post('/pipeline/segment', async (req, res) => {
    const jobId = typeof req.body?.job_id === 'string' ? req.body.job_id : '';
    const artifactName = typeof req.body?.artifact === 'string' ? req.body.artifact : 'ndvi';
    const aoi = req.body?.aoi ? parseAoi(req.body.aoi) : undefined;
    try { res.status(201).json({ success: true, data: await service.createSegmentationJob({ jobId, artifactName, aoi, classes: Number(req.body?.classes ?? 4) }) }); }
    catch (error) { res.status(422).json({ success: false, error: { code: 'SEGMENTATION_FAILED', message: error instanceof Error ? error.message : 'Segmentation failed.' } }); }
  });

  router.get('/features', (req, res) => {
    const bbox = req.query.bbox ? String(req.query.bbox).split(',').map(Number) as [number, number, number, number] : undefined;
    if (bbox && !validBbox(bbox)) { res.status(400).json({ success: false, error: { code: 'INVALID_FEATURE_BBOX', message: 'bbox must be west,south,east,north.' } }); return; }
    const features = service.catalog.listFeatures({ feature: req.query.feature ? String(req.query.feature) : undefined, metadataId: req.query.metadata_id ? String(req.query.metadata_id) : undefined, bbox, limit: Number(req.query.limit ?? 100) });
    res.json({ success: true, data: { features, count: features.length } });
  });

  router.get('/indices', (req, res) => {
    const index = String(req.query.index ?? 'ndvi');
    const bbox = req.query.bbox ? String(req.query.bbox).split(',').map(Number) as [number, number, number, number] : undefined;
    if (bbox && !validBbox(bbox)) { res.status(400).json({ success: false, error: { code: 'INVALID_INDEX_BBOX', message: 'bbox must be west,south,east,north.' } }); return; }
    const features = service.catalog.listFeatures({ feature: `${index}_mean`, metadataId: req.query.item_id ? String(req.query.item_id) : undefined, bbox, limit: Number(req.query.limit ?? 100) });
    res.json({ success: true, data: { index, features, latest: features[0] ?? null } });
  });

  router.get('/alerts', (req, res) => { service.evaluateOperationalAlerts(); const alerts = service.catalog.listAlerts(Number(req.query.limit ?? 100)); res.json({ success: true, data: { alerts, count: alerts.length } }); });

  router.post('/alerts/:alertId/acknowledge', (req, res) => {
    const alert = service.catalog.acknowledgeAlert(req.params.alertId);
    if (!alert) { res.status(404).json({ success: false, error: { code: 'SATELLITE_ALERT_NOT_FOUND', message: 'Alert was not found.' } }); return; }
    service.audit.record({ action: 'alert_acknowledged', actor: req.header('x-actor-id')?.trim() || 'api', details: { alert_id: alert.alert_id } });
    res.json({ success: true, data: alert });
  });

  router.get('/status/summary', async (_req, res) => {
    service.evaluateOperationalAlerts();
    const catalog = service.catalog.metrics();
    const jobs = service.store.countByStatus();
    const cache = await service.tileCacheMetrics();
    const fresh = service.timeline({ limit: 1 })[0];
    res.json({ success: true, data: { catalog, jobs, queue: queue.stats(), cache, infrastructure: { object_storage: service.objectStorage.health(), tile_cache: service.tileCache.health() }, providers: options.stac?.health() ?? [], latest_usable_image: fresh ? { datetime: fresh.item?.datetime ?? fresh.job.updated_at, provider: fresh.item?.provider, collection: fresh.job.collection, cloud_cover: fresh.item?.cloud_cover, latency_minutes: fresh.item?.latency_minutes, job_id: fresh.job.job_id } : null, freshness_sla_hours: Number(process.env.SATELLITE_FRESHNESS_SLA_HOURS ?? 24) } });
  });

  router.post('/pipeline/cache/cleanup', async (req, res) => res.json({ success: true, data: await service.cleanupTileCache({ ttlMs: Number(req.body?.ttl_ms) || undefined, maxBytes: Number(req.body?.max_bytes) || undefined }) }));

  router.get('/pipeline/audit', (req, res) => {
    const events = service.audit.list({ jobId: req.query.job_id ? String(req.query.job_id) : undefined, action: req.query.action ? String(req.query.action) : undefined, limit: Number(req.query.limit ?? 100) });
    res.json({ success: true, data: { events, count: events.length } });
  });

  router.post('/pipeline/retention', async (req, res) => {
    try {
      const result = await service.enforceRetention({ completedBefore: typeof req.body?.completed_before === 'string' ? req.body.completed_before : undefined, failedBefore: typeof req.body?.failed_before === 'string' ? req.body.failed_before : undefined, dryRun: req.body?.dry_run !== false });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(422).json({ success: false, error: { code: 'SATELLITE_RETENTION_FAILED', message: error instanceof Error ? error.message : 'Retention failed.' } });
    }
  });

  return router;
}
