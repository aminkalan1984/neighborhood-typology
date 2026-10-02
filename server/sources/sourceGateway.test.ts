import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSourceRouter } from './router';
import { SourceRuntime } from './runtime';
import { validateManifests, declaredRegistryIds, indicatorsForSource } from './manifests';
import type { SourceResult } from './types';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

interface MockState {
  calls: string[];
  failAir: boolean;
  nowMs: number;
  /** رفتار فایل CSV فِर्म्स: نقطهٔ داغ داخل پنجره، فقط بیرون، یا فید خالی */
  firmsMode: 'inside' | 'outside' | 'empty';
  floodMode: 'values' | 'nulls';
  openaqLatest: boolean;
}

/** پاسخ با بدنهٔ متنی تا کانکتورهای CSV هم تست شوند */
function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body) as unknown,
    text: async () => body,
  } as unknown as Response;
}

const FIRMS_HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight';

function firmsCsv(mode: MockState['firmsMode']): string {
  if (mode === 'empty') return FIRMS_HEADER;
  const inside = '35.7219,51.3347,340.1,0.33,0.55,2026-09-19,0858,N,nominal,2.0NRT,300.1,12.5,D';
  const outside = '60.1000,90.1000,340.1,0.33,0.55,2026-09-19,0858,N,nominal,2.0NRT,300.1,1.0,D';
  return [FIRMS_HEADER, ...(mode === 'inside' ? [inside, outside] : [outside])].join('\n');
}

function createMockFetch(state: MockState) {
  return (async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    state.calls.push(`${init?.method ?? 'GET'} ${href}`);
    if (href.includes('air-quality-api.open-meteo.com')) {
      if (state.failAir) return jsonResponse({ error: 'down' }, 503);
      return jsonResponse({
        current: { pm2_5: 41.5, nitrogen_dioxide: 33, sulphur_dioxide: 7.2, pm10: 62, ozone: 90 },
        current_units: { pm2_5: 'µg/m³' },
      });
    }
    if (href.includes('ghoapi.azureedge.net')) {
      return jsonResponse({ value: [{ NumericValue: 1.6, TimeDim: 2020, SpatialDim: 'IRN' }] });
    }
    if (href.includes('api.worldbank.org')) {
      return jsonResponse([{}, [{ value: 3.1, date: '2023' }]]);
    }
    if (href.includes('firms.modaps.eosdis.nasa.gov')) {
      return textResponse(firmsCsv(state.firmsMode));
    }
    if (href.includes('router.project-osrm.org')) {
      return jsonResponse({ code: 'Ok', routes: [{ duration: 600, distance: 5000 }] });
    }
    if (href.includes('flood-api.open-meteo.com')) {
      const series = state.floodMode === 'values' ? [1.5, 2.5, null] : [null, null];
      return jsonResponse({ daily: { river_discharge: series } });
    }
    if (href.includes('api.openaq.org') && href.includes('/latest')) {
      if (!state.openaqLatest) return jsonResponse({ message: 'Unauthorized' }, 401);
      return jsonResponse({
        results: [
          { value: 20, parameter: { name: 'pm25' } },
          { value: 40, parameter: { name: 'pm10' } },
        ],
      });
    }
    if (href.includes('api.openaq.org')) {
      return jsonResponse({ results: [{ id: 11, name: 'Station A' }, { id: 12, name: 'Station B' }] });
    }
    return jsonResponse({ elements: [] });
  }) as unknown as typeof fetch;
}

