import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import {
  aggregateContributions,
  collectSourceEvidence,
  mapSourceResult,
  mergeIndicatorValues,
  scoreRawValue,
  type SourceIndicatorContribution,
} from './sourceEvidence';
import { getManifest, validateManifests } from './sources/manifests';
import { SourceRuntime } from './sources/runtime';
import type { Connector, SourceResult } from './sources/types';
import { buildDecisionSupportRouter } from './decisionSupportRouter';
import { ALGORITHM_INDICATORS } from '../src/algorithm/algorithmIndicators';

function fakeResult(sourceId: string, variables: SourceResult['variables']): SourceResult {
  return {
    sourceId,
    variables,
    provenance: {
      sourceId,
      endpoint: 'https://example.invalid',
      license: 'CC-BY-4.0',
      attribution: 'test',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      latencyMs: 1,
      cache: 'MISS',
      provider: 'live',
      evidenceOnly: false,
    },
  };
}

function fakeConnector(id: string, variables: SourceResult['variables']): Connector {
  const manifest = getManifest(id);
  if (!manifest) throw new Error(`missing manifest ${id}`);
  return { manifest, query: async () => fakeResult(id, variables) };
}

test('scoring maps raw values onto 0..100 in both directions', () => {
  // کمتر بهتر: best < worst
  assert.equal(scoreRawValue(5, 5, 75), 100);
  assert.equal(scoreRawValue(75, 5, 75), 0);
  assert.equal(scoreRawValue(40, 5, 75), 50);
  // بیشتر بهتر
  assert.equal(scoreRawValue(12, 12, 0), 100);
  assert.equal(scoreRawValue(0, 12, 0), 0);
  assert.equal(scoreRawValue(30, 12, 0), 100, 'بالاتر از best روی ۱۰۰ میماند');
  assert.equal(scoreRawValue(40, 5, 75), 50);
  assert.equal(scoreRawValue(20, 5, 5), null, 'best = worst بیمعناست');
});

test('evidence_only sources never produce score contributions', () => {
  const manifest = getManifest('who-gho');
  assert.ok(manifest);
  const mapped = mapSourceResult(manifest, fakeResult('who-gho', [
    { variable: 'WHS6_102', value: 1.6, unit: 'per 10k', indicatorCode: 'P4' },
  ]));
  assert.equal(mapped.contributions.length, 0);
  assert.equal(mapped.evidenceOnly.length, 1);
  assert.equal(mapped.ledger[0].scoreEligible, false);
  assert.equal(mapped.ledger[0].status, 'evidence_only');
});

test('score_eligible sources produce weighted scores and proxy is flagged', () => {
  const manifest = getManifest('openaq');
  assert.ok(manifest);
  const mapped = mapSourceResult(manifest, fakeResult('openaq', [
    { variable: 'pm25_station', value: 5, unit: 'µg/m³', indicatorCode: 'N3' },
    { variable: 'pm10_station', value: 15, unit: 'µg/m³', indicatorCode: 'N3' },
    { variable: 'station_count', value: 3, unit: 'count' },
  ]));
  assert.equal(mapped.contributions.length, 2);
  assert.equal(mapped.contributions[0].score, 100);
  assert.equal(mapped.contributions[0].weight, 1.5);
  assert.equal(mapped.contributions[0].proxy, false);
  const aggregate = aggregateContributions(mapped.contributions)[0];
  assert.equal(aggregate.indicatorCode, 'N3');
  assert.equal(aggregate.score, 100, 'هر دو مؤلفه در بهترین حالتاند');

  const poiManifest = getManifest('osm-pois');
  assert.ok(poiManifest);
  const poi = mapSourceResult(poiManifest, fakeResult('osm-pois', [
    { variable: 'poi_education', value: 12, unit: 'count', indicatorCode: 'R3' },
  ]));
  assert.equal(poi.contributions[0].proxy, true);
  assert.equal(poi.ledger[0].source.tier, 'proxy');
});

