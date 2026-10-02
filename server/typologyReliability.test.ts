import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryTypologyStore } from './typologyStore';
import { TypologyError, TypologyService } from './typologyService';

async function startedRun() {
  const service = new TypologyService(new MemoryTypologyStore(), { codeVersion: 'test' });
  const run = await service.createRun({
    neighborhood_name: 'محله پایداری', city_or_county: 'تهران', province: 'تهران',
    settlement_type: 'urban', reference_year: 1405, purpose: 'baseline',
  });
  await service.confirmBoundary(run.run_id, {
    candidate_id: run.candidates[0].id,
    source: 'municipal', version: 'test-v1',
    boundary_geojson: { type: 'Polygon', coordinates: [[[51, 35], [51.001, 35], [51.001, 35.001], [51, 35.001], [51, 35]]] },
  });
  await service.startRun(run.run_id);
  return { service, run: await service.getRun(run.run_id) };
}

test('replays an idempotent evidence batch without duplicating measurements', async () => {
  const { service, run } = await startedRun();
  const task = run.tasks.find((item) => item.code === 'PHY-001')!;
  const record = {
    indicator_code: task.code,
    raw_value: 42,
    score_1_5: 3,
    source: { url: 'https://example.org/data', dataset_id: 'dataset', version: '1', retrieved_at: '2025-01-01T00:00:00Z', license: 'test', checksum: 'sha256:test' },
    method: { formula_version: task.formula_version },
    quality: { score: 0.9, spatial_coverage: 1, temporal_coverage: 1, flags: [] },
  };
  const body = { records: [record], idempotency_key: 'batch-1' };
  const first = await service.addEvidence(run.run_id, body);
  const second = await service.addEvidence(run.run_id, body);
  assert.equal(first.accepted.length, 1);
  assert.equal(second.accepted[0].id, first.accepted[0].id);
  assert.equal((await service.getRun(run.run_id)).measurements.length, 1);

  await assert.rejects(
    service.addEvidence(run.run_id, { records: [{ ...record, raw_value: 43 }], idempotency_key: 'batch-1' }),
    (error: unknown) => error instanceof TypologyError && error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('rejects malformed run identifiers before touching the store', async () => {
  const service = new TypologyService(new MemoryTypologyStore(), { codeVersion: 'test' });
  await assert.rejects(service.getRun('bad-id'), (error: unknown) => error instanceof TypologyError && error.code === 'INVALID_RUN_ID');
});

test('rejects unreadable place names before creating a persisted run', async () => {
  const service = new TypologyService(new MemoryTypologyStore(), { codeVersion: 'test' });
  await assert.rejects(
    service.createRun({
      neighborhood_name: '????', city_or_county: 'تهران', province: 'تهران',
      settlement_type: 'urban', reference_year: 1405, purpose: 'baseline',
    }),
    (error: unknown) => error instanceof TypologyError && error.code === 'INVALID_PLACE_NAME',
  );
});

test('reports a localized, assigned missing-data queue', async () => {
  const { service, run } = await startedRun();
  const report = await service.report(run.run_id) as {
    created_at: string;
    updated_at: string;
    missing_data: Array<{ indicator?: string; access_mode?: string; next_action: string; owner?: string }>;
  };
  const item = report.missing_data[0];

  assert.ok(report.created_at);
  assert.ok(report.updated_at);
  assert.ok(item.indicator);
  assert.ok(item.access_mode);
  assert.match(item.next_action, /بارگذاری|تکمیل|اجرا|تعیین/);
  assert.ok(item.owner);
});