async function startGateway(options: { localPoiPath?: string } = {}) {
  const state: MockState = {
    calls: [],
    failAir: false,
    nowMs: 1_700_000_000_000,
    firmsMode: 'inside',
    floodMode: 'values',
    openaqLatest: true,
  };
  const runtime = new SourceRuntime({
    fetchImpl: createMockFetch(state),
    now: () => state.nowMs,
    maxRetries: 1,
    retryDelayMs: 1,
    timeoutMs: 1_000,
  });
  const app = express();
  app.use('/api/sources', createSourceRouter({ runtime, localPoiPath: options.localPoiPath }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return {
    state,
    runtime,
    server,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sources`,
  };
}

test('manifests stay linked to the existing registries and never zero-fill', () => {
  const validation = validateManifests();
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.warnings, []);
  assert.equal(validation.ok, true);
  assert.ok(declaredRegistryIds().includes('OPEN_METEO'));
  assert.deepEqual(indicatorsForSource('open-meteo-air').includes('N3'), true);
});

test('catalog exposes every declared source with health and role', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(api.base);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { success: boolean; data: { count: number; sources: Array<{ id: string; role: string; health: { state: string } }> } };
  assert.equal(body.success, true);
  assert.ok(body.data.count >= 12);
  const air = body.data.sources.find(s => s.id === 'open-meteo-air');
  assert.equal(air?.role, 'score_eligible');
  assert.equal(air?.health.state, 'closed');
  const who = body.data.sources.find(s => s.id === 'who-gho');
  assert.equal(who?.role, 'evidence_only');
});

test('point source query returns variables and serves the second call from cache', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const first = await fetch(`${api.base}/open-meteo-air/query?lat=35.7&lng=51.4`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-cache'), 'MISS');
  const payload = (await first.json()) as { success: boolean; data: SourceResult };
  assert.equal(payload.success, true);
  const pm25 = payload.data.variables.find(v => v.variable === 'pm2_5');
  assert.equal(pm25?.value, 41.5);
  assert.equal(pm25?.indicatorCode, 'N3');
  assert.equal(payload.data.provenance.evidenceOnly, false);

  const upstreamAfterFirst = api.state.calls.length;
  const second = await fetch(`${api.base}/open-meteo-air/query?lat=35.7&lng=51.4`);
  assert.equal(second.headers.get('x-cache'), 'HIT');
  assert.equal(api.state.calls.length, upstreamAfterFirst, 'cached call must not hit upstream');
});

test('stale cache is served when the upstream fails after the ttl', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const first = await fetch(`${api.base}/open-meteo-air/query?lat=35.7&lng=51.4`);
  assert.equal(first.status, 200);

  api.state.nowMs += 60 * 60 * 1000; // past the 15-minute fresh ttl
  api.state.failAir = true;

  const second = await fetch(`${api.base}/open-meteo-air/query?lat=35.7&lng=51.4`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-cache'), 'STALE');
  assert.equal(second.headers.get('warning'), '110 - response is stale');
  const payload = (await second.json()) as { data: SourceResult };
  assert.equal(payload.data.variables.find(v => v.variable === 'pm2_5')?.value, 41.5);
});

test('national sources answer without coordinates, point sources do not', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const national = await fetch(`${api.base}/worldbank/query`);
  assert.equal(national.status, 200);
  const body = (await national.json()) as { data: SourceResult };
  assert.equal(body.data.provenance.provider, 'live');
  assert.equal(body.data.variables.find(v => v.variable === 'NY.GDP.MKTP.KD.ZG')?.value, 3.1);

  const missingPoint = await fetch(`${api.base}/osm-walkability/query`);
  assert.equal(missingPoint.status, 400);
  const error = (await missingPoint.json()) as { error: { code: string } };
  assert.equal(error.error.code, 'POINT_REQUIRED');
});

test('unknown sources and out-of-bounds coordinates are rejected', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const unknown = await fetch(`${api.base}/not-a-source/query?lat=35.7&lng=51.4`);
  assert.equal(unknown.status, 404);

  const outOfBounds = await fetch(`${api.base}/open-meteo-air/query?lat=1&lng=1`);
  assert.equal(outOfBounds.status, 400);
  const error = (await outOfBounds.json()) as { error: { code: string } };
  assert.equal(error.error.code, 'INVALID_QUERY');
});

test('an empty upstream payload is reported as a shortage, never as a measured zero', async (context) => {
  const api = await startGateway({ localPoiPath: '/nonexistent/pois.json' });
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${api.base}/osm-pois/query?lat=35.7219&lng=51.3347`);
  assert.equal(response.status, 502);
  const body = (await response.json()) as { success: boolean; error: { code: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'SOURCE_FAILED');
});

test('health reflects provider activity after queries', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  await fetch(`${api.base}/worldbank/query`);
  const health = await fetch(`${api.base}/worldbank/health`);
  assert.equal(health.status, 200);
  const body = (await health.json()) as { data: { state: string; successes: number; requests: number } };
  assert.equal(body.data.state, 'closed');
  assert.ok(body.data.successes >= 1);
  assert.ok(body.data.requests >= body.data.successes);
});

// ─── چهار منبع تازه: OpenAQ، FIRMS، OSRM، GloFAS Flood ─────

test('OpenAQ without a key is a configuration shortage, never synthetic air data', async (context) => {
  const previous = process.env.OPENAQ_API_KEY;
  delete process.env.OPENAQ_API_KEY;
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => {
    if (previous === undefined) delete process.env.OPENAQ_API_KEY;
    else process.env.OPENAQ_API_KEY = previous;
    api.server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`${api.base}/openaq/query?lat=35.7219&lng=51.3347`);
  assert.equal(response.status, 503);
  const body = (await response.json()) as { success: boolean; error: { code: string; envVar?: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'SOURCE_NOT_CONFIGURED');
  assert.equal(body.error.envVar, 'OPENAQ_API_KEY');
  assert.equal(api.state.calls.length, 0, 'بدون کلید هیچ درخواستی به OpenAQ نمی‌رود');
});

test('OpenAQ averages the nearest stations\u2019 latest readings when a key is present', async (context) => {
  const previous = process.env.OPENAQ_API_KEY;
  process.env.OPENAQ_API_KEY = 'test-key';
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => {
    if (previous === undefined) delete process.env.OPENAQ_API_KEY;
    else process.env.OPENAQ_API_KEY = previous;
    api.server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`${api.base}/openaq/query?lat=35.7219&lng=51.3347`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { variables: Array<{ variable: string; value: number | null }> } };
  const byName = new Map(body.data.variables.map(v => [v.variable, v.value]));
  assert.equal(byName.get('pm25_station'), 20);
  assert.equal(byName.get('pm10_station'), 40);
  assert.equal(byName.get('station_count'), 2);
  assert.ok(api.state.calls.some(call => call.includes('/v3/locations/11/latest')));
});

test('FIRMS counts only hotspots inside the bbox and reports a genuine zero', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const inside = await fetch(`${api.base}/firms/query?bbox=51.30,35.70,51.40,35.75`);
  assert.equal(inside.status, 200);
  const insideBody = (await inside.json()) as { data: { variables: Array<{ variable: string; value: number | null }> } };
  const map = new Map(insideBody.data.variables.map(v => [v.variable, v.value]));
  assert.equal(map.get('fire_hotspots'), 1, 'نقطهٔ داغ بیرون پنجره شمرده نمی‌شود');
  assert.equal(map.get('fire_frp_mw'), 12.5);

  api.state.firmsMode = 'outside';
  const zero = await fetch(`${api.base}/firms/query?bbox=51.30,35.70,51.40,35.75&at=2026-09-20T00:00:00Z`);
  assert.equal(zero.status, 200);
  const zeroBody = (await zero.json()) as { data: { variables: Array<{ variable: string; value: number | null }> } };
  assert.equal(zeroBody.data.variables.find(v => v.variable === 'fire_hotspots')?.value, 0, 'فید کامل + نبود آتش = صفر واقعی');
});

test('FIRMS treats an empty feed as a shortage instead of zero fire', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));
  api.state.firmsMode = 'empty';

  const response = await fetch(`${api.base}/firms/query?bbox=51.30,35.70,51.40,35.75`);
  assert.equal(response.status, 502);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, 'SOURCE_FAILED');
});

