import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildLocalTypologyEvidence } from './typologyDataConnector';
import type { IndicatorTask, TypologyRun } from './typologyTypes';

function task(code: string, indicator: string, calcFamily: string, direction = 'مستقیم'): IndicatorTask {
  return {
    code, domain: 'physical', axis: 'test', indicator, driver_id: 'P1', coefficient: 1,
    domain_weight_percent: 1, direction, calc_family: calcFamily, access_mode: 'برخط/باز',
    playbooks: [], source_requirements: 'test', formula_text: 'test', formula_version: `${code}@1.0`,
    mapping_confidence: 'high', status: 'DOWNLOADING_PUBLIC_DATA', next_action: 'test', measurement_ids: [],
  };
}

test('extracts boundary-local layers, keeps surveys out, and labels province proxies', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typology-data-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const province = path.join(root, 'geojson', 'new_data', 'iran-provinces', 'provinces', 'IR-23_تهران');
  const groups = path.join(province, 'categorized', 'by_group');
  fs.mkdirSync(groups, { recursive: true });
  fs.writeFileSync(path.join(groups, 'education.geojson'), JSON.stringify({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [51.01, 35.01] }, properties: { category_subtype: 'school' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [52, 36] }, properties: { category_subtype: 'school' } },
    ],
  }));
  fs.mkdirSync(path.join(province, 'satellite'), { recursive: true });
  fs.writeFileSync(path.join(province, 'environmental_statistics.json'), JSON.stringify({ air_quality: { pm25_ug_m3_annual_mean: 25 } }));
  const portals = path.join(root, 'src', 'data', 'portals', 'population');
  fs.mkdirSync(portals, { recursive: true });
  fs.writeFileSync(path.join(portals, 'projections-1396-1415.json'), JSON.stringify([{ year: '1405', province: 'تهران', total: 15000 }]));

  const run = {
    request: { province: 'تهران', reference_year: 1405 },
    boundary: {
      geojson: { type: 'Polygon', coordinates: [[[51, 35], [51.1, 35], [51.1, 35.1], [51, 35.1], [51, 35]]] },
      area_km2: 100,
    },
    tasks: [
      task('PHY-001', 'فاصله دسترسی کودکان تا مدرسه', 'network_access'),
      task('PHY-006', 'رضایت از مدرسه', 'survey_or_assessment'),
      task('PHY-117', 'غلظت ذرات معلق و آلودگی هوا', 'ratio_rate_or_trend', 'معکوس'),
      task('PHY-129', 'جمعیت و تراکم جمعیت', 'ratio_rate_or_trend'),
    ],
  } as unknown as TypologyRun;

  const result = buildLocalTypologyEvidence(run, { rootDirectory: root });
  assert.equal(result.province_id, 'IR-23');
  assert.equal(result.layers.find((item) => item.tag === 'education')?.count, 1);
  assert.equal(result.records.length, 3);
  const school = result.records.find((item) => item.indicator_code === 'PHY-001') as Record<string, any>;
  assert.ok(school.raw_value > 0);
  assert.equal(school.unit, 'km straight-line');
  assert.equal(school.quality.flags.includes('AUTO_EXTRACTED_LOCAL_GEOJSON'), true);
  assert.equal(school.quality.flags.includes('STRAIGHT_LINE_ACCESS_PROXY'), true);
  assert.equal(result.records.some((item) => item.indicator_code === 'PHY-006'), false);
  const air = result.records.find((item) => item.indicator_code === 'PHY-117') as Record<string, any>;
  assert.equal(air.geography, 'province proxy');
  assert.equal(air.quality.flags.includes('PROXY_GEOGRAPHY'), true);
  assert.equal(air.source.coverage, 0.25);
  const population = result.records.find((item) => item.indicator_code === 'PHY-129') as Record<string, any>;
  assert.equal(population.score_1_5, null);
  assert.equal(population.source.device, 'local-portals-catalog');
  assert.equal(population.quality.flags.includes('AUTO_EXTRACTED_PORTALS'), true);
});

test('derives clipped road and land-use densities from the local PBF catalog', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typology-pbf-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'geojson', 'new_data', 'iran-provinces', 'provinces', 'IR-23_تهران'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public', 'data', 'pbf'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'data', 'pbf', 'roads.json'), JSON.stringify({ source: 'OSM', lines: [
    { t: 'primary', c: [[51.01, 35.01], [51.05, 35.05]] },
    { t: 'secondary', c: [[52, 36], [52.1, 36.1]] },
  ] }));
  fs.writeFileSync(path.join(root, 'public', 'data', 'pbf', 'landuse.json'), JSON.stringify({ source: 'OSM', polys: [
    { t: 'forest', c: [[[51.02, 35.02], [51.03, 35.02], [51.03, 35.03], [51.02, 35.03], [51.02, 35.02]]] },
    { t: 'industrial', c: [[[51.04, 35.04], [51.045, 35.04], [51.045, 35.045], [51.04, 35.045], [51.04, 35.04]]] },
    { t: 'industrial', c: [[[52, 36], [52.01, 36], [52.01, 36.01], [52, 36.01], [52, 36]]] },
  ] }));
  const run = {
    request: { province: 'تهران', reference_year: 1405 },
    boundary: { geojson: { type: 'Polygon', coordinates: [[[51, 35], [51.1, 35], [51.1, 35.1], [51, 35.1], [51, 35]]] }, area_km2: 100 },
    tasks: [
      task('PHY-016', 'دسترسی به معابر شریانی', 'spatial_statistic'),
      task('PHY-102', 'استفاده از مکان‌های کافی و فضای باز', 'per_capita_or_density'),
      task('PHY-160', 'کاربری‌های ناسازگار', 'formula_specific'),
    ],
  } as unknown as TypologyRun;
  const result = buildLocalTypologyEvidence(run, { rootDirectory: root });
  assert.equal(result.records.length, 3);
  assert.ok(result.records.every((record) => ((record.quality as { flags: string[] }).flags).includes('AUTO_EXTRACTED_PBF')));
  assert.ok(result.records.some((record) => record.unit === 'km/km2'));
  assert.ok(result.records.some((record) => record.unit === 'km2/km2'));
  const industrial = result.records.find((record) => record.indicator_code === 'PHY-160') as Record<string, any> | undefined;
  assert.ok(industrial);
  assert.match(String((industrial?.source as Record<string, unknown>)?.dataset_id), /industrial/);
  assert.ok(((industrial?.quality as { flags?: string[] })?.flags ?? []).includes('AUTO_EXTRACTED_PBF'));
});
