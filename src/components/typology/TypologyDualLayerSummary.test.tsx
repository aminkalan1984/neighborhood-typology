import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import TypologyDualLayerSummary, { asPercent } from './TypologyDualLayerSummary';
import type { DualLayerTypologySummary } from './types';

const summary: DualLayerTypologySummary = {
  official_labels: [
    {
      code: 'HISTORIC',
      label: 'Historic fabric',
      label_fa: 'بافت تاریخی',
      membership: 0.92,
      eligible: true,
      reason: 'قرارگیری در محدوده مصوب بافت تاریخی',
      intervention: 'حفاظت، مرمت و احیا',
    },
    {
      code: 'DETERIORATED',
      label: 'Deteriorated',
      label_fa: 'بافت ناکارآمد کالبدی',
      membership: 0.78,
      eligible: true,
      reason: 'کیفیت کالبدی پایین و کم‌دوامی ابنیه',
      intervention: 'نوسازی و مقاوم‌سازی',
    },
  ],
  analytical_profile: {
    physical: 3.4,
    behavioral: 2.7,
    normative: 3.8,
    SI: 3.24,
    dominant_domain: 'normative',
  },
  fuzzy_memberships: [
    { code: 'COMPACT_ACTIVE', label_fa: 'متراکم و فعال', label: 'Compact active', membership: 0.67, description: 'عضویت فازی ترکیبی' },
  ],
  coverage: { physical: 0.86, behavioral: 0.61, normative: 0.74 },
  quality: 0.81,
  uncertainty: { low: 2.9, high: 3.6, method: 'bootstrap' },
  provisional: true,
  warnings: ['پوشش ساحت رفتاری کمتر از آستانه انتشار است.'],
};

test('normalizes ratio, percentage and score values without turning missing into zero', () => {
  assert.equal(asPercent(0.75), 75);
  assert.equal(asPercent(75), 75);
  assert.equal(asPercent(3.5, true), 70);
  assert.equal(asPercent(null), null);
});

test('renders the formal multi-label layer and analytical P/B/N layer separately', () => {
  const markup = renderToStaticMarkup(<TypologyDualLayerSummary summary={summary} />);
  assert.match(markup, /خلاصه دو/);
  assert.match(markup, /بافت تاریخی/);
  assert.match(markup, /بافت ناکارآمد کالبدی/);
  assert.match(markup, /پروفایل تحلیلی/);
  assert.match(markup, /COMPACT_ACTIVE/);
  assert.match(markup, /نتیجه موقت است/);
  assert.match(markup, /پوشش ساحت رفتاری/);
  assert.equal((markup.match(/data-testid="official-typology"/g) ?? []).length, 2);
  assert.equal((markup.match(/data-testid="fuzzy-membership"/g) ?? []).length, 1);
});

test('accepts the summary through the backward-compatible report alias', () => {
  const markup = renderToStaticMarkup(<TypologyDualLayerSummary report={{ dualLayerTypology: summary }} />);
  assert.match(markup, /بافت تاریخی/);
});

test('renders a clear empty state when no dual-layer payload is available', () => {
  const markup = renderToStaticMarkup(<TypologyDualLayerSummary summary={null} />);
  assert.match(markup, /خلاصه دو/);
  assert.match(markup, /هنوز در پاسخ داده وجود ندارد/);
});
