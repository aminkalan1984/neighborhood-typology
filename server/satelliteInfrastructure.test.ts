import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  FileSystemSatelliteObjectStorage,
  FileSystemSatelliteTileCache,
  createSatelliteObjectStorage,
  createSatelliteTileCache,
} from './satelliteInfrastructure';

test('filesystem object storage copies COGs with checksum and deletes by job prefix', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-object-storage-'));
  try {
    const source = path.join(root, 'source.tif');
    fs.writeFileSync(source, 'synthetic-cog');
    const storage = new FileSystemSatelliteObjectStorage(path.join(root, 'objects'));
    const stored = await storage.putFile('job-1/ndvi.tif', source);
    assert.equal(stored.key, 'job-1/ndvi.tif');
    assert.equal(stored.bytes, Buffer.byteLength('synthetic-cog'));
    assert.match(stored.checksum_sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(path.join(root, 'objects', 'job-1', 'ndvi.tif')), true);
    assert.equal((await storage.deletePrefix('job-1')).deleted, 1);
    assert.equal(fs.existsSync(path.join(root, 'objects', 'job-1')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('filesystem tile cache round-trips bytes and enforces age/size cleanup', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-tile-cache-'));
  try {
    const cache = new FileSystemSatelliteTileCache(root);
    await cache.set('tile-a', Buffer.from('abc'));
    await cache.set('tile-b', Buffer.from('defgh'));
    assert.deepEqual(await cache.get('tile-a'), Buffer.from('abc'));
    assert.deepEqual(await cache.metrics(), { files: 2, bytes: 8 });
    const old = Date.now() - 120_000;
    const stack = [root];
    while (stack.length) {
      const directory = stack.pop()!;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) stack.push(target);
        else fs.utimesSync(target, new Date(old), new Date(old));
      }
    }
    const result = await cache.cleanup({ ttlMs: 60_000, maxBytes: 1024 * 1024 });
    assert.equal(result.removed, 2);
    assert.deepEqual(result.remaining, { files: 0, bytes: 0 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('driver factories default to local adapters and expose health metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-infra-factory-'));
  try {
    const storage = createSatelliteObjectStorage({ workDir: path.join(root, 'objects') });
    const cache = createSatelliteTileCache({ root: path.join(root, 'cache') });
    assert.equal(storage.driver, 'filesystem');
    assert.equal(storage.health().status, 'ready');
    assert.equal(cache.driver, 'filesystem');
    assert.equal(cache.health().status, 'ready');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
