import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BoundedSatelliteJobQueue, SatelliteAuditStore } from './satelliteRuntime';

test('bounded queue respects concurrency and releases job keys after completion', async () => {
  const queue = new BoundedSatelliteJobQueue(2);
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 8 }, (_, index) => queue.enqueue(`job-${index}`, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 8));
    active -= 1;
  }));
  await Promise.all(jobs);
  assert.equal(peak, 2);
  assert.equal(queue.stats().active, 0);
  assert.equal(queue.stats().pending, 0);
  assert.equal(queue.stats().completed, 8);
  assert.equal(queue.has('job-0'), false);
});

test('bounded queue records failures while continuing later work', async () => {
  const queue = new BoundedSatelliteJobQueue(1);
  await assert.rejects(queue.enqueue('bad', async () => { throw new Error('expected'); }));
  await queue.enqueue('good', async () => undefined);
  assert.equal(queue.stats().failed, 1);
  assert.equal(queue.stats().completed, 1);
});

test('audit store persists, filters, and caps operational events', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ara-audit-'));
  try {
    const filePath = path.join(directory, 'audit.json');
    const audit = new SatelliteAuditStore(filePath, 2);
    audit.record({ action: 'one', actor: 'test', job_id: 'a' });
    audit.record({ action: 'two', actor: 'test', job_id: 'b' });
    audit.record({ action: 'three', actor: 'test', job_id: 'b' });
    assert.equal(audit.list().length, 2);
    assert.equal(audit.list({ jobId: 'b' }).length, 2);
    assert.equal(audit.list({ action: 'one' }).length, 0);
    const restored = new SatelliteAuditStore(filePath, 2);
    assert.equal(restored.list().length, 2);
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).version, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