test('aggregation across sources is a weighted mean and drops unknown codes', () => {
  const contributions: SourceIndicatorContribution[] = [
    { indicatorCode: 'N3', sourceId: 'openaq', variable: 'pm25_station', rawValue: 5, score: 100, weight: 1.5, proxy: false, cache: 'MISS', provider: 'live' },
    { indicatorCode: 'N3', sourceId: 'open-meteo-air', variable: 'pm2_5', rawValue: 75, score: 0, weight: 1, proxy: false, cache: 'MISS', provider: 'live' },
  ];
  const [aggregate] = aggregateContributions(contributions);
  assert.equal(aggregate.score, 60, '(100*1.5 + 0*1) / 2.5 = 60');
  assert.deepEqual(aggregate.sources, ['open-meteo-air', 'openaq']);
  assert.equal(aggregate.proxyOnly, false);
});

test('merge policies keep or override existing measurements', () => {
  const aggregates = aggregateContributions([
    { indicatorCode: 'N3', sourceId: 'openaq', variable: 'pm25_station', rawValue: 5, score: 100, weight: 1, proxy: false, cache: 'MISS', provider: 'live' },
    { indicatorCode: 'R1', sourceId: 'osrm', variable: 'travel_time_health_min', rawValue: 30, score: 37.5, weight: 1, proxy: false, cache: 'MISS', provider: 'live' },
  ]);
  const fill = mergeIndicatorValues({ N3: 42 }, aggregates, 'fill_missing');
  assert.equal(fill.values.N3, 42, 'مقدار موجود دستنخورده میماند');
  assert.deepEqual(fill.applied, ['R1']);
  assert.deepEqual(fill.skipped, ['N3']);

  const prefer = mergeIndicatorValues({ N3: 42 }, aggregates, 'prefer_live');
  assert.equal(prefer.values.N3, 100);
  assert.deepEqual(prefer.applied, ['N3', 'R1']);
});

test('a failing source becomes a shortage while others still contribute', async () => {
  const runtime = new SourceRuntime({ fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch });
  const connectors: Connector[] = [
    fakeConnector('openaq', [{ variable: 'pm25_station', value: 5, unit: 'µg/m³', indicatorCode: 'N3' }]),
    {
      manifest: getManifest('osrm') as Connector['manifest'],
      query: async () => { throw new Error('OSRM needs destinations'); },
    },
  ];
  const bundle = await collectSourceEvidence({ runtime, connectors, point: { lat: 35.72, lng: 51.33 } });
  assert.equal(bundle.shortages.length, 1);
  assert.equal(bundle.shortages[0].sourceId, 'osrm');
  assert.equal(bundle.shortages[0].kind, 'error');
  assert.equal(bundle.indicators.N3, 100);
  assert.equal(bundle.coverage.sourcesQueried, 2);
  assert.equal(bundle.coverage.sourcesContributing, 1);
});

test('a null measurement is never turned into a zero score', async () => {
  const runtime = new SourceRuntime();
  const connectors: Connector[] = [
    fakeConnector('openaq', [
      { variable: 'pm25_station', value: null, unit: 'µg/m³', indicatorCode: 'N3' },
      { variable: 'station_count', value: 2, unit: 'count' },
    ]),
  ];
  const bundle = await collectSourceEvidence({ runtime, connectors, point: { lat: 35.72, lng: 51.33 } });
  assert.deepEqual(bundle.indicators, {});
  assert.equal(bundle.aggregates.length, 0);
  assert.equal(bundle.evidenceOnly.length, 2, 'مقدار خالی در دفتر شواهد میماند، نه در امتیاز');
  assert.ok(bundle.ledger.every(entry => entry.scoreEligible === false));
});

