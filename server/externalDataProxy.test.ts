import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createExternalDataProxyRouter } from './externalDataProxy';

async function startProxy(fetchImpl: typeof fetch, options: { now?: () => number; timeoutMs?: number; cacheTtlMs?: number; staleTtlMs?: number; maxRetries?: number; retryDelayMs?: number; localPoiPath?: string; overpassEndpoints?: string[] } = {}) {
  const app = express();
  app.use('/api/external-data', createExternalDataProxyRouter({ fetch: fetchImpl, ...options }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  return { server, base: `http://127.0.0.1:${port}/api/external-data` };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('builds a valid WHO filter and serves the second request from cache', async (context) => {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input));
    return jsonResponse({ value: [{ NumericValue: 4, TimeDim: 2024 }] });
  };
  const proxy = await startProxy(fetchImpl);
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const first = await fetch(`${proxy.base}/who/WHS6_102?filter=TimeDim%20gt%202020`, { headers: { 'x-correlation-id': 'test-correlation' } });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-correlation-id'), 'test-correlation');
  assert.equal(first.headers.get('x-cache'), 'MISS');
  const second = await fetch(`${proxy.base}/who/WHS6_102?filter=TimeDim%20gt%202020`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-cache'), 'HIT');
  assert.equal(urls.length, 1);
  const parsed = new URL(urls[0]);
  assert.equal(parsed.searchParams.get('$filter'), "SpatialDim eq 'IRN' and TimeDim gt 2020");
  assert.equal(parsed.searchParams.get('$top'), '1');
});

test('retries transient World Bank failures and reports provider telemetry', async (context) => {
  let calls = 0;
  let requestedUrl = '';
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input);
    calls += 1;
    return calls === 1 ? jsonResponse({ error: 'busy' }, 503) : jsonResponse([{ page: 1 }, [{ value: 12 }]]);
  };
  const proxy = await startProxy(fetchImpl, { retryDelayMs: 0, maxRetries: 1 });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${proxy.base}/worldbank/NY.GDP.MKTP.KD.ZG`);
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal(new URL(requestedUrl).searchParams.get('mrnev'), '1');
  const health = await fetch(`${proxy.base}/health`).then((item) => item.json()) as { providers: Array<{ provider: string; requests: number; successes: number }> };
  const worldBank = health.providers.find((provider) => provider.provider === 'worldbank');
  assert.equal(worldBank?.requests, 2);
  assert.equal(worldBank?.successes, 1);
});

test('returns stale cache data when the upstream becomes unavailable', async (context) => {
  let clock = 0;
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls > 1) throw new Error('network down');
    return jsonResponse([{ page: 1 }, [{ value: 42 }]]);
  };
  const proxy = await startProxy(fetchImpl, { now: () => clock, cacheTtlMs: 100, staleTtlMs: 500, maxRetries: 0 });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const first = await fetch(`${proxy.base}/worldbank/SL.UEM.TOTL.ZS`);
  assert.equal(first.headers.get('x-cache'), 'MISS');
  clock = 200;
  const second = await fetch(`${proxy.base}/worldbank/SL.UEM.TOTL.ZS`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-cache'), 'STALE');
  assert.equal(second.headers.get('warning'), '110 - response is stale');
  assert.deepEqual(await second.json(), [{ page: 1 }, [{ value: 42 }]]);
});

test('falls back to Overpass when Healthsites is unavailable', async (context) => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('healthsites.io')) throw new Error('provider down');
    return jsonResponse({ elements: [{ id: 1, lat: 35.7, lon: 51.4, tags: { amenity: 'hospital', name: 'Test Hospital' } }] });
  };
  const proxy = await startProxy(fetchImpl, { maxRetries: 0 });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${proxy.base}/healthsites?lat=35.7&lng=51.4`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-provider-fallback'), 'osm-overpass');
  const payload = await response.json() as { features: Array<{ properties?: { source?: string; type?: string } }> };
  assert.equal(payload.features[0].properties?.source, 'OSM_OVERPASS_FALLBACK');
  assert.equal(payload.features[0].properties?.type, 'hospital');
  assert.ok(requested.some((url) => url.includes('overpass-api.de')));
});

test('enforces the provider deadline when fetch ignores AbortSignal', async (context) => {
  const fetchImpl: typeof fetch = async () => await new Promise<Response>(() => undefined);
  const proxy = await startProxy(fetchImpl, { timeoutMs: 20, maxRetries: 0 });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const started = Date.now();
  const response = await fetch(`${proxy.base}/worldbank/SL.UEM.TOTL.ZS`);
  const elapsed = Date.now() - started;
  assert.equal(response.status, 504);
  assert.ok(elapsed < 500, `expected a bounded timeout, received ${elapsed}ms`);
  const payload = await response.json() as { error?: { message?: string } };
  assert.match(payload.error?.message ?? '', /timed out after 20ms/);
});

