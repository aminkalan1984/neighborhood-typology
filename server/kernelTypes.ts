// ============================================================
// Kernel Contract Models (فاز صفر + فاز یک: قرارداد داده مشترک)
// ------------------------------------------------------------
// kernel/ = مرجع رسمی محاسبات. این فایل فقط «قرارداد» را مدل می‌کند:
// Measurement + Provenance + CalculationRun + Confidence + Bottleneck
// و کدهای خطای استاندارد. هیچ محاسبه‌ای در TypeScript انجام نمی‌شود.
// قرارداد مرجع: kernel/schema/*.json و kernel/engine/status.py
// ============================================================

/** وضعیت‌های مجاز — mirror of kernel/engine/status.py STATUS */
export const KERNEL_STATUS = [
  'OBSERVED', 'MISSING', 'NOT_APPLICABLE', 'INVALID', 'ESTIMATED', 'PROXY',
  'INSUFFICIENT_COVERAGE', 'WAITING_FOR_DATA', 'SOURCE_UNAVAILABLE',
  'ACCESS_REQUIRED', 'PENDING_VALIDATION',
] as const;
export type KernelStatus = (typeof KERNEL_STATUS)[number];

export const NUMERIC_STATUSES: readonly KernelStatus[] = ['OBSERVED', 'ESTIMATED', 'PROXY'];

/** قاعدهٔ بنیادی: هر وضعیتی غیر از OBSERVED/ESTIMATED/PROXY مقدار عددی None دارد. */
export function isNumericStatus(s: string): boolean {
  return NUMERIC_STATUSES.includes(s as KernelStatus);
}

/** قاعدهٔ بنیادی: داده گمشده هرگز صفر نمی‌شود. */
export function numericOrNull(status: string, value: number | null | undefined): number | null {
  return isNumericStatus(status) ? (value ?? null) : null;
}

