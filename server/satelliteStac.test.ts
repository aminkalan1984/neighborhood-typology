import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createSatelliteRouter, SatelliteMetadataStore } from './satelliteStac';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/geo+json' } });
}

function stacItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    id: 'S2_TEST_ITEM',
    collection: 'sentinel-2-l2a',
    bbox: [50, 35, 51, 36],
    geometry: { type: 'Polygon', coordinates: [[[50, 35], [51, 35], [51, 36], [50, 36], [50, 35]]] },
    properties: {
      datetime: '2026-08-26T08:00:00Z',
      published: '2026-08-26T10:00:00Z',
      'eo:cloud_cover': 5.5,
      platform: 'sentinel-2c',
      instruments: ['msi'],
      'processing:level': 'L2A',
      'product:timeliness': 'PT24H',
      gsd: 10,
    },
    assets: {
      visual: {
        href: 'https://example.test/item.tif?X-Amz-Signature=secret&download=1',
        type: 'image/tiff; application=geotiff; profile=cloud-optimized',
        roles: ['visual'],
        gsd: 10,
      },
    },
    ...overrides,
  };
}

async function startRouter(fetchImpl: typeof fetch, metadataPath: string, now = () => Date.parse('2026-08-26T12:00:00Z')) {
  const app = express();
  app.use(express.json());
  app.use('/api/satellite', createSatelliteRouter({ fetch: fetchImpl, now, maxRetries: 0, store: new SatelliteMetadataStore(metadataPath) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  return { server, base: `http://127.0.0.1:${port}/api/satellite` };
}

test('searches CDSE, normalizes metadata, and persists idempotently', async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-satellite-'));
  const metadataPath = path.join(dir, 'items.json');
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fetchImpl: typeof fetch = async (_input, init) => {
    assert.equal(init?.method, 'POST');
    const body = JSON.parse(String(init?.body)) as { collections: string[]; bbox: number[] };
    assert.deepEqual(body.collections, ['sentinel-2-l2a']);
    assert.deepEqual(body.bbox, [44, 25, 63, 40]);
    return jsonResponse({ type: 'FeatureCollection', features: [stacItem()] });
  };
  const api = await startRouter(fetchImpl, metadataPath);
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const first = await fetch(`${api.base}/search?collection=sentinel-2-l2a&provider=cdse&maxAgeHours=24&maxCloudCover=20`);
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { data: { items: Array<{ item_id: string; latency_minutes: number; freshness_status: string; assets: { visual: { href: string } } }>; registered: number } };
  assert.equal(firstBody.data.registered, 1);
  assert.equal(firstBody.data.items[0].item_id, 'S2_TEST_ITEM');
  assert.equal(firstBody.data.items[0].latency_minutes, 120);
  assert.equal(firstBody.data.items[0].freshness_status, 'fresh');
  assert.doesNotMatch(firstBody.data.items[0].assets.visual.href, /Signature|secret/i);

  await fetch(`${api.base}/search?collection=sentinel-2-l2a&provider=cdse`);
  const metadata = await fetch(`${api.base}/metadata`).then((response) => response.json()) as { data: { count: number; items: unknown[] } };
  assert.equal(metadata.data.count, 1);
  assert.equal(metadata.data.items.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(metadataPath, 'utf8')).length, 1);
});

test('falls back to Earth Search when CDSE is unavailable', async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-satellite-'));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes('dataspace.copernicus.eu')) return jsonResponse({ error: 'down' }, 503);
    return jsonResponse({ type: 'FeatureCollection', features: [stacItem({ collection: 'sentinel-2-c1-l2a' })] });
  };
  const api = await startRouter(fetchImpl, path.join(dir, 'items.json'));
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${api.base}/search?collection=sentinel-2-l2a&provider=auto`);
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { providers: string[]; errors: Array<{ provider: string }>; items: Array<{ provider: string; collection: string }> } };
  assert.deepEqual(body.data.providers, ['earth-search']);
  assert.equal(body.data.errors[0].provider, 'cdse');
  assert.equal(body.data.items[0].provider, 'earth-search');
  assert.equal(body.data.items[0].collection, 'sentinel-2-l2a');
  assert.equal(requested.length, 2);
});

test('filters stale and cloudy items before registration', async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-satellite-'));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stale = stacItem({ id: 'STALE', properties: { ...stacItem().properties, datetime: '2026-08-20T08:00:00Z', 'eo:cloud_cover': 1 } });
  const cloudy = stacItem({ id: 'CLOUDY', properties: { ...stacItem().properties, 'eo:cloud_cover': 85 } });
  const fetchImpl: typeof fetch = async () => jsonResponse({ type: 'FeatureCollection', features: [stale, cloudy] });
  const api = await startRouter(fetchImpl, path.join(dir, 'items.json'));
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${api.base}/search?collection=sentinel-2-l2a&provider=cdse&maxAgeHours=24&maxCloudCover=20`);
  const body = await response.json() as { data: { items: unknown[]; registered: number } };
  assert.equal(body.data.registered, 0);
  assert.deepEqual(body.data.items, []);
  const metadata = await fetch(`${api.base}/metadata`).then((item) => item.json()) as { data: { count: number } };
  assert.equal(metadata.data.count, 0);
});

test('registers supplied STAC metadata without downloading raster assets', async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-satellite-'));
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fetchImpl: typeof fetch = async () => { throw new Error('network must not be used'); };
  const api = await startRouter(fetchImpl, path.join(dir, 'items.json'));
  context.after(() => new Promise<void>((resolve, reject) => api.server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`${api.base}/metadata/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'cdse', collection: 'sentinel-2-l2a', item: stacItem({ collection: undefined }) }),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as { data: { item_id: string; assets: Record<string, unknown> } };
  assert.equal(body.data.item_id, 'S2_TEST_ITEM');
  assert.ok(body.data.assets.visual);
});
