import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export type SatelliteEvidenceStatus = 'observed' | 'derived' | 'inferred' | 'synthetic' | 'estimated';

export interface SatelliteFeatureRecord {
  feature_id: string;
  feature: string;
  value: number;
  unit?: string;
  source_item: string;
  metadata_id: string;
  source_job_id?: string;
  source_artifact_id?: string;
  provider: string;
  acquired_at: string;
  published_at?: string;
  latency_minutes?: number;
  cloud_cover?: number | null;
  resolution_m?: number;
  mask_fraction: number;
  method: string;
  confidence: number;
  status: SatelliteEvidenceStatus;
  bbox?: [number, number, number, number];
  geometry?: unknown;
  created_at: string;
  properties?: Record<string, unknown>;
}

export interface SatelliteAlertRecord {
  alert_id: string;
  type: 'freshness_sla' | 'provider_health' | 'ingestion_failure' | 'quality' | 'temporal_anomaly' | 'change';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  provider?: string;
  metadata_id?: string;
  job_id?: string;
  bbox?: [number, number, number, number];
  created_at: string;
  acknowledged_at?: string;
  details?: Record<string, unknown>;
}

export interface SatelliteCatalogItemInput {
  metadata_id: string;
  provider: string;
  collection: string;
  item_id: string;
  datetime: string;
  published_datetime?: string;
  latency_minutes?: number;
  bbox?: [number, number, number, number];
  geometry?: unknown;
  cloud_cover?: number | null;
  platform?: string;
  processing_level?: string;
  bands?: string[];
  assets?: Record<string, Record<string, unknown>>;
  license?: string;
  source_url?: string;
  ingested_at?: string;
}

interface CatalogFallback {
  version: 1;
  items: Record<string, SatelliteCatalogItemInput>;
  jobs: Record<string, Record<string, unknown>>;
  features: Record<string, SatelliteFeatureRecord>;
  alerts: Record<string, SatelliteAlertRecord>;
}