test('a zero count from a proxy feed is a coverage gap, not a zero score', () => {
  const manifest = getManifest('osm-pois');
  assert.ok(manifest);
  const mapped = mapSourceResult(manifest, fakeResult('osm-pois', [
    { variable: 'poi_transport', value: 0, unit: 'count', indicatorCode: 'P5' },
    { variable: 'poi_education', value: 39, unit: 'count', indicatorCode: 'R3' },
  ]));
  assert.equal(mapped.contributions.length, 1, 'فقط فید غیرصفر امتیاز می‌سازد');
  assert.equal(mapped.contributions[0].indicatorCode, 'R3');
  const dropped = mapped.evidenceOnly.find(e => e.variable === 'poi_transport');
  assert.ok(dropped);
  assert.ok(dropped.reason?.includes('پوشش ناقص'));
  assert.deepEqual(mapped.ledger.find(e => e.evidenceCode === 'osm-pois:poi_transport')?.quality.flags, ['proxy-zero-not-scored']);
  assert.equal(mapped.ledger.find(e => e.evidenceCode === 'osm-pois:poi_transport')?.scoreEligible, false);
});

test('manifests refuse a score_eligible source with no scored feed and vice versa', () => {
  const validation = validateManifests();
  assert.deepEqual(validation.errors, []);
  assert.ok(validation.ok);
  for (const id of ['openaq', 'osrm', 'osm-pois', 'open-meteo-air']) {
    const manifest = getManifest(id);
    assert.equal(manifest?.role, 'score_eligible', `${id} باید مجاز به امتیاز باشد`);
    assert.ok(manifest?.feeds.some(f => f.indicatorCode && f.scoring), `${id} باید متغیر امتیازده داشته باشد`);
  }
  for (const id of ['firms', 'glofas-flood', 'who-gho']) {
    const manifest = getManifest(id);
    assert.equal(manifest?.role, 'evidence_only', `${id} باید فقط شاهد باشد`);
    assert.ok(manifest?.feeds.every(f => !f.scoring), `${id} نباید متغیر امتیازده داشته باشد`);
  }
});

/** همهٔ ۴۰ شاخص با مقدار یکسان، به‌جز شاخص‌هایی که باید از منبع زنده بیایند */
function allIndicatorsExcept(...excluded: string[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const indicator of ALGORITHM_INDICATORS) {
    if (!excluded.includes(indicator.code)) values[indicator.code] = 55;
  }
  return values;
}