test('OSRM routes to the nearest health and education anchors', async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-poi-'));
  const poiPath = path.join(dir, 'pois.json');
  fs.writeFileSync(poiPath, JSON.stringify({
    points: [
      { t: 'hospital', n: 'بیمارستان آزمون', c: [51.40, 35.73] },
      { t: 'school', n: 'دبستان آزمون', c: [51.36, 35.72] },
      { t: 'park', n: 'پارک', c: [51.35, 35.71] },
    ],
  }), 'utf8');
  const api = await startGateway({ localPoiPath: poiPath });
  context.after(() => new Promise<void>((resolve, reject) => {
    fs.rmSync(dir, { recursive: true, force: true });
    api.server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`${api.base}/osrm/query?lat=35.7219&lng=51.3347`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { variables: Array<{ variable: string; value: number | null }>; provenance: { provider: string } } };
  const map = new Map(body.data.variables.map(v => [v.variable, v.value]));
  assert.equal(map.get('travel_time_health_min'), 10, '600 ثانیه = ۱۰ دقیقه');
  assert.equal(map.get('travel_time_education_min'), 10);
  assert.equal(map.get('route_distance_km'), 5);
  assert.equal(body.data.provenance.provider, 'live');
  assert.equal(api.state.calls.filter(call => call.includes('project-osrm.org')).length, 2, 'یک مسیر برای هر مقصد');
});

test('OSRM without any local anchor is a shortage, not an invented travel time', async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-poi-empty-'));
  const poiPath = path.join(dir, 'pois.json');
  fs.writeFileSync(poiPath, JSON.stringify({ points: [{ t: 'park', c: [51.35, 35.71] }] }), 'utf8');
  const api = await startGateway({ localPoiPath: poiPath });
  context.after(() => new Promise<void>((resolve, reject) => {
    fs.rmSync(dir, { recursive: true, force: true });
    api.server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`${api.base}/osrm/query?lat=35.7219&lng=51.3347`);
  assert.equal(response.status, 502);
  assert.equal(api.state.calls.filter(call => call.includes('project-osrm.org')).length, 0);
});

test('GloFAS flood reports discharge stats and refuses an all-null series', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${api.base}/glofas-flood/query?lat=35.7219&lng=51.3347`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { variables: Array<{ variable: string; value: number | null }> } };
  const map = new Map(body.data.variables.map(v => [v.variable, v.value]));
  assert.equal(map.get('river_discharge_max'), 2.5);
  assert.equal(map.get('river_discharge_mean'), 2);

  api.state.floodMode = 'nulls';
  const shortage = await fetch(`${api.base}/glofas-flood/query?lat=35.7219&lng=51.3347&at=2026-09-20T00:00:00Z`);
  assert.equal(shortage.status, 502);
  const shortageBody = (await shortage.json()) as { error: { code: string } };
  assert.equal(shortageBody.error.code, 'SOURCE_FAILED');
});

test('every declared source is queryable and exposes its scored indicators', async (context) => {
  const api = await startGateway();
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const catalog = await fetch(api.base);
  const body = (await catalog.json()) as {
    data: {
      sources: Array<{ id: string; role: string; scoredIndicators: string[] }>;
      scoreEligible: string[];
      validation: { ok: boolean };
    };
  };
  assert.equal(body.data.validation.ok, true);
  assert.deepEqual(
    [...body.data.scoreEligible].sort(),
    ['healthsites', 'open-meteo-air', 'openaq', 'osm-pois', 'osm-walkability', 'osrm'],
  );
  for (const source of body.data.sources) {
    if (source.role === 'score_eligible') assert.ok(source.scoredIndicators.length > 0, `${source.id} باید شاخص امتیازده داشته باشد`);
    else assert.deepEqual(source.scoredIndicators, [], `${source.id} نباید امتیاز بدهد`);
  }
});
