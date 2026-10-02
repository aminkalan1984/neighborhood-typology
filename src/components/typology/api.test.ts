import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReport } from './api';

test('normalizes server coverage without double-counting computed indicators', () => {
  const report = normalizeReport({
    run_id: 'run-1',
    status: 'QA_REVIEW',
    publication_level: 'PROVISIONAL',
    identity: { official_name: 'محله نمونه', province: 'تهران', city_or_county: 'تهران' },
    registry: { version: 'registry-1' },
    coverage: {
      total: 419,
      computed: 3,
      approved: 0,
      missing: 416,
      status_counts: { COMPUTED: 3, NOT_AVAILABLE: 416 },
    },
    indicator_plan: [
      { code: 'PHY-001', indicator: 'شاخص یک', domain: 'physical', status: 'COMPUTED', score_1_5: 3 },
    ],
    evidence_ledger: [],
    results: { domain_scores: {}, domain_labels_fa: {}, weighted_coverage: {} },
  }, 'fallback');

  assert.equal(report.coverage.computed, 3);
  assert.equal(report.coverage.total, 419);
  assert.equal(report.location.official_name, 'محله نمونه');
});

test('falls back to status counts when a legacy response omits computed coverage', () => {
  const report = normalizeReport({
    run_id: 'run-2',
    coverage: { total: 419, status_counts: { COMPUTED: 2, APPROVED: 1, NOT_AVAILABLE: 416 } },
    identity: { official_name: 'محله دوم', province: 'البرز', city_or_county: 'کرج' },
  }, 'fallback');

  assert.equal(report.coverage.computed, 3);
});

test('normalizes governance metadata and ignores mojibake-only names from persisted runs', () => {
  const report = normalizeReport({
    run_id: 'run-3',
    status: 'QA_REVIEW',
    publication_level: 'PROVISIONAL',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    identity: { official_name: '????', province: 'تهران', city_or_county: 'تهران' },
    coverage: { total: 419, computed: 1, missing: 418, status_counts: { COMPUTED: 1 } },
    verification_gates: { eligible: false, failures: ['physical_coverage_below_0_70'] },
    indicator_plan: [],
    evidence_ledger: [],
    results: {},
    audit: {
      code_version: 'test',
      events: [{ id: 'event-1', at: '2026-01-01T00:00:00.000Z', actor: 'reviewer', action: 'RUN_CREATED' }],
      reviewer: { id: 'reviewer-1', decision: 'approve', at: '2026-01-02T00:00:00.000Z' },
    },
  }, 'fallback');

  assert.equal(report.location.official_name, 'محله انتخاب‌شده');
  assert.equal(report.created_at, '2026-01-01T00:00:00.000Z');
  assert.equal(report.verification_gates.failures[0], 'physical_coverage_below_0_70');
  assert.equal(report.audit_events.length, 1);
  assert.equal(report.reviewer?.id, 'reviewer-1');
});

test('enriches a legacy missing-data queue from the indicator plan', () => {
  const report = normalizeReport({
    run_id: 'run-4',
    identity: { official_name: 'محله نمونه', province: 'تهران', city_or_county: 'تهران' },
    coverage: { total: 419, computed: 0, missing: 419 },
    indicator_plan: [{
      code: 'PHY-006',
      indicator: 'رضایت از امکانات اوقات فراغت کودکان',
      domain: 'physical',
      status: 'WAITING_FOR_SURVEY',
      access_mode: 'تولید میدانی',
    }],
    missing_data: [{
      indicator_code: 'PHY-006',
      status: 'WAITING_FOR_SURVEY',
      reason: 'survey_data_not_received',
      next_action: 'Collect an approved anonymized survey package.',
    }],
  }, 'fallback');

  assert.equal(report.missing_data[0].indicator, 'رضایت از امکانات اوقات فراغت کودکان');
  assert.equal(report.missing_data[0].access_mode, 'تولید میدانی');
  assert.equal(report.missing_data[0].owner, 'تیم پیمایش و ممیزی میدانی');
  assert.match(report.missing_data[0].reason, /پیمایش معتبر/);
  assert.match(report.missing_data[0].next_action, /گردآوری و بارگذاری/);
});