test('live sources change the analysis outcome through /analyze', async (context) => {
  const runtime = new SourceRuntime({ fetchImpl: (async () => { throw new Error('no network in test'); }) as unknown as typeof fetch });
  const connectors: Connector[] = [
    fakeConnector('openaq', [{ variable: 'pm25_station', value: 5, unit: 'µg/m³', indicatorCode: 'N3' }]),
  ];
  const app = express();
  app.use(express.json());
  app.use('/api/decision-support', buildDecisionSupportRouter({ sourceRuntime: runtime, sourceConnectors: connectors }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/decision-support`;

  // شش سرمایه سنجیده شده؛ سرمایهٔ طبیعی فقط از منبع زنده میآید.
  // N3 سنجیده نشده است؛ تنها منبع زندهٔ مجاز به امتیاز آن را تأمین می‌کند.
  const indicatorValues = allIndicatorsExcept('N3');
  const request = { neighborhoodName: 'آزمون منابع زنده', cityOrCounty: 'تهران', province: 'تهران', indicatorValues };

  const withoutSources = await fetch(`${base}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  assert.equal(withoutSources.status, 200);
  const baseline = (await withoutSources.json()) as { data: { card: { qualityVerdict: { Q: number; R: number } } } };

  const withSources = await fetch(`${base}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, liveSources: { lat: 35.7219, lng: 51.3347 } }),
  });
  assert.equal(withSources.status, 200);
  const payload = (await withSources.json()) as {
    success: boolean;
    data: {
      card: { quality?: unknown; neighborhoodName?: string; qualityVerdict: { Q: number; R: number } };
      sourceContribution: {
        policy: string;
        applied: string[];
        skipped: string[];
        indicators: Record<string, number>;
        coverage: { sourcesContributing: number };
        ledger: unknown[];
      };
    };
  };
  assert.equal(payload.success, true);
  assert.equal(payload.data.sourceContribution.policy, 'fill_missing');
  assert.ok(payload.data.sourceContribution.applied.includes('N3'), 'N3 باید از منبع زنده پر شود');
  assert.equal(payload.data.sourceContribution.indicators.N3, 100);
  assert.equal(payload.data.sourceContribution.coverage.sourcesContributing, 1);
  assert.ok(payload.data.sourceContribution.ledger.length > 0);
  assert.ok(payload.data.card);

  // اثر واقعی بر امتیاز: N3 از ۵۵ (نامعلوم) به ۱۰۰ (اندازه‌گیری‌شدهٔ پاک) می‌رود
  const card = payload.data.card as unknown as { qualityVerdict: { Q: number; R: number } };
  assert.ok(
    card.qualityVerdict.Q > baseline.data.card.qualityVerdict.Q,
    `Q باید با ورود منبع زنده بالا برود: ${baseline.data.card.qualityVerdict.Q} → ${card.qualityVerdict.Q}`,
  );
  assert.ok(card.qualityVerdict.R > baseline.data.card.qualityVerdict.R);
});

test('prefer_live overrides a supplied value while fill_missing preserves it', async (context) => {
  const runtime = new SourceRuntime();
  const connectors: Connector[] = [
    fakeConnector('openaq', [{ variable: 'pm25_station', value: 75, unit: 'µg/m³', indicatorCode: 'N3' }]),
  ];
  const app = express();
  app.use(express.json());
  app.use('/api/decision-support', buildDecisionSupportRouter({ sourceRuntime: runtime, sourceConnectors: connectors }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/decision-support`;

  const request = {
    neighborhoodName: 'آزمون سیاست ادغام',
    indicatorValues: allIndicatorsExcept(),
  };
  const baseline = (await (await fetch(`${base}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, indicatorValues: { ...request.indicatorValues, N3: 80 } }),
  })).json()) as { data: { card: { qualityVerdict: { Q: number } } } };

  const response = await fetch(`${base}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...request,
      indicatorValues: { ...request.indicatorValues, N3: 80 },
      liveSources: { lat: 35.7219, lng: 51.3347, mergePolicy: 'prefer_live' },
    }),
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    data: { sourceContribution: { applied: string[]; skipped: string[]; indicators: Record<string, number> }; card: { qualityVerdict: { Q: number } } };
  };
  assert.deepEqual(payload.data.sourceContribution.applied, ['N3']);
  assert.deepEqual(payload.data.sourceContribution.skipped, []);
  assert.equal(payload.data.sourceContribution.indicators.N3, 0, 'PM2.5 = 75 µg/m³ بدترین امتیاز است');
  assert.ok(
    payload.data.card.qualityVerdict.Q < baseline.data.card.qualityVerdict.Q,
    'وقتی مقدار ایستگاهی بدتر از مقدار ورودی باشد، Q باید پایین بیاید',
  );
});

test('the source-evidence endpoint reports shortages instead of inventing data', async (context) => {
  const runtime = new SourceRuntime();
  const app = express();
  app.use(express.json());
  app.use('/api/decision-support', buildDecisionSupportRouter({
    sourceRuntime: runtime,
    sourceConnectors: [],
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/decision-support`;

  const missingLocation = await fetch(`${base}/source-evidence`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(missingLocation.status, 422);
  assert.equal((await missingLocation.json() as { error: { code: string } }).error.code, 'INVALID_LOCATION');

  const outOfBounds = await fetch(`${base}/source-evidence`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lat: 1, lng: 1 }),
  });
  assert.equal(outOfBounds.status, 422);

  const empty = await fetch(`${base}/source-evidence`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lat: 35.7219, lng: 51.3347 }),
  });
  assert.equal(empty.status, 200);
  const bundle = (await empty.json()) as { data: { indicators: Record<string, number>; coverage: { sourcesQueried: number } } };
  assert.deepEqual(bundle.data.indicators, {}, 'بدون کانکتور هیچ عددی ساخته نمیشود');
});