test('serves UNESCO education series through the cached indicator proxy', async (context) => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requested.push(String(input));
    return jsonResponse([{ page: 1 }, [{ value: 91.2, date: '2024' }]]);
  };
  const proxy = await startProxy(fetchImpl);
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const first = await fetch(`${proxy.base}/unesco/SE.ADT.LITR.ZS`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-provider'), 'unesco');
  assert.equal(first.headers.get('x-provider-fallback'), 'worldbank');
  assert.equal(first.headers.get('x-cache'), 'MISS');
  const second = await fetch(`${proxy.base}/unesco/SE.ADT.LITR.ZS`);
  assert.equal(second.headers.get('x-cache'), 'HIT');
  assert.equal(requested.length, 1);
  const upstream = new URL(requested[0]);
  assert.match(upstream.pathname, /SE\.ADT\.LITR\.ZS$/);
  assert.equal(upstream.searchParams.get('mrnev'), '1');
});

test('falls back from retired WHO series to an equivalent World Bank indicator', async (context) => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('ghoapi.azureedge.net')) return jsonResponse({ error: 'retired' }, 404);
    return jsonResponse([{ page: 1 }, [{ value: 1.85, date: '2019' }]]);
  };
  const proxy = await startProxy(fetchImpl, { maxRetries: 0 });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${proxy.base}/who/WHS6_102`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-provider-fallback'), 'worldbank');
  const payload = await response.json() as { value?: Array<{ NumericValue?: number; SourceIndicatorCode?: string }> };
  assert.equal(payload.value?.[0]?.NumericValue, 1.85);
  assert.equal(payload.value?.[0]?.SourceIndicatorCode, 'SH.MED.BEDS.ZS');
  assert.ok(requested.some((url) => url.includes('SH.MED.BEDS.ZS')));
});

test('uses the local OSM extract when Healthsites and Overpass are unavailable', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-external-local-'));
  const localPoiPath = path.join(directory, 'pois.json');
  fs.writeFileSync(localPoiPath, JSON.stringify({ points: [
    { t: 'hospital', n: 'Local hospital', c: [51.4005, 35.7005] },
    { t: 'pharmacy', n: 'Local pharmacy', c: [51.401, 35.701] },
  ] }), 'utf8');
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fetchImpl: typeof fetch = async (input) => String(input).includes('healthsites.io')
    ? jsonResponse({ error: 'not acceptable' }, 406)
    : jsonResponse({ error: 'rate limited' }, 429);
  const proxy = await startProxy(fetchImpl, { maxRetries: 0, localPoiPath, overpassEndpoints: ['https://overpass.test/api/interpreter'] });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${proxy.base}/healthsites?lat=35.7&lng=51.4`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-provider'), 'local-osm-pbf');
  assert.equal(response.headers.get('x-provider-fallback'), 'local-osm-pbf');
  const payload = await response.json() as { features?: Array<{ properties?: { source?: string; type?: string } }> };
  assert.equal(payload.features?.length, 2);
  assert.equal(payload.features?.[0]?.properties?.source, 'LOCAL_OSM_PBF_FALLBACK');
});

test('returns local POI counts instead of exposing an Overpass 429 to the browser', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-external-poi-'));
  const localPoiPath = path.join(directory, 'pois.json');
  fs.writeFileSync(localPoiPath, JSON.stringify({ points: [
    { t: 'school', c: [51.4002, 35.7002] },
    { t: 'hospital', c: [51.4003, 35.7003] },
    { t: 'bank', c: [51.4004, 35.7004] },
  ] }), 'utf8');
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const proxy = await startProxy(async () => jsonResponse({ error: 'rate limited' }, 429), {
    maxRetries: 0,
    localPoiPath,
    overpassEndpoints: ['https://overpass.test/api/interpreter'],
  });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${proxy.base}/osm/pois?lat=35.7&lng=51.4`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-provider-fallback'), 'local-osm-pbf');
  const payload = await response.json() as { schools?: number; hospitals?: number; banks?: number };
  assert.deepEqual(payload, { schools: 1, hospitals: 1, parks: 0, busStops: 0, supermarkets: 0, pharmacies: 0, mosques: 0, banks: 1, restaurants: 0 });
});

test('reports temporarily unavailable walkability as an optional empty result', async (context) => {
  const proxy = await startProxy(async () => jsonResponse({ error: 'rate limited' }, 429), {
    maxRetries: 0,
    overpassEndpoints: ['https://overpass.test/api/interpreter'],
  });
  context.after(() => new Promise<void>((resolve, reject) => proxy.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${proxy.base}/osm/walkability?lat=35.7&lng=51.4`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-provider-fallback'), 'unavailable');
  assert.deepEqual(await response.json(), { data_available: false, reason: 'osm-overpass returned 429' });
});
