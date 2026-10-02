import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  aggregateTypology,
  buildDataSupplyPlan,
  createVersionedRun,
  geometricMean,
  likertMeanTo100,
  loadDefaultRegistry,
  loadTypologyConfig,
  normalizePersianText,
  safeRate,
  scenarioForScores,
  standardizeToScore,
  transitionRun,
  type EvidenceRecord,
  type IndicatorMeasurement,
} from './index.js';

const cwd = process.cwd();
const registry = loadDefaultRegistry(cwd);

test('loads and validates the controlled 419-indicator registry', () => {
  assert.deepEqual(registry.counts, { total: 419, physical: 177, behavioral: 209, normative: 33 });
  assert.deepEqual(registry.directionCounts, { direct: 341, inverse: 58, optimal: 20 });
  for (const total of Object.values(registry.weightTotals)) assert.ok(Math.abs(total - 100) < 1e-9);
  assert.equal(registry.byCode.size, 419);
  assert.match(registry.version, /^sha256:[0-9a-f]{64}$/);
});

test('loads governance thresholds from the package config', () => {
  const config = loadTypologyConfig(path.join(cwd, 'neighborhood_typology', 'config.yml'));
  assert.equal(config.scoring.minimumDomainWeightCoverage, 0.7);
  assert.equal(config.scoring.minimumDriverWeightCoverage, 0.5);
  assert.equal(config.quality.boundaryConfidenceMinimum, 0.9);
  assert.deepEqual(config.referenceCohort.matchFields, ['settlement_type', 'province', 'population_band', 'climate_zone']);
});

test('builds exactly 419 unique supply tasks and preserves access counts', () => {
  const plan = buildDataSupplyPlan(registry, {
    neighborhood_name: 'محله نمونه', city_or_county: 'تهران', province: 'تهران',
    settlement_type: 'urban', reference_year: 2025, optional_boundary_geojson: null,
  }, { runId: 'run-test', createdAt: '2025-01-01T00:00:00.000Z' });
  assert.equal(plan.tasks.length, 419);
  assert.equal(new Set(plan.tasks.map((task) => task.code)).size, 419);
  assert.equal(plan.acceptance.exactIndicatorCount, true);
  assert.equal(plan.acceptance.uniqueCodes, true);
  assert.equal(plan.counts['برخط/باز'], 7);
  assert.equal(plan.counts['ترکیبی: برخط + درخواست سازمانی'], 153);
  assert.equal(plan.counts['ترکیبی: تولید میدانی + درخواست سازمانی'], 124);
  assert.equal(plan.counts['درخواست سازمانی/داده غیرعمومی'], 91);
  assert.equal(plan.counts['تولید میدانی'], 44);
  assert.equal(plan.statusCounts.PLANNED, 419);
});

test('deterministic calculation helpers reject invalid denominators and reproduce document SI examples', () => {
  assert.equal(safeRate(20, 40), 50);
  assert.equal(safeRate(1, 0), null);
  assert.equal(likertMeanTo100(3), 50);
  assert.equal(geometricMean([1, 3.5, 4.8])!.toFixed(2), '2.56');
  assert.equal(geometricMean([2.5, 1.5, 1.2])!.toFixed(2), '1.65');
  assert.equal(geometricMean([4, 2.5, 4.5])!.toFixed(2), '3.56');
});

test('standardizes direct, inverse and optimal rules without free-text formula execution', () => {
  assert.equal(standardizeToScore(50, { direction: 'direct', lower: 0, upper: 100 }).score1to5, 3);
  assert.equal(standardizeToScore(50, { direction: 'inverse', lower: 0, upper: 100 }).score1to5, 3);
  assert.equal(standardizeToScore(15, { direction: 'optimal', lower: 0, upper: 100, worstLower: 0, optimalLower: 10, optimalUpper: 20, worstUpper: 30 }).score1to5, 5);
});

