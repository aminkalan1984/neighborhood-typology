import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTypologySatelliteEvidence, collectSatelliteEvidence, geometryBbox } from './satelliteConsumers';
import type { SatelliteFeatureRecord } from './satelliteCatalog';

function feature(overrides: Partial<SatelliteFeatureRecord> = {}): SatelliteFeatureRecord {
  return {
    feature_id: 'f-ndvi', feature: 'ndvi_mean', value: 0.42, unit: 'ratio', source_item: 'S2_ITEM', metadata_id: 'cdse:sentinel-2-l2a:S2_ITEM', provider: 'cdse', acquired_at: '2026-08-26T08:00:00Z', published_at: '2026-08-26T10:00:00Z', latency_minutes: 120, cloud_cover: 4, resolution_m: 10, mask_fraction: 0.1, method: 'test', confidence: 0.9, status: 'derived', bbox: [50, 35, 51, 36], created_at: '2026-08-26T12:00:00Z', properties: { source_url: 'https://example.test/item', source_license: 'open' }, ...overrides,
  };
}

test('extracts bounds from Polygon and MultiPolygon safely', () => {
  assert.deepEqual(geometryBbox({ type: 'Polygon', coordinates: [[[50, 35], [51, 35], [51, 36], [50, 35]]] }), [50, 35, 51, 36]);
  assert.deepEqual(geometryBbox({ type: 'MultiPolygon', coordinates: [[[[49, 34], [50, 34], [50, 35], [49, 34]]], [[[51, 36], [52, 36], [52, 37], [51, 36]]]] }), [49, 34, 52, 37]);
  assert.equal(geometryBbox({ type: 'Point', coordinates: [50, 35] }), null);
});

test('collects latest evidence per feature and marks stale observations', () => {
  const records = [feature(), feature({ feature_id: 'f-old', value: 0.2, acquired_at: '2026-08-20T08:00:00Z' }), feature({ feature_id: 'f-water', feature: 'ndwi_mean', value: 0.1 })];
  const catalog = { listFeatures: (options: { feature?: string }) => options.feature ? records.filter((item) => item.feature === options.feature) : records };
  const bundle = collectSatelliteEvidence(catalog, [50, 35, 51, 36], { now: Date.parse('2026-08-26T12:00:00Z'), freshnessSlaHours: 24 });
  assert.equal(bundle.latestByFeature.length, 2);
  assert.equal(bundle.latestByFeature.find((item) => item.feature === 'ndvi_mean')?.value, 0.42);
  assert.equal(bundle.staleCount, 0);
});

test('builds provenance-rich typology records without assigning scores', () => {
  const run = {
    run_id: 'run-1', code_version: 'test', request: { neighborhood_name: 'محله آزمایشی' },
    boundary: { geojson: { type: 'Polygon', coordinates: [[[50, 35], [51, 35], [51, 36], [50, 35]]] }, version: 'v1' },
    tasks: [{ code: 'ENV-001', indicator: 'NDVI پوشش گیاهی', source_requirements: '', formula_text: 'NDVI' }],
  } as any;
  const source = feature();
  const catalog = { listFeatures: (options: { feature?: string }) => options.feature ? [source] : [source] };
  const result = buildTypologySatelliteEvidence(run, catalog, { now: Date.parse('2026-08-26T12:00:00Z') });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].score_1_5, null);
  assert.equal((result.records[0].source as Record<string, unknown>).organization, 'cdse');
  assert.equal(result.bundle.decisionImpact, 'evidence_only');
});
