import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry } from './typologyRegistry';
import {
  EXPECTED_INDICATOR_COUNT,
  auditIndicatorSemantics,
  buildIndicatorSemanticContracts,
  getIndicatorSemantic,
} from './typologyIndicatorSemantics';

test('audits every approved registry row and preserves domain cardinalities', () => {
  const registry = loadRegistry();
  const audit = auditIndicatorSemantics(registry.rows, registry.version);
  assert.equal(audit.expected_count, EXPECTED_INDICATOR_COUNT);
  assert.equal(audit.actual_count, EXPECTED_INDICATOR_COUNT);
  assert.equal(audit.audited_count, EXPECTED_INDICATOR_COUNT);
  assert.equal(audit.coverage, 1);
  assert.equal(audit.registry_version, registry.version);
  assert.equal(audit.ok, true, audit.issues.filter((item) => item.severity === 'error').map((item) => `${item.code}:${item.message}`).join('; '));
  assert.equal(audit.by_polarity.benefit + audit.by_polarity.cost + audit.by_polarity.target + audit.by_polarity.contextual, EXPECTED_INDICATOR_COUNT);
  assert.equal(audit.contracts.length, EXPECTED_INDICATOR_COUNT);
  assert.ok(audit.valid_count >= EXPECTED_INDICATOR_COUNT - 2);
});

test('keeps distance, coverage and scoring polarity separate for access rows', () => {
  const contracts = buildIndicatorSemanticContracts();
  for (const code of ['PHY-001', 'PHY-002', 'PHY-003', 'PHY-004', 'NOR-022']) {
    const semantic = contracts.find((item) => item.code === code)!;
    assert.equal(semantic.measurement_type, 'network_access');
    assert.equal(semantic.polarity, 'benefit');
    assert.equal(semantic.numerator, 'population_within_service_threshold');
    assert.equal(semantic.denominator, 'resident_population');
    assert.equal(semantic.ratio.scale, 100);
    assert.equal(semantic.spatial_level, 'network_block_to_service');
    assert.match(semantic.raw_unit, /derived_coverage_percent/);
    assert.ok(semantic.known_errors.includes('network_distance_is_not_a_benefit_without_coverage_transform'));
  }
});

test('applies explicit contracts to known high-risk or copied-formula rows', () => {
  const expected: Record<string, { type: string; polarity: string; unit: string }> = {
    'PHY-106': { type: 'coverage_rate', polarity: 'benefit', unit: 'percent_of_occupied_households' },
    'PHY-112': { type: 'travel_rate', polarity: 'contextual', unit: 'trips_per_person_per_day' },
    'PHY-148': { type: 'network_accessibility_composite', polarity: 'benefit', unit: 'network_minutes_and_coverage_percent' },
    'PHY-154': { type: 'field_compliance', polarity: 'benefit', unit: 'percent_of_wayfinding_points_compliant' },
    'PHY-159': { type: 'service_capacity_rate', polarity: 'contextual', unit: 'hospitals_or_beds_per_10000_residents' },
    'NOR-008': { type: 'transport_service_index', polarity: 'benefit', unit: 'score_0_100_plus_network_minutes' },
    'NOR-025': { type: 'transport_service_index', polarity: 'benefit', unit: 'score_0_100_plus_network_minutes' },
  };
  for (const [code, expectedSemantic] of Object.entries(expected)) {
    const semantic = getIndicatorSemantic(code)!;
    assert.equal(semantic.measurement_type, expectedSemantic.type, code);
    assert.equal(semantic.polarity, expectedSemantic.polarity, code);
    assert.equal(semantic.raw_unit, expectedSemantic.unit, code);
    assert.equal(semantic.inference.confidence, 'high', code);
    assert.ok(semantic.known_errors.length >= 2, code);
  }
});

test('maps registry direction to polarity and keeps conservative fallbacks visible', () => {
  assert.equal(getIndicatorSemantic('PHY-014')!.polarity, 'cost');
  assert.equal(getIndicatorSemantic('PHY-017')!.polarity, 'target');
  assert.equal(getIndicatorSemantic('PHY-006')!.polarity, 'benefit');

  const audit = auditIndicatorSemantics();
  assert.equal(audit.contracts.some((item) => item.measurement_type === 'unknown'), false);
  const reviewWarnings = audit.issues.filter((item) => item.rule === 'semantic_review_required');
  assert.ok(reviewWarnings.length > 0);
  for (const warning of reviewWarnings) {
    const contract = audit.contracts.find((item) => item.code === warning.code)!;
    assert.equal(contract.inference.confidence, 'low');
    assert.equal(contract.polarity, 'contextual');
    assert.ok(contract.known_errors.includes('semantic_review_required'));
  }
});

test('reports malformed registry cardinality as an error without throwing during inference', () => {
  const rows = loadRegistry().rows.slice(0, 3);
  const audit = auditIndicatorSemantics(rows);
  assert.equal(audit.ok, false);
  assert.ok(audit.error_count >= 1);
  assert.ok(audit.issues.some((item) => item.rule === 'approved_registry_size'));
});
