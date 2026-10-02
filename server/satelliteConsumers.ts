import crypto from 'node:crypto';
import type { SatelliteEvidenceBundle, SatelliteEvidenceItem } from '../src/algorithm/types';
import type { SatelliteCatalog, SatelliteFeatureRecord } from './satelliteCatalog';
import type { MeasurementRecord, TypologyRun } from './typologyTypes';

export type SatelliteBbox = [number, number, number, number];

function finiteCoordinates(value: unknown, output: number[][]): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number' && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    output.push([value[0], value[1]]);
    return;
  }
  for (const child of value) finiteCoordinates(child, output);
}

export function geometryBbox(geometry: unknown): SatelliteBbox | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const source = geometry as { type?: unknown; coordinates?: unknown; geometry?: unknown };
  if (source.type === 'Feature') return geometryBbox(source.geometry);
  const coordinates: number[][] = [];
  finiteCoordinates(source.coordinates, coordinates);
  if (coordinates.length === 0) return null;
  const xs = coordinates.map((coordinate) => coordinate[0]);
  const ys = coordinates.map((coordinate) => coordinate[1]);
  const bbox: SatelliteBbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return bbox[0] < bbox[2] && bbox[1] < bbox[3] ? bbox : null;
}

function evidenceItem(record: SatelliteFeatureRecord, now: number, freshnessSlaHours: number): SatelliteEvidenceItem {
  const acquired = Date.parse(record.acquired_at);
  const stale = !Number.isFinite(acquired) || now - acquired > freshnessSlaHours * 3_600_000;
  return {
    featureId: record.feature_id,
    feature: record.feature,
    value: record.value,
    unit: record.unit,
    status: record.status,
    provider: record.provider,
    sourceItem: record.source_item,
    sourceJobId: record.source_job_id,
    acquiredAt: record.acquired_at,
    publishedAt: record.published_at,
    latencyMinutes: record.latency_minutes,
    cloudCover: record.cloud_cover,
    resolutionM: record.resolution_m,
    maskFraction: record.mask_fraction,
    method: record.method,
    confidence: record.confidence,
    bbox: record.bbox,
    stale,
  };
}

export function collectSatelliteEvidence(
  catalog: Pick<SatelliteCatalog, 'listFeatures'>,
  bbox: SatelliteBbox,
  options: { freshnessSlaHours?: number; now?: number; limit?: number } = {},
): SatelliteEvidenceBundle {
  const now = options.now ?? Date.now();
  const freshnessSlaHours = Math.max(1, options.freshnessSlaHours ?? Number(process.env.SATELLITE_FRESHNESS_SLA_HOURS ?? 24));
  const records = catalog.listFeatures({ bbox, limit: options.limit ?? 1000 });
  const latest = new Map<string, SatelliteFeatureRecord>();
  for (const record of records) {
    const current = latest.get(record.feature);
    if (!current || record.acquired_at > current.acquired_at || (record.acquired_at === current.acquired_at && record.confidence > current.confidence)) latest.set(record.feature, record);
  }
  const latestByFeature = [...latest.values()].map((record) => evidenceItem(record, now, freshnessSlaHours)).sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
  return {
    queriedBbox: bbox,
    freshnessSlaHours,
    collectedAt: new Date(now).toISOString(),
    latestByFeature,
    observedCount: latestByFeature.filter((item) => item.status === 'observed').length,
    derivedCount: latestByFeature.filter((item) => item.status === 'derived').length,
    staleCount: latestByFeature.filter((item) => item.stale).length,
    decisionImpact: 'evidence_only',
  };
}

export function decisionSpatialValues(bundle: SatelliteEvidenceBundle): Record<string, number | null> {
  return Object.fromEntries(bundle.latestByFeature.map((item) => [item.feature, item.value]));
}

const TYPOLOGY_FEATURE_RULES: Array<{ feature: RegExp; task: RegExp }> = [
  { feature: /^ndvi_mean$/, task: /سبزینگی|پوشش گیاهی|فضای سبز|NDVI/i },
  { feature: /^(ndwi|mndwi)_mean$/, task: /آب سطحی|منابع.*آب|پهنه.*آب|رواناب|زهکش/i },
  { feature: /^ndbi_mean$/, task: /سطح ساخته|توسعه کالبدی|گسترش.*شهری|ساخت.?وساز|بافت شهری/i },
  { feature: /^ndmi_mean$/, task: /رطوبت|خشکسالی|منابع.*خاک/i },
  { feature: /^nbr_mean$/, task: /آتش|سوختگی|حریق|حفاظت حیات وحش/i },
  { feature: /^(vv|vh|vv_vh_ratio)_mean$/, task: /توسعه کالبدی|ساخت.?وساز|ریخت شناسی|فرم بافت/i },
  { feature: /_change_mean$/, task: /تغییر|رشد|توسعه|گسترش/i },
];

