import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticalFuzzyMembership,
  normalizeAnalyticalValue,
  scoreAnalyticalProfile,
  type AnalyticalIndicatorSpec,
} from './typologyAnalytical.js';

test('normalizes benefit and cost values with robust clipping', () => {
  const benefit = normalizeAnalyticalValue(120, { code: 'x', domain: 'physical', direction: 'benefit', lower: 0, upper: 100 });
  const cost = normalizeAnalyticalValue(120, { code: 'x', domain: 'physical', direction: 'cost', lower: 0, upper: 100 });
  assert.equal(benefit?.normalized, 1);
  assert.equal(cost?.normalized, 0);
  assert.equal(benefit?.score1to5, 5);
  assert.equal(cost?.score1to5, 1);
});

test('uses reference quantiles when fixed bounds are absent and handles target variables', () => {
  const robust = normalizeAnalyticalValue(20000, {
    code: 'income', domain: 'behavioral', direction: 'benefit',
    reference: { values: [10, 11, 12, 13, 14, 15, 10000] },
  });
  assert.ok(robust);
  assert.ok(robust.flags.includes('ROBUST_REFERENCE_BOUNDS'));
  assert.equal(robust.normalized, 1);

  const target = normalizeAnalyticalValue(50, {
    code: 'density', domain: 'physical', direction: 'target', lower: 0, upper: 100, target: 50, tolerance: 5,
  });
  assert.equal(target?.normalized, 1);
  const far = normalizeAnalyticalValue(0, {
    code: 'density', domain: 'physical', direction: 'target', lower: 0, upper: 100, target: 50, tolerance: 5,
  });
  assert.equal(far?.normalized, 0);
});

test('propagates quality and coverage into effective weights without converting missing data to zero', () => {
  const specs: AnalyticalIndicatorSpec[] = [
    { code: 'P1', domain: 'physical', direction: 'benefit', lower: 0, upper: 100, weight: 1 },
    { code: 'P2', domain: 'physical', direction: 'benefit', lower: 0, upper: 100, weight: 1 },
    { code: 'B1', domain: 'behavioral', direction: 'benefit', lower: 0, upper: 100 },
    { code: 'N1', domain: 'normative', direction: 'benefit', lower: 0, upper: 100 },
  ];
  const result = scoreAnalyticalProfile(specs, [
    { code: 'P1', value: 100, quality: { score: 1, spatialCoverage: 1, temporalCoverage: 1 } },
    { code: 'P2', value: 0, quality: { score: 0.2, spatialCoverage: 0.5, temporalCoverage: 1 } },
    { code: 'B1', value: null, status: 'missing' },
    { code: 'N1', value: 100 },
  ], { minimumDomainCoverage: 0.5 });
  assert.ok(Math.abs(result.domains.physical.normalizedScore! - (1 / 1.1)) < 1e-12);
  assert.ok(result.indicators.find((row) => row.code === 'P2')!.effectiveWeight < 0.2);
  assert.equal(result.domains.behavioral.normalizedScore, null);
  assert.equal(result.SI, null);
  assert.equal(result.status, 'partial');
});

test('computes SI and non-exclusive fuzzy labels for a complete profile', () => {
  const specs: AnalyticalIndicatorSpec[] = [
    { code: 'P', domain: 'physical', driverId: 'P1', direction: 'benefit', lower: 0, upper: 100 },
    { code: 'B', domain: 'behavioral', driverId: 'B1', direction: 'benefit', lower: 0, upper: 100 },
    { code: 'N', domain: 'normative', driverId: 'N1', direction: 'benefit', lower: 0, upper: 100 },
  ];
  const result = scoreAnalyticalProfile(specs, [
    { code: 'P', value: 20 }, { code: 'B', value: 80 }, { code: 'N', value: 80 },
  ]);
  assert.ok(Math.abs(result.SI! - Math.cbrt(0.2 * 0.8 * 0.8)) < 1e-12);
  assert.ok(Math.abs(result.SI1to5! - (1 + Math.cbrt(0.2 * 0.8 * 0.8) * 4)) < 1e-12);
  assert.ok(result.multiLabels.some((label) => label.code === 'PHYSICAL_LEAP_CAPACITY'));
  assert.equal(result.status, 'complete');
  const fuzzy = analyticalFuzzyMembership(0.5);
  assert.equal(fuzzy.medium, 1);
  assert.equal(fuzzy.dominant, 'medium');
});
