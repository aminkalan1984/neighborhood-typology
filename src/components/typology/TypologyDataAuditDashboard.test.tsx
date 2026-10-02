import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import TypologyDataAuditDashboard from './TypologyDataAuditDashboard';
import type { TypologyDataCatalogSummary, TypologyReport } from './types';

const report: TypologyReport = {
  run_id: 'run-audit',
  status: 'PROVISIONAL',
  publication_level: 'PROVISIONAL',
  registry_version: 'test',
  code_version: 'test',
  created_at: '',
  updated_at: '',
  location: { official_name: 'محله آزمون', alternative_names: [], province: 'تهران', city_or_county: 'تهران' },
  boundary: null,
  reference_year: 1405,
  coverage: { total: 419, computed: 1, approved: 0, missing: 418, failed_qa: 0, waiting_public: 0, waiting_organizational: 0, waiting_survey: 0, waiting_field: 0 },
  domains: {
    physical: { key: 'physical', score: null, label: 'کالبدی', coverage: 0, confidence: null },
    behavioral: { key: 'behavioral', score: null, label: 'رفتاری', coverage: 0, confidence: null },
    normative: { key: 'normative', score: null, label: 'هنجاری', coverage: 0, confidence: null },
  },
  si: null,
  label_stability: null,
  scenario: { requires_review: true, label: 'در انتظار داده' },
  drivers: [],
  indicators: [
    { code: 'P1.001', indicator: 'شاخص آزمون', domain: 'physical', status: 'COMPUTED', coverage: 1, confidence: 0.8, evidence_ids: ['ev-1'] },
    { code: 'B1.001', indicator: 'شاخص مفقود', domain: 'behavioral', status: 'WAITING_FOR_SURVEY', coverage: null, confidence: null, evidence_ids: [] },
  ],
  evidence: [],
  missing_data: [],
  verification_gates: { eligible: false, failures: [] },
  audit_events: [],
  positive_factors: [],
  bottlenecks: [],
  reviewer: null,
};

const catalog: TypologyDataCatalogSummary = {
  schema_version: 'test',
  generated_at: '',
  file_count: 21752,
  total_bytes: 14817812832,
  extension_counts: { json: 1 },
  theme_counts: { boundaries: 1 },
  province_count: 31,
  indicator_count: 419,
  indicator_links: {
    'P1.001': { source_tags: ['geojson'], direct_local_candidate: true, availability: 'direct_local_or_boundary_extract', candidate_paths: ['geojson/example.json'] },
  },
};

test('renders the 419-indicator audit summary and source availability', () => {
  const markup = renderToStaticMarkup(<TypologyDataAuditDashboard report={report} catalog={catalog} />);
  assert.match(markup, /داشبورد ممیزی داده ۴۱۹ شاخص/);
  assert.match(markup, /کل شاخص‌ها/);
  assert.match(markup, /منبع محلی قابل استخراج/);
  assert.match(markup, /geojson/);
  assert.match(markup, /شاخص مفقود/);
});
