import assert from 'node:assert/strict';
import { MemoryTypologyStore } from './typologyStore';
import { TypologyService } from './typologyService';

async function main(): Promise<void> {
  const service = new TypologyService(new MemoryTypologyStore(), { codeVersion: 'test' });
  const run = await service.createRun({
    neighborhood_name: 'محله آزمون',
    city_or_county: 'شهر آزمون',
    province: 'استان آزمون',
    settlement_type: 'urban',
    reference_year: 2025,
    purpose: 'baseline',
  }, 'test');
  assert.equal(run.status, 'LOCATION_AMBIGUOUS');
  assert.equal(run.tasks.length, 419);
  assert.equal(new Set(run.tasks.map((task) => task.code)).size, 419);

  const candidate = run.candidates[0];
  const confirmed = await service.confirmBoundary(run.run_id, {
    candidate_id: candidate.id,
    source: 'municipal',
    source_id: 'test-boundary',
    version: '2025.1',
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[[51, 35], [51.001, 35], [51.001, 35.001], [51, 35.001], [51, 35]]],
    },
  }, 'tester');
  assert.equal(confirmed.status, 'BOUNDARY_CONFIRMED');
  assert.equal(confirmed.boundary?.confidence, 0.98);

  const started = await service.startRun(run.run_id, 'tester');
  assert.equal(started.status, 'WAITING_FOR_RESTRICTED_DATA');
  assert.equal(started.missing.length, 419);

  const sampleCodes = ['PHY-001', 'BEH-001', 'NOR-001'];
  await service.addEvidence(run.run_id, {
    records: sampleCodes.map((indicator_code, index) => ({
      indicator_code,
      raw_value: 10 + index,
      unit: 'unit',
      score_1_5: 2 + index,
      source: {
        organization: 'test',
        url: 'https://example.invalid/dataset',
        dataset_id: 'test-dataset',
        version: '1',
        retrieved_at: '2025-01-01T00:00:00Z',
        license: 'test-license',
        checksum: `sha256:test-${index}`,
      },
      method: { formula_version: `${indicator_code}@1.0`, code_commit: 'test' },
      quality: { score: 0.9, spatial_coverage: 1, temporal_coverage: 1, flags: [] },
    })),
  }, 'tester');
  const recomputed = await service.recompute(run.run_id, 'tester');
  assert.equal(recomputed.status, 'QA_REVIEW');
  assert.equal(recomputed.score?.status, 'provisional');
  assert.equal(recomputed.score?.SI !== null, true);
  assert.equal(recomputed.score?.weighted_coverage.physical! < 0.7, true);

  const approval = await service.approve(run.run_id, {
    reviewer_id: 'reviewer-1',
    decision: 'approve',
    reason: 'Test gate behavior',
  });
  assert.equal(approval.run.status, 'PROVISIONAL');
  assert.equal(approval.gates.eligible, false);
  assert.equal(approval.gates.failures.includes('label_stability_not_computed'), true);

  const report = await service.report(run.run_id);
  assert.equal((report.indicator_plan as unknown[]).length, 419);
  assert.equal((report.evidence_ledger as unknown[]).length, 3);
  assert.equal((report.missing_data as unknown[]).length, 416);
  console.log('typology self-test passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

