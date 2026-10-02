import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OFFICIAL_BINDINGS,
  evaluateOfficialTypology,
  type OfficialIndicatorBinding,
} from './typologyOfficialRules.js';

test('keeps the four official categories multi-label and preserves the shared criteria', () => {
  const bindings: OfficialIndicatorBinding[] = [
    { code: 'HZ', criterion: 'hazard', polarity: 'already_severity', weight: 1 },
    { code: 'PH', criterion: 'physical_quality', polarity: 'already_severity', weight: 1 },
    { code: 'QL', criterion: 'quality_of_life', polarity: 'already_severity', weight: 1 },
    { code: 'TEN', criterion: 'informality', polarity: 'already_severity', weight: 1, signalOnly: true },
    { code: 'INC', criterion: 'informality', polarity: 'already_severity', weight: 1, signalOnly: true },
  ];
  const result = evaluateOfficialTypology([
    { code: 'HZ', severity: 0.9, quality: 1, coverage: 1, status: 'validated' },
    { code: 'PH', severity: 0.9, quality: 1, coverage: 1, status: 'validated' },
    { code: 'QL', severity: 0.8, quality: 1, coverage: 1, status: 'validated' },
    { code: 'TEN', severity: 0.8, quality: 1, coverage: 1, status: 'validated' },
    { code: 'INC', severity: 0.8, quality: 1, coverage: 1, status: 'validated' },
  ], { informalDesignation: true, designationSources: { informal: ['municipal-regeneration-layer-v1'] } }, { bindings });
  // The settlement designation is authoritative, while the overlapping
  // hazard/physical labels still require their own approved layers.
  assert.equal(result.status, 'provisional');
  assert.equal(result.sharedCriteria.hazard.active, true);
  assert.equal(result.sharedCriteria.physicalQuality.active, true);
  assert.equal(result.sharedCriteria.qualityOfLife.active, true);
  assert.equal(result.labels.filter((label) => label.eligible).length, 3);
  assert.ok(result.labels.some((label) => label.code === 'HAZARD_INEFFICIENT'));
  assert.ok(result.labels.some((label) => label.code === 'PHYSICAL_INEFFICIENT'));
  assert.ok(result.labels.some((label) => label.code === 'INFORMAL_SETTLEMENT'));
  assert.equal(result.labels.find((label) => label.code === 'INFORMAL_SETTLEMENT')!.basis, 'authoritative_designation');
  assert.equal(result.labels.find((label) => label.code === 'HISTORIC_FABRIC')!.eligible, false);
});

test('does not claim historic fabric from a score-only proxy by default', () => {
  const result = evaluateOfficialTypology([
    { code: 'HIST', severity: 1, quality: 1, coverage: 1, status: 'validated', authoritative: false },
  ], {}, {
    bindings: [{ code: 'HIST', criterion: 'historic_significance', polarity: 'already_severity' }],
  });
  assert.equal(result.labels.find((label) => label.code === 'HISTORIC_FABRIC')!.eligible, false);
  assert.equal(result.status, 'provisional');
  assert.ok(result.warnings.includes('official_designation_or_expert_confirmation_required'));
});

test('accepts authoritative heritage and hazard designations even when indicators are sparse', () => {
  const result = evaluateOfficialTypology([], {
    historicDesignation: true,
    hazardDesignation: true,
    designationSources: { historic: ['ICHHTO-layer-2025'], hazard: ['national-hazard-layer-1402'] },
  });
  assert.equal(result.labels.find((label) => label.code === 'HISTORIC_FABRIC')!.eligible, true);
  assert.equal(result.labels.find((label) => label.code === 'HAZARD_INEFFICIENT')!.eligible, true);
  assert.equal(result.status, 'authoritative');
});

test('ships transparent default bindings for the current 419-indicator registry', () => {
  assert.ok(DEFAULT_OFFICIAL_BINDINGS.some((binding) => binding.code === 'PHY-061' && binding.criterion === 'hazard'));
  assert.ok(DEFAULT_OFFICIAL_BINDINGS.some((binding) => binding.code === 'PHY-038' && binding.criterion === 'physical_quality'));
  assert.ok(DEFAULT_OFFICIAL_BINDINGS.some((binding) => binding.code === 'BEH-071' && binding.criterion === 'informality'));
});