/** سطوح اطمینان — ladder از kernel/engine/confidence.py */
export const CONFIDENCE_LEVELS = ['ناکافی', 'محدود', 'قابل اتکا', 'همگرا', 'آزمون‌شده'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** کدهای خطای استاندارد قرارداد (فاز یک — بند ۴) */
export const KERNEL_ERROR_CODES = [
  'INVALID_INPUT',
  'INSUFFICIENT_COVERAGE',
  'PENDING_VALIDATION',
  'ACCESS_REQUIRED',
  'SOURCE_UNAVAILABLE',
  'CALCULATION_BLOCKED',
] as const;
export type KernelErrorCode = (typeof KERNEL_ERROR_CODES)[number];

export interface KernelError {
  error: {
    code: KernelErrorCode | 'ARTIFACT_MISSING' | 'NOT_FOUND';
    message: string;
    [k: string]: unknown;
  };
}

// ---------- Measurement ----------
export interface KernelMeasurement {
  indicator_code: string;
  value: number | null;           // عدد فقط وقتی status ∈ {OBSERVED, ESTIMATED, PROXY}
  status: KernelStatus;
  is_proxy: boolean;
  missing_reason?: string | null;
  spatial_scale?: string | null;
  downscaling_caveat?: string | null;
  evidence_stream: string[];
  group?: string | null;
}

// ---------- Provenance (زنجیرهٔ ده‌لایه) ----------
export interface KernelProvenanceChainLevels {
  result: unknown;
  indicator: unknown;
  formula: unknown;
  raw_value: unknown;
  source: unknown;
  request: unknown;
  file_record: unknown;
  date: unknown;
  processing: unknown;
  qc: unknown;
}

export const PROVENANCE_CHAIN_LEVELS = [
  'result', 'indicator', 'formula', 'raw_value', 'source',
  'request', 'file_record', 'date', 'processing', 'qc',
] as const;

export interface KernelDrilldown {
  result: {
    indicator_code: string;
    operationalization: string;
    raw_value: number | null;
    raw_unit: string | null;
    standardized_status: KernelStatus | string;
    standardized_reason?: string | null;
  };
  indicator: { title: string; capital: string; chain_stage: string; qtr_target: string; direction: string };
  formula: string | null;
  raw_value: number | null;
  unit: string | null;
  source: { source_id?: string | null; source_name?: string | null; provider?: string | null; dataset_id?: string | null };
  request_api: { url_api?: string | null; request_params?: Record<string, unknown> | null };
  file_record: { raw_file_ref?: string | null; raw_file_hash?: string | null; record_ref?: string | null };
  date: string | null;
  observation_period?: string | null;
  processing: { processing_version?: string | null; transformation_steps?: unknown[]; crs?: string | null };
  qc: { quality_checks: unknown[]; quality_score?: number | null };
  confidence: KernelConfidence | null;
  is_proxy?: boolean;
  reproducibility_key: ReproducibilityKey;
}

// ---------- Confidence ----------
export interface KernelConfidenceFactor {
  score: number;
  weight: number;
  contribution: number;
  explain: string;
}

export interface KernelConfidence {
  level: ConfidenceLevel | string;
  score: number;
  factors?: Record<string, KernelConfidenceFactor>;
  reason?: string;
  n_streams?: number;
  streams?: string[];
  is_proxy?: boolean;
  ceiling?: string;
  base_level?: string;
  n_members?: number;
}

// ---------- Reproducibility / versions ----------
export interface ReproducibilityKey {
  data_version: string;
  methodology_version: string;
  indicator_version: string;
  weight_set: string;
  threshold_set: string;
  calculation_version: string;
}

export interface KernelCalcRunMeta {
  family: string;
  calculation_version_id: string;
  engine_version: string;
  methodology_version: string;
  indicator_version: string;
  data_version: string;
  weight_set: { version: string; scheme: string; calibrated: boolean; label: string; override: unknown; hash: string };
  threshold_set: { version: string; hash: string };
  min_coverage: number;
  created_at: string;
}

// ---------- Aggregates ----------
export interface KernelAggregate {
  name: string;
  value: number | null;
  status: KernelStatus | string;
  formula_id: string;
  inputs: unknown[];
  sources: unknown[];
  versions: ReproducibilityKey;
  note: string;
  coverage_detail?: { n_qualified: number; n_attempted: number; n_registry: number; coverage: number; min_coverage: number };
  capital_name?: string;
  confidence?: KernelConfidence;
}

export interface KernelBottleneck {
  status: KernelStatus | string;
  bottleneck?: { dimension: string; [k: string]: unknown } | null;
  note: string;
  ai_independent: boolean;
  needed_data: string[];
  [k: string]: unknown;
}

export interface KernelAggregates {
  capitals: Record<string, KernelAggregate>;
  caueo: Record<string, KernelAggregate>;
  qtr: Record<string, KernelAggregate>;
  equity: KernelAggregate & { gap?: number | null };
  /** شکاف‌های زنجیره C→A→U→E→O با کلید یکسان G_CA..G_EO */
  chain_gaps?: Record<string, KernelAggregate>;
  /** اولویت اقدام — فقط پس از تأمین همهٔ عوامل صادر می‌شود */
  priority?: KernelAggregate;
  bottleneck: KernelBottleneck;
}

// ---------- Indicator record ----------
export interface KernelIndicatorRecord {
  indicator_code: string;
  operationalization: string;
  raw: KernelMeasurement & { unit?: string | null; provenance_value_id: string };
  normalized: {
    indicator_code: string;
    value: number | null;
    status: KernelStatus | string;
    is_proxy: boolean;
    missing_reason: string | null;
    spatial_scale: string | null;
    downscaling_caveat: string | null;
    evidence_stream: string[];
    group: string | null;
  };
  eligibility: { eligible: boolean; reasons: string[] };
  weight: number;
  capital_code: string;
  capital_name: string;
  chain_stage: string;
  qtr_target: string;
  direction_text: string;
  layer: string;
  title: string;
  confidence: KernelConfidence | null;
}

// ---------- Full run ----------
export interface KernelPublishGate {
  can_publish_numeric_scores: boolean;
  n_valid_standardized_scores: number;
  reasons: string[];
  rule: string;
}

/** نتیجهٔ کامل محاسبه — شکل یکسان با neighborhood_result.json پایلوت */
export interface KernelRunResult {
  run_id: string;
  neighborhood: Record<string, unknown> | null;
  calc_run: KernelCalcRunMeta;
  reproducibility_key: ReproducibilityKey;
  fingerprint: string;
  /** شکل یکسان با پایلوت: کلید «indicators» */
  indicators: KernelIndicatorRecord[];
  aggregates: KernelAggregates;
  drilldown_index: Record<string, KernelDrilldown>;
  engine: { stages: string[]; count: number };
  publish_gate: KernelPublishGate;
}

// ---------- Boundary ----------
export interface KernelBoundary {
  neighborhood_id: string;
  name_fa?: string | null;
  name_en?: string | null;
  version_id: string;
  is_official: boolean;
  is_proxy: boolean;
  proxy_reason?: string;
  metric_crs: string;
  area_km2?: number;
  centroid?: [number, number] | null;
  geometry_hash?: string;
  provenance: Record<string, unknown>;
  geometry_geojson?: Record<string, unknown> | null;
  append_only: boolean;
}

// ---------- Abstention (چرا عدد منتشر نشد) ----------
export interface KernelAbstention {
  field: string;
  status: string;
  reason: string | null | undefined;
  unblocks: string;
}

// ============================================================
// Publish Gate — TypeScript side enforcement (فاز صفر، بند ۴)
// عدد فقط پس از عبور از Gate قابل انتشار است؛ این تابع در لایهٔ
// نمایش/UI نیز استفاده می‌شود تا هیچ عددی بدون Gate رندر نشود.
// ============================================================
export function gateAllowsNumericPublishing(run: Pick<KernelRunResult, 'publish_gate' | 'aggregates'>): boolean {
  if (!run.publish_gate?.can_publish_numeric_scores) return false;
  return run.aggregates?.qtr?.K?.status === 'OBSERVED';
}

/** خلاصهٔ تخلف‌ها (abstentions) از یک اجرا — برای نمایش «دلیل عدم انتشار عدد» */
export function collectAbstentions(run: KernelRunResult): KernelAbstention[] {
  const out: KernelAbstention[] = [];
  for (const p of run.indicators ?? []) {
    if (!isNumericStatus(p.normalized.status) || p.normalized.value === null) {
      out.push({
        field: `${p.indicator_code} / ${p.operationalization} (نمرهٔ استانداردشده)`,
        status: String(p.normalized.status),
        reason: p.normalized.missing_reason,
        unblocks: 'کالیبراسیون L/U + تعریف واحد مرجع + مرز/دادهٔ رسمی',
      });
    }
  }
  for (const [label, grp] of [['سرمایه', run.aggregates?.capitals], ['مرحله C-A-U-E-O', run.aggregates?.caueo], ['خروجی', run.aggregates?.qtr]] as const) {
    for (const [k, v] of Object.entries(grp ?? {})) {
      if (v.status !== 'OBSERVED') {
        out.push({
          field: `${label} ${k}`,
          status: String(v.status),
          reason: v.note,
          unblocks: v.status === 'WAITING_FOR_DATA'
            ? 'دادهٔ پیمایشی/رفتاری (U/E/O)'
            : 'نمرهٔ استانداردشدهٔ معتبر برای شاخص‌های این گروه + کالیبراسیون',
        });
      }
    }
  }
  const eq = run.aggregates?.equity;
  if (eq && eq.status !== 'OBSERVED') {
    out.push({ field: 'equity_gap', status: String(eq.status), reason: eq.note, unblocks: 'دادهٔ تفکیک‌شدهٔ گروهی' });
  }
  const bn = run.aggregates?.bottleneck;
  if (bn && bn.status !== 'OBSERVED') {
    out.push({ field: 'bottleneck', status: String(bn.status), reason: bn.note, unblocks: (bn.needed_data ?? []).join('؛ ') });
  }
  return out;
}

/** استانداردسازی پاسخ خطای kernel به شکل قرارداد (فاز یک — بند ۴) */
export function normalizeKernelError(payload: unknown): KernelError['error'] {
  const e = payload as KernelError | undefined;
  if (e && typeof e === 'object' && 'error' in e && e.error?.code) return e.error;
  return { code: 'CALCULATION_BLOCKED', message: 'kernel service error', raw: payload };
}

/** تک‌مقدار توزیع وضعیت برای UI */
export interface KernelStatusCount {
  status: string;
  count: number;
}
