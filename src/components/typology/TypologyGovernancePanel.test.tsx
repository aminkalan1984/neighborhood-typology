import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import TypologyGovernancePanel, {
  formatVerificationGate,
  publicationReadiness,
  summarizeAuditEvent,
} from './TypologyGovernancePanel';

test('distinguishes gate eligibility from final reviewer verification', () => {
  assert.deepEqual(
    publicationReadiness('PROVISIONAL', { eligible: true, failures: [] }),
    { ready: true, label: 'آماده تصمیم بازبین' },
  );
  assert.deepEqual(
    publicationReadiness('VERIFIED', { eligible: true, failures: [] }),
    { ready: true, label: 'انتشار تأییدشده' },
  );
  assert.equal(publicationReadiness('PROVISIONAL', {
    eligible: false,
    failures: ['physical_coverage_below_0_70'],
  }).ready, false);
});

test('formats verification gates and audit summaries for reviewers', () => {
  assert.match(formatVerificationGate('physical_coverage_below_0_70'), /ساحت کالبدی/);
  assert.equal(formatVerificationGate('reviewer_rejected'), 'بازبین پرونده را رد کرده است.');
  assert.match(summarizeAuditEvent({
    id: 'event-1',
    at: '2026-01-01T00:00:00.000Z',
    actor: 'system',
    action: 'DETERMINISTIC_RECOMPUTE_FINISHED',
    details: { computed_indicators: 12, missing_indicators: 407 },
  }) ?? '', /۱۲ محاسبه‌شده/);
});

test('renders reviewer decision, gate failures, and audit events', () => {
  const markup = renderToStaticMarkup(
    <TypologyGovernancePanel
      publicationLevel="PROVISIONAL"
      gates={{ eligible: false, failures: ['score_not_computed'] }}
      events={[{
        id: 'event-1',
        at: '2026-01-01T00:00:00.000Z',
        actor: 'reviewer-1',
        action: 'RUN_REJECTED',
      }]}
      reviewer={{ id: 'reviewer-1', name: 'بازبین نمونه', decision: 'reject', reason: 'پوشش ناکافی' }}
    />,
  );

  assert.match(markup, /۱ مانع فعال/);
  assert.match(markup, /امتیاز سه‌ساحتی هنوز محاسبه نشده است/);
  assert.match(markup, /بازبین نمونه/);
  assert.match(markup, /پرونده توسط بازبین رد شد/);
});
