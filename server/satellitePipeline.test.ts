import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { SatelliteItemMetadata } from './satelliteStac';
import {
  SatellitePipelineService,
  SatellitePipelineStore,
  SatelliteSpatialIndex,
  defaultSatelliteIndices,
  selectSatelliteAssets,
  type SatelliteWorkerInput,
  type SatelliteWorkerOutput,
} from './satellitePipeline';

function item(): SatelliteItemMetadata {
  return {
    metadata_id: 'earth-search:sentinel-2-l2a:S2_TEST',
    provider: 'earth-search',
    collection: 'sentinel-2-l2a',
    item_id: 'S2_TEST',
    datetime: '2026-08-26T08:00:00Z',
    bbox: [50, 35, 51, 36],
    assets: {
      blue: { href: 'https://example.test/blue.tif', bands: [{ name: 'B02', common_name: 'blue' }], gsd: 10 },
      green: { href: 'https://example.test/green.tif', bands: [{ name: 'B03', common_name: 'green' }], gsd: 10 },
      red: { href: 'https://example.test/red.tif', bands: [{ name: 'B04', common_name: 'red' }], gsd: 10 },
      nir: { href: 'https://example.test/nir.tif', bands: [{ name: 'B08', common_name: 'nir' }], gsd: 10 },
      swir16: { href: 'https://example.test/swir1.tif', bands: [{ name: 'B11', common_name: 'swir16' }], gsd: 20 },
      swir22: { href: 'https://example.test/swir2.tif', bands: [{ name: 'B12', common_name: 'swir22' }], gsd: 20 },
      scl: { href: 'https://example.test/scl.tif', bands: [{ name: 'SCL' }], gsd: 20 },
    },
    source_url: 'https://example.test/stac/S2_TEST',
    acquired_age_hours: 4,
    freshness_status: 'fresh',
    registered_at: '2026-08-26T12:00:00Z',
  };
}

test('selects Sentinel-2 assets and deterministic indices by semantic band name', () => {
  const selected = selectSatelliteAssets(item());
  assert.deepEqual(selected.map((asset) => asset.logical_name), ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'scl']);
  assert.deepEqual(defaultSatelliteIndices('sentinel-2-l2a'), ['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr']);
});

test('runs a processing job, validates provenance, and indexes artifact bounds', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-satellite-pipeline-'));
  const source = item();
  const metadata = { getByMetadataId: (id: string) => id === source.metadata_id ? source : null };
  const store = new SatellitePipelineStore(path.join(directory, 'jobs.json'));
  const spatial = new SatelliteSpatialIndex(path.join(directory, 'spatial.sqlite'));
  context.after(() => {
    spatial.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const worker = async (input: SatelliteWorkerInput): Promise<SatelliteWorkerOutput> => {
    fs.mkdirSync(input.output_dir, { recursive: true });
    fs.writeFileSync(path.join(input.output_dir, 'index-ndvi.tif'), 'fake-cog-test-payload');
    return {
      job_id: input.job_id,
      artifacts: [{
        kind: 'index',
        name: 'ndvi',
        relative_path: 'index-ndvi.tif',
        media_type: 'image/tiff; application=geotiff; profile=cloud-optimized',
        is_cog: true,
        checksum_sha256: '',
        bytes: 0,
        width: 256,
        height: 256,
        dtype: 'float32',
        nodata: -9999,
        crs: 'EPSG:32639',
        bounds: [50, 35, 51, 36],
        overviews: [2, 4],
        valid_pixel_count: 65_536,
        total_pixel_count: 65_536,
        valid_fraction: 1,
        statistics: { min: 0.5, max: 0.5, mean: 0.5 },
      }],
      validation: {
        valid: true,
        checks: ['test'],
        errors: [],
        qa: { total_pixels: 65_536, valid_pixels: 65_536, clear_pixels: 65_536 },
        grids: [{ id: 'ndvi', crs: 'EPSG:32639', width: 256, height: 256, transform: [10, 0, 500000, 0, -10, 4000000] }],
      },
    };
  };
  const service = new SatellitePipelineService(metadata, { store, spatialIndex: spatial, worker, workDir: path.join(directory, 'outputs'), now: () => Date.parse('2026-08-26T12:00:00Z') });
  const queued = service.createJob({ metadata_id: source.metadata_id, aoi: { bbox: [50.1, 35.1, 50.2, 35.2] }, indices: ['ndvi'] });
  assert.equal(queued.status, 'queued');
  const ready = await service.run(queued.job_id);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.artifacts.length, 1);
  assert.equal(ready.validation?.valid, true);
  assert.equal(ready.validation?.checks.find((check) => check.name === 'aoi-coverage')?.status, 'passed');
  assert.equal(ready.validation?.checks.find((check) => check.name === 'qa-mask')?.status, 'passed');
  assert.match(ready.artifacts[0].checksum_sha256, /^[a-f0-9]{64}$/);
  const hits = spatial.query([50.5, 35.5, 50.6, 35.6], 'index');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].properties.name, 'ndvi');
});

test('rejects jobs whose metadata or AOI is invalid', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-satellite-pipeline-'));
  const spatial = new SatelliteSpatialIndex(path.join(directory, 'spatial.sqlite'));
  try {
    const service = new SatellitePipelineService({ getByMetadataId: () => null }, { store: new SatellitePipelineStore(path.join(directory, 'jobs.json')), spatialIndex: spatial, workDir: path.join(directory, 'outputs') });
    assert.throws(() => service.createJob({ metadata_id: 'missing', aoi: { bbox: [51, 36, 50, 35] } }), /aoi\.bbox/);
    assert.throws(() => service.createJob({ metadata_id: 'missing', aoi: { bbox: [50, 35, 51, 36] } }), /not found/);
  } finally {
    spatial.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