function matchingTaskCodes(run: TypologyRun, feature: string): string[] {
  const rule = TYPOLOGY_FEATURE_RULES.find((candidate) => candidate.feature.test(feature));
  if (!rule) return [];
  return run.tasks
    .filter((task) => rule.task.test(`${task.indicator} ${task.source_requirements} ${task.formula_text}`))
    .map((task) => task.code)
    .slice(0, 12);
}

/**
 * Converts validated EO features to provenance-rich raw measurements. It never
 * assigns a typology score; the approved registry formula must do that later.
 */
export function buildTypologySatelliteEvidence(
  run: TypologyRun,
  catalog: Pick<SatelliteCatalog, 'listFeatures'>,
  options: { now?: number; maxRecords?: number } = {},
): { records: Array<Record<string, unknown>>; bundle: SatelliteEvidenceBundle; mappedIndicators: string[] } {
  const bbox = geometryBbox(run.boundary?.geojson);
  if (!bbox) throw new Error('Confirmed boundary has no usable Polygon or MultiPolygon coordinates');
  const bundle = collectSatelliteEvidence(catalog, bbox, { now: options.now, limit: 1000 });
  const maxRecords = Math.max(1, Math.min(100, Math.trunc(options.maxRecords ?? 40)));
  const records: Array<Record<string, unknown>> = [];
  const mapped = new Set<string>();
  for (const feature of bundle.latestByFeature) {
    const sourceRecord = catalog.listFeatures({ bbox, feature: feature.feature, limit: 1 })[0];
    if (!sourceRecord) continue;
    for (const indicatorCode of matchingTaskCodes(run, feature.feature)) {
      if (mapped.has(indicatorCode) || records.length >= maxRecords) continue;
      const task = run.tasks.find((candidate) => candidate.code === indicatorCode)!;
      const validFraction = Math.max(0, Math.min(1, 1 - feature.maskFraction));
      const qualityScore = Math.max(0, Math.min(1, feature.confidence * validFraction * (feature.stale ? 0.6 : 1)));
      const checksum = crypto.createHash('sha256').update(JSON.stringify(sourceRecord)).digest('hex');
      records.push({
        indicator_code: indicatorCode,
        raw_value: feature.value,
        cleaned_value: feature.value,
        unit: feature.unit ?? 'ratio',
        reference_date: feature.acquiredAt,
        geography: run.request.neighborhood_name,
        source: {
          organization: feature.provider,
          url: String(sourceRecord.properties?.source_url ?? `stac://${feature.provider}/${feature.sourceItem}`),
          dataset_id: feature.sourceJobId ?? feature.sourceItem,
          version: sourceRecord.source_artifact_id ?? sourceRecord.feature_id,
          retrieved_at: bundle.collectedAt,
          license: String(sourceRecord.properties?.source_license ?? 'STAC item license; verify provider terms'),
          checksum: `sha256:${checksum}`,
          coverage: validFraction,
          source_tier: 'open_verified',
          geography_level: 'neighborhood',
          data_vintage: feature.acquiredAt,
        },
        method: { formula_version: task.formula_version, code_commit: run.code_version },
        quality: {
          spatial_coverage: validFraction,
          temporal_coverage: feature.stale ? 0.5 : 1,
          score: qualityScore,
          source_reliability: feature.status === 'observed' ? 0.95 : 0.85,
          method_validity: feature.status === 'derived' ? 0.9 : 0.8,
          validation_score: feature.confidence,
          flags: [feature.status.toUpperCase(), ...(feature.stale ? ['STALE_ACQUISITION'] : []), ...(feature.maskFraction > 0.4 ? ['HIGH_MASK_FRACTION'] : [])],
        },
        score_1_5: null,
        boundary_version: run.boundary?.version,
        uncertainty: { confidence: feature.confidence, mask_fraction: feature.maskFraction, cloud_cover: feature.cloudCover, latency_minutes: feature.latencyMinutes, resolution_m: feature.resolutionM },
        status: 'measured',
      });
      mapped.add(indicatorCode);
    }
    if (records.length >= maxRecords) break;
  }
  return { records, bundle, mappedIndicators: [...mapped] };
}

export type SatelliteTypologyMeasurement = Pick<MeasurementRecord, 'indicator_code' | 'raw_value' | 'source' | 'quality' | 'status'>;