interface SqliteStatement {
  run(...parameters: unknown[]): { lastInsertRowid?: number | bigint; changes?: number };
  get(...parameters: unknown[]): Record<string, unknown> | undefined;
  all(...parameters: unknown[]): Record<string, unknown>[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type DatabaseConstructor = new (filePath: string) => SqliteDatabase;

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SATELLITE_CATALOG_PATH = path.join(SERVER_DIR, 'data', 'satellite-catalog.sqlite');

function loadDatabaseConstructor(): DatabaseConstructor | null {
  try {
    const require = createRequire(import.meta.url);
    const sqlite = require('node:sqlite') as { DatabaseSync?: DatabaseConstructor };
    return sqlite.DatabaseSync ?? null;
  } catch {
    return null;
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function atomicWrite(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function emptyFallback(): CatalogFallback {
  return { version: 1, items: {}, jobs: {}, features: {}, alerts: {} };
}

export class SatelliteCatalog {
  private readonly db: SqliteDatabase | null;
  private readonly fallbackPath: string;
  private readonly fallback: CatalogFallback;

  constructor(readonly filePath = DEFAULT_SATELLITE_CATALOG_PATH, useSqlite = true) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const Database = useSqlite ? loadDatabaseConstructor() : null;
    this.db = Database ? new Database(filePath) : null;
    this.fallbackPath = `${filePath}.json`;
    this.fallback = this.loadFallback();
    if (this.db) this.initialize();
  }

  private initialize(): void {
    this.db?.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS satellite_items (
        metadata_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        collection TEXT NOT NULL,
        item_id TEXT NOT NULL,
        acquisition_datetime TEXT NOT NULL,
        published_datetime TEXT,
        latency_minutes REAL,
        bbox_json TEXT,
        footprint_json TEXT,
        cloud_cover REAL,
        platform TEXT,
        processing_level TEXT,
        bands_json TEXT NOT NULL,
        license TEXT,
        source_url TEXT,
        ingested_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_satellite_item_source ON satellite_items(provider, collection, item_id);
      CREATE INDEX IF NOT EXISTS idx_satellite_item_acquired ON satellite_items(acquisition_datetime DESC);
      CREATE TABLE IF NOT EXISTS satellite_assets (
        asset_id TEXT PRIMARY KEY,
        metadata_id TEXT NOT NULL REFERENCES satellite_items(metadata_id) ON DELETE CASCADE,
        asset_key TEXT NOT NULL,
        href TEXT NOT NULL,
        media_type TEXT,
        roles_json TEXT NOT NULL,
        bands_json TEXT NOT NULL,
        gsd REAL,
        checksum TEXT,
        payload_json TEXT NOT NULL,
        UNIQUE(metadata_id, asset_key)
      );
      CREATE INDEX IF NOT EXISTS idx_satellite_assets_item ON satellite_assets(metadata_id);
      CREATE TABLE IF NOT EXISTS satellite_jobs (
        job_id TEXT PRIMARY KEY,
        metadata_id TEXT,
        status TEXT NOT NULL,
        job_type TEXT NOT NULL,
        progress REAL NOT NULL,
        attempts INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        error TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_satellite_jobs_status ON satellite_jobs(status, updated_at DESC);
      CREATE TABLE IF NOT EXISTS satellite_features (
        feature_id TEXT PRIMARY KEY,
        feature TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT,
        metadata_id TEXT NOT NULL,
        source_item TEXT NOT NULL,
        source_job_id TEXT,
        source_artifact_id TEXT,
        provider TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        published_at TEXT,
        latency_minutes REAL,
        cloud_cover REAL,
        resolution_m REAL,
        mask_fraction REAL NOT NULL,
        method TEXT NOT NULL,
        confidence REAL NOT NULL,
        status TEXT NOT NULL,
        bbox_json TEXT,
        geometry_json TEXT,
        created_at TEXT NOT NULL,
        properties_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_satellite_features_name_time ON satellite_features(feature, acquired_at DESC);
      CREATE INDEX IF NOT EXISTS idx_satellite_features_item ON satellite_features(metadata_id);
      CREATE TABLE IF NOT EXISTS satellite_alerts (
        alert_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        provider TEXT,
        metadata_id TEXT,
        job_id TEXT,
        bbox_json TEXT,
        created_at TEXT NOT NULL,
        acknowledged_at TEXT,
        details_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_satellite_alerts_time ON satellite_alerts(created_at DESC);
    `);
  }

  private loadFallback(): CatalogFallback {
    if (!fs.existsSync(this.fallbackPath)) return emptyFallback();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.fallbackPath, 'utf8')) as Partial<CatalogFallback>;
      return {
        version: 1,
        items: parsed.items ?? {},
        jobs: parsed.jobs ?? {},
        features: parsed.features ?? {},
        alerts: parsed.alerts ?? {},
      };
    } catch {
      return emptyFallback();
    }
  }

  private flushFallback(): void {
    if (!this.db) atomicWrite(this.fallbackPath, this.fallback);
  }

  upsertItem(item: SatelliteCatalogItemInput): void {
    const ingestedAt = item.ingested_at ?? new Date().toISOString();
    if (!this.db) {
      this.fallback.items[item.metadata_id] = { ...item, ingested_at: ingestedAt };
      this.flushFallback();
      return;
    }
    this.db.prepare(`
      INSERT INTO satellite_items (
        metadata_id, provider, collection, item_id, acquisition_datetime, published_datetime,
        latency_minutes, bbox_json, footprint_json, cloud_cover, platform, processing_level,
        bands_json, license, source_url, ingested_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(metadata_id) DO UPDATE SET
        published_datetime=excluded.published_datetime,
        latency_minutes=excluded.latency_minutes,
        bbox_json=excluded.bbox_json,
        footprint_json=excluded.footprint_json,
        cloud_cover=excluded.cloud_cover,
        platform=excluded.platform,
        processing_level=excluded.processing_level,
        bands_json=excluded.bands_json,
        license=excluded.license,
        source_url=excluded.source_url,
        ingested_at=excluded.ingested_at,
        payload_json=excluded.payload_json
    `).run(
      item.metadata_id, item.provider, item.collection, item.item_id, item.datetime,
      item.published_datetime ?? null, finiteOrNull(item.latency_minutes), item.bbox ? JSON.stringify(item.bbox) : null,
      item.geometry ? JSON.stringify(item.geometry) : null, finiteOrNull(item.cloud_cover), item.platform ?? null,
      item.processing_level ?? null, JSON.stringify(item.bands ?? []), item.license ?? null,
      item.source_url ?? null, ingestedAt, JSON.stringify({ ...item, ingested_at: ingestedAt }),
    );
    for (const [assetKey, asset] of Object.entries(item.assets ?? {})) {
      const checksum = typeof asset.checksum === 'string'
        ? asset.checksum
        : typeof asset['file:checksum'] === 'string'
          ? asset['file:checksum']
          : typeof asset['checksum:multihash'] === 'string'
            ? asset['checksum:multihash']
            : null;
      this.db.prepare(`
        INSERT INTO satellite_assets (asset_id, metadata_id, asset_key, href, media_type, roles_json, bands_json, gsd, checksum, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(metadata_id, asset_key) DO UPDATE SET
          href=excluded.href, media_type=excluded.media_type, roles_json=excluded.roles_json,
          bands_json=excluded.bands_json, gsd=excluded.gsd, checksum=excluded.checksum, payload_json=excluded.payload_json
      `).run(
        `${item.metadata_id}:${assetKey}`, item.metadata_id, assetKey, String(asset.href ?? ''),
        typeof asset.type === 'string' ? asset.type : null,
        JSON.stringify(Array.isArray(asset.roles) ? asset.roles : []),
        JSON.stringify(Array.isArray(asset.bands) ? asset.bands : []),
        finiteOrNull(asset.gsd), checksum, JSON.stringify(asset),
      );
    }
  }

  recordJob(job: Record<string, unknown>): void {
    const jobId = String(job.job_id ?? '');
    if (!jobId) return;
    if (!this.db) {
      this.fallback.jobs[jobId] = job;
      this.flushFallback();
      return;
    }
    this.db.prepare(`
      INSERT INTO satellite_jobs (job_id, metadata_id, status, job_type, progress, attempts, created_at, updated_at, completed_at, error, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        metadata_id=excluded.metadata_id, status=excluded.status, job_type=excluded.job_type,
        progress=excluded.progress, attempts=excluded.attempts, updated_at=excluded.updated_at,
        completed_at=excluded.completed_at, error=excluded.error, payload_json=excluded.payload_json
    `).run(
      jobId, typeof job.metadata_id === 'string' ? job.metadata_id : null, String(job.status ?? 'unknown'),
      String(job.job_type ?? 'scene'), finiteOrNull(job.progress) ?? 0, finiteOrNull(job.attempts) ?? 0,
      String(job.created_at ?? new Date().toISOString()), String(job.updated_at ?? new Date().toISOString()),
      typeof job.completed_at === 'string' ? job.completed_at : null, typeof job.error === 'string' ? job.error : null,
      JSON.stringify(job),
    );
  }

  upsertFeature(feature: SatelliteFeatureRecord): void {
    const normalized = {
      ...feature,
      confidence: Math.max(0, Math.min(1, feature.confidence)),
      mask_fraction: Math.max(0, Math.min(1, feature.mask_fraction)),
    };
    if (!this.db) {
      this.fallback.features[feature.feature_id] = normalized;
      this.flushFallback();
      return;
    }
    this.db.prepare(`
      INSERT INTO satellite_features (
        feature_id, feature, value, unit, metadata_id, source_item, source_job_id, source_artifact_id,
        provider, acquired_at, published_at, latency_minutes, cloud_cover, resolution_m, mask_fraction,
        method, confidence, status, bbox_json, geometry_json, created_at, properties_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(feature_id) DO UPDATE SET
        value=excluded.value, unit=excluded.unit, published_at=excluded.published_at,
        latency_minutes=excluded.latency_minutes, cloud_cover=excluded.cloud_cover,
        resolution_m=excluded.resolution_m, mask_fraction=excluded.mask_fraction,
        method=excluded.method, confidence=excluded.confidence, status=excluded.status,
        bbox_json=excluded.bbox_json, geometry_json=excluded.geometry_json,
        created_at=excluded.created_at, properties_json=excluded.properties_json
    `).run(
      normalized.feature_id, normalized.feature, normalized.value, normalized.unit ?? null,
      normalized.metadata_id, normalized.source_item, normalized.source_job_id ?? null,
      normalized.source_artifact_id ?? null, normalized.provider, normalized.acquired_at,
      normalized.published_at ?? null, finiteOrNull(normalized.latency_minutes), finiteOrNull(normalized.cloud_cover),
      finiteOrNull(normalized.resolution_m), normalized.mask_fraction, normalized.method, normalized.confidence,
      normalized.status, normalized.bbox ? JSON.stringify(normalized.bbox) : null,
      normalized.geometry ? JSON.stringify(normalized.geometry) : null, normalized.created_at,
      JSON.stringify(normalized.properties ?? {}),
    );
  }

  listFeatures(options: { feature?: string; metadataId?: string; bbox?: [number, number, number, number]; limit?: number } = {}): SatelliteFeatureRecord[] {
    const limit = Math.max(1, Math.min(1000, Math.trunc(options.limit ?? 100)));
    const where: string[] = [];
    const parameters: unknown[] = [];
    if (options.feature) { where.push('feature = ?'); parameters.push(options.feature); }
    if (options.metadataId) { where.push('metadata_id = ?'); parameters.push(options.metadataId); }
    const candidates = this.db
      ? this.db.prepare(`SELECT * FROM satellite_features ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY acquired_at DESC LIMIT ?`)
          .all(...parameters, Math.min(1000, limit * (options.bbox ? 4 : 1)))
          .map((row) => ({
            feature_id: String(row.feature_id), feature: String(row.feature), value: Number(row.value),
            unit: row.unit == null ? undefined : String(row.unit), metadata_id: String(row.metadata_id),
            source_item: String(row.source_item), source_job_id: row.source_job_id == null ? undefined : String(row.source_job_id),
            source_artifact_id: row.source_artifact_id == null ? undefined : String(row.source_artifact_id),
            provider: String(row.provider), acquired_at: String(row.acquired_at),
            published_at: row.published_at == null ? undefined : String(row.published_at),
            latency_minutes: row.latency_minutes == null ? undefined : Number(row.latency_minutes),
            cloud_cover: row.cloud_cover == null ? null : Number(row.cloud_cover),
            resolution_m: row.resolution_m == null ? undefined : Number(row.resolution_m),
            mask_fraction: Number(row.mask_fraction), method: String(row.method), confidence: Number(row.confidence),
            status: String(row.status) as SatelliteEvidenceStatus,
            bbox: parseJson<[number, number, number, number] | undefined>(row.bbox_json, undefined),
            geometry: parseJson<unknown>(row.geometry_json, undefined), created_at: String(row.created_at),
            properties: parseJson<Record<string, unknown>>(row.properties_json, {}),
          }))
      : Object.values(this.fallback.features).filter((record) => !options.feature || record.feature === options.feature).filter((record) => !options.metadataId || record.metadata_id === options.metadataId).sort((a, b) => b.acquired_at.localeCompare(a.acquired_at));
    return candidates.filter((record) => {
      if (!options.bbox || !record.bbox) return true;
      return record.bbox[0] <= options.bbox[2] && record.bbox[2] >= options.bbox[0] && record.bbox[1] <= options.bbox[3] && record.bbox[3] >= options.bbox[1];
    }).slice(0, limit);
  }

  addAlert(input: Omit<SatelliteAlertRecord, 'alert_id' | 'created_at'> & Partial<Pick<SatelliteAlertRecord, 'alert_id' | 'created_at'>>): SatelliteAlertRecord {
    const alert: SatelliteAlertRecord = {
      ...input,
      alert_id: input.alert_id ?? crypto.randomUUID(),
      created_at: input.created_at ?? new Date().toISOString(),
    };
    if (!this.db) {
      this.fallback.alerts[alert.alert_id] = alert;
      this.flushFallback();
      return alert;
    }
    this.db.prepare(`INSERT OR REPLACE INTO satellite_alerts (alert_id, type, severity, title, message, provider, metadata_id, job_id, bbox_json, created_at, acknowledged_at, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(alert.alert_id, alert.type, alert.severity, alert.title, alert.message, alert.provider ?? null, alert.metadata_id ?? null, alert.job_id ?? null, alert.bbox ? JSON.stringify(alert.bbox) : null, alert.created_at, alert.acknowledged_at ?? null, JSON.stringify(alert.details ?? {}));
    return alert;
  }

  listAlerts(limit = 100): SatelliteAlertRecord[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    if (!this.db) return Object.values(this.fallback.alerts).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, safeLimit);
    return this.db.prepare('SELECT * FROM satellite_alerts ORDER BY created_at DESC LIMIT ?').all(safeLimit).map((row) => ({
      alert_id: String(row.alert_id), type: String(row.type) as SatelliteAlertRecord['type'], severity: String(row.severity) as SatelliteAlertRecord['severity'],
      title: String(row.title), message: String(row.message), provider: row.provider == null ? undefined : String(row.provider),
      metadata_id: row.metadata_id == null ? undefined : String(row.metadata_id), job_id: row.job_id == null ? undefined : String(row.job_id),
      bbox: parseJson<[number, number, number, number] | undefined>(row.bbox_json, undefined), created_at: String(row.created_at),
      acknowledged_at: row.acknowledged_at == null ? undefined : String(row.acknowledged_at), details: parseJson<Record<string, unknown>>(row.details_json, {}),
    }));
  }

  acknowledgeAlert(alertId: string, acknowledgedAt = new Date().toISOString()): SatelliteAlertRecord | null {
    if (!this.db) {
      const current = this.fallback.alerts[alertId];
      if (!current) return null;
      const updated = { ...current, acknowledged_at: acknowledgedAt };
      this.fallback.alerts[alertId] = updated;
      this.flushFallback();
      return updated;
    }
    const current = this.listAlerts(500).find((alert) => alert.alert_id === alertId);
    if (!current) return null;
    this.db.prepare('UPDATE satellite_alerts SET acknowledged_at = ? WHERE alert_id = ?').run(acknowledgedAt, alertId);
    return { ...current, acknowledged_at: acknowledgedAt };
  }

  metrics(): {
    storage: string;
    items: number;
    assets: number;
    jobs: number;
    features: number;
    alerts: number;
    latest_acquisition: string | null;
    average_latency_minutes: number | null;
    failed_jobs: number;
  } {
    if (!this.db) {
      const items = Object.values(this.fallback.items);
      const jobs = Object.values(this.fallback.jobs);
      const latencies = items.map((item) => item.latency_minutes).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return {
        storage: this.fallbackPath, items: items.length, assets: items.reduce((sum, item) => sum + Object.keys(item.assets ?? {}).length, 0),
        jobs: jobs.length, features: Object.keys(this.fallback.features).length, alerts: Object.keys(this.fallback.alerts).length,
        latest_acquisition: items.map((item) => item.datetime).sort().at(-1) ?? null,
        average_latency_minutes: latencies.length ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(1)) : null,
        failed_jobs: jobs.filter((job) => job.status === 'failed').length,
      };
    }
    const count = (table: string): number => Number(this.db?.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0);
    const stats = this.db.prepare('SELECT MAX(acquisition_datetime) AS latest, AVG(latency_minutes) AS latency FROM satellite_items').get();
    const failed = this.db.prepare("SELECT COUNT(*) AS count FROM satellite_jobs WHERE status='failed'").get();
    return {
      storage: this.filePath,
      items: count('satellite_items'), assets: count('satellite_assets'), jobs: count('satellite_jobs'),
      features: count('satellite_features'), alerts: count('satellite_alerts'),
      latest_acquisition: stats?.latest == null ? null : String(stats.latest),
      average_latency_minutes: stats?.latency == null ? null : Number(Number(stats.latency).toFixed(1)),
      failed_jobs: Number(failed?.count ?? 0),
    };
  }

  close(): void { this.db?.close(); }
}