test('aggregates full evidence to P/B/N, SI, coverage, typology and a 419-row audit trail', () => {
  const domainScore = { physical: 1, behavioral: 3.5, normative: 4.8 } as const;
  const measurements: IndicatorMeasurement[] = registry.rows.map((row) => ({
    code: row.code,
    score1to5: domainScore[row.domain],
    status: 'APPROVED',
    qualityScore: 0.95,
    formulaVersion: row.formulaVersion,
    evidenceIds: [`evidence-${row.code}`],
  }));
  const evidence: EvidenceRecord[] = registry.rows.map((row) => ({
    id: `evidence-${row.code}`,
    indicatorCode: row.code,
    datasetId: `dataset-${row.code}`,
    version: '1',
    checksum: `sha256:${row.code}`,
    retrievedAt: '2025-01-01T00:00:00.000Z',
    license: 'test-only',
    qualityScore: 0.95,
  }));
  const result = aggregateTypology(registry, measurements, evidence, {
    runId: 'run-score', boundaryConfidence: 0.95, labelStability: 0.99, expertApproved: true, codeVersion: 'test-sha',
  });
  assert.equal(result.domainScores.physical, 1);
  assert.ok(Math.abs(result.domainScores.behavioral! - 3.5) < 1e-12);
  assert.ok(Math.abs(result.domainScores.normative! - 4.8) < 1e-12);
  assert.equal(result.SI!.toFixed(2), '2.56');
  assert.equal(result.domainLabels.physical, 'نهفته');
  assert.equal(result.domainLabels.behavioral, 'مستعد تعامل');
  assert.equal(result.domainLabels.normative, 'پیشرو');
  assert.equal(result.publicationLevel, 'VERIFIED');
  assert.equal(result.audit.indicators.length, 419);
  assert.equal(result.missingIndicators.length, 0);
  for (const coverage of Object.values(result.weightedCoverage)) assert.ok(Math.abs(coverage - 1) < 1e-12);
});

test('never converts missing measurements to zero and exposes the next action', () => {
  const result = aggregateTypology(registry, [{ code: 'PHY-001', status: 'MISSING' }], [], { boundaryConfidence: 0.95 });
  assert.equal(result.domainScores.physical, null);
  assert.equal(result.domainScores.behavioral, null);
  assert.equal(result.domainScores.normative, null);
  assert.equal(result.SI, null);
  assert.equal(result.audit.indicators.length, 419);
  assert.equal(result.missingIndicators.length, 419);
  assert.ok(result.missingIndicators.every((item) => item.nextAction.length > 0));
});

test('applies documented imbalance scenarios including the HLH driver split', () => {
  assert.equal(scenarioForScores(4.2, 4.1, 1.8).code, 'INSTITUTIONAL_GAP');
  assert.equal(scenarioForScores(4.2, 1.5, 4.3, { B1: 1, B2: 1.2, B3: 3, B4: 3.2 }).code, 'LIVELIHOOD_LOCK_IN');
  assert.equal(scenarioForScores(4.2, 1.5, 4.3, { B1: 3, B2: 3.2, B3: 1, B4: 1.2 }).code, 'SOCIAL_ABSORPTION_GAP');
  assert.equal(scenarioForScores(3, 4.2, 1.8).code, 'TRANSITIONAL_IMBALANCE');
});

test('normalizes Persian place names and enforces resumable run transitions', () => {
  assert.equal(normalizePersianText('محله  كوي  گيلان ۱۲'), 'گیلان 12');
  const run = createVersionedRun({
    neighborhood_name: 'نمونه', city_or_county: 'تهران', province: 'تهران', settlement_type: 'urban', reference_year: 2025,
  }, registry.version, { runId: 'run-workflow', createdAt: '2025-01-01T00:00:00.000Z' });
  assert.equal(run.status, 'WAITING_FOR_LOCATION_RESOLUTION');
  assert.equal(transitionRun(run, 'BOUNDARY_CONFIRMED').status, 'BOUNDARY_CONFIRMED');
  assert.throws(() => transitionRun(run, 'VERIFIED'), /Invalid run transition/);
});
