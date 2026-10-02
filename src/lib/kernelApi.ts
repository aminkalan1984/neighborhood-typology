// ============================================================
// کلاینت فرانت‌اند هستهٔ kernel (فاز پنج: رابط کاربری)
// همهٔ درخواست‌ها از طریق پراکسی Vite به /api/kernel می‌روند.
// ============================================================
import type {
  KernelRunResult, KernelBoundary, KernelAbstention, KernelPublishGate,
  ReproducibilityKey,
} from '../../server/kernelTypes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface KernelHealth {
  ok: boolean;
  kernel?: {
    service: string;
    status: string;
    engine: { calc_run_family: string; stages: string[] };
    registry_meta: {
      indicator_version: string;
      methodology_version: string;
      weight_set: { version: string; scheme: string; calibrated: boolean; status: string | null };
      threshold_set: { version: string; calibrated: boolean; status: string | null };
      calculation_versions: string[];
    };
    gate_summary: {
      weights_calibrated: boolean;
      thresholds_calibrated: boolean;
      numeric_publishing_allowed: boolean;
      pilot_gate_decision: string | null;
    };
  };
  error?: { code: string; message: string };
}

export interface KernelPilotSummary {
  gate_decision: string | null;
  gate_conditions: string[];
  known_limitations: string[];
  machine_checks: Record<string, boolean> | null;
  versioning_proof: Record<string, unknown> | null;
  test_suites: Record<string, { passed: boolean; line: string }> | null;
  coverage: {
    data_coverage?: Record<string, unknown>;
    evidence_coverage?: Record<string, unknown>;
  } | null;
}

export interface KernelRunResponse {
  run_id: string;
  fingerprint: string;
  calculation_version_id: string;
  reproducibility_key: ReproducibilityKey;
  publish_gate: KernelPublishGate;
  can_publish_numeric_scores: boolean;
  shadow_comparison: { matched: boolean; fields: Array<{ field: string; pilot: unknown; live: unknown; equal: boolean }>; note: string };
  abstentions: KernelAbstention[];
  result: KernelRunResult;
}

async function getJson<T>(url: string): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${API_BASE}${url}`);
    const data = await res.json().catch(() => null);
    return { status: res.status, data: data as T | null };
  } catch {
    return { status: 0, data: null };
  }
}

export async function getKernelHealth(): Promise<KernelHealth | null> {
  const { data } = await getJson<KernelHealth>('/api/kernel/health');
  return data;
}

export async function getKernelPilot(): Promise<KernelPilotSummary | null> {
  const { data } = await getJson<KernelPilotSummary>('/api/kernel/pilot');
  return data;
}

export interface KernelGateSummary {
  pilot_gate_decision: string | null;
  pilot_conditions: string[];
  rule: string;
}

export async function getKernelGate(): Promise<KernelGateSummary | null> {
  const { data } = await getJson<KernelGateSummary>('/api/kernel/gate');
  return data;
}

/** اجرای محاسبهٔ زنده روی دادهٔ واقعی پایلوت (POST) */
export async function runKernelCalculation(dataVersion = 'pilot-D6-2026-09-02'): Promise<KernelRunResponse | { error: { code: string; message: string } } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/kernel/calculation-runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data_version: dataVersion, use_pilot_records: true }),
    });
    return (await res.json()) as KernelRunResponse | { error: { code: string; message: string } };
  } catch {
    return null;
  }
}

/** drill-down زنجیرهٔ ده‌لایهٔ منشأ برای یک مقدار */
export interface KernelDrilldownResponse {
  chain_levels: string[];
  drilldown: import('../../server/kernelTypes').KernelDrilldown;
}

export async function getKernelDrilldown(runId: string, valueId: string): Promise<KernelDrilldownResponse | null> {
  const { data } = await getJson<KernelDrilldownResponse>(`/api/kernel/calculation-runs/${encodeURIComponent(runId)}/drilldown/${encodeURIComponent(valueId)}`);
  return data;
}

export async function getKernelBoundary(neighborhoodId = 'IR-THR-D6'): Promise<KernelBoundary | null> {
  const { data } = await getJson<KernelBoundary>(`/api/kernel/gis/boundaries/${encodeURIComponent(neighborhoodId)}`);
  return data;
}

// ---------- Phase 1: indicator mapping + analyze ----------
export interface MappingRow {
  ts_code: string;
  name: string;
  capital: string;
  kernel_code: string | null;
  kernel_title: string | null;
  confidence: 'exact' | 'keyword' | 'unmapped';
  evidence_streams: string[];
  registry_unit: string;
}

export interface KernelMappingResponse {
  summary: { total: number; mapped: number; exact: number; keyword: number; unmapped: string[] };
  rows: MappingRow[];
}

export async function getKernelMapping(): Promise<KernelMappingResponse | null> {
  const { data } = await getJson<KernelMappingResponse>('/api/kernel/mapping');
  return data;
}

export interface AnalyzeResponse {
  run_id: string;
  fingerprint: string;
  calculation_version_id: string;
  publish_gate: { can_publish_numeric_scores: boolean; reasons: string[] };
  can_publish_numeric_scores: boolean;
  unmapped_count: number;
  mappings: Array<{ ts_code: string; kernel_code: string | null; confidence: string; note: string }>;
  abstentions: Array<{ field: string; status: string; reason?: string; unblocks: string }>;
  result: KernelRunResult;
}

export async function runKernelAnalyze(indicatorValues: Record<string, number>): Promise<AnalyzeResponse | { error: { code: string; message: string } } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/kernel/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ indicatorValues }),
    });
    return (await res.json()) as AnalyzeResponse | { error: { code: string; message: string } };
  } catch {
    return null;
  }
}

// ---------- Phase 3: shadow mode (اجرای سایه) ----------
export type ShadowVerdict =
  | 'both_numeric' | 'ts_only' | 'kernel_only' | 'both_abstain' | 'not_comparable';

export interface ShadowCell {
  dimension: 'capital' | 'caueo' | 'qtr' | 'chain_gap' | 'equity';
  key: string;
  label: string;
  ts_value: number | null;
  ts_status: 'PUBLISHED' | 'ABSENT';
  ts_source: 'card' | 'derived';
  kernel_value: number | null;
  kernel_status: string;
  delta: number | null;
  verdict: ShadowVerdict;
  note: string;
}

export interface ShadowSummary {
  total_cells: number;
  both_numeric: number;
  ts_only: number;
  kernel_only: number;
  both_abstain: number;
  not_comparable: number;
  max_abs_delta: number | null;
  mean_abs_delta: number | null;
}

export interface ShadowBottleneckComparison {
  ts: { capital: string; transition: [string, string]; location: string; group: string } | null;
  kernel_status: string;
  kernel_primary: string | null;
  kernel_dimension: string | null;
  agreement: 'same' | 'different' | 'kernel_abstained' | 'ts_absent' | 'not_comparable';
  note: string;
}

export interface ShadowReport {
  ts_run_id: string;
  neighborhood: string;
  created_at: string;
  status: 'completed' | 'error';
  duration_ms: number;
  kernel_run_id: string | null;
  kernel_fingerprint: string | null;
  kernel_calculation_version: string | null;
  kernel_reproducibility_key: ReproducibilityKey | null;
  kernel_gate_open: boolean;
  records_sent: number;
  mapped: number;
  unmapped: string[];
  cells: ShadowCell[];
  bottleneck_comparison: ShadowBottleneckComparison | null;
  summary: ShadowSummary;
  divergences: string[];
  headline: string;
  rules: string[];
  error: string | null;
}

export interface ShadowListItem {
  ts_run_id: string;
  neighborhood: string;
  created_at: string;
  status: 'completed' | 'error';
  duration_ms: number;
  kernel_fingerprint: string | null;
  kernel_gate_open: boolean;
  summary: ShadowSummary;
  headline: string;
  error: string | null;
}

export interface ShadowOverview {
  mode: 'off' | 'async' | 'await';
  enabled: boolean;
  rules: string[];
  runtime: {
    total: number;
    completed: number;
    errored: number;
    ts_only_total: number;
    both_numeric_total: number;
    unmapped_codes: string[];
  };
  reports: ShadowListItem[];
}

// مسیرهای تصمیم‌یار بدنه را به‌شکل { success, data } برمی‌گردانند (برخلاف /api/kernel/*
// که بدون لفاف است). بدون بازکردن لفاف، مقدار مصرف‌شدهٔ سایه درست نیست.
function unwrapDecisionSupport(body: unknown): unknown {
  const b = body as { data?: unknown } | null;
  if (b && typeof b === 'object' && 'data' in b && b.data && typeof b.data === 'object') return b.data;
  return body;
}

// پاسخ خطا (۵xx/۴xx) شکلی مثل { error: {...} } دارد و نباید به‌عنوان گزارش سایه مصرف شود؛
// در غیر این صورت رندر به‌جای «خاموش/در انتظار» می‌شکند.
function isShadowOverview(data: unknown): data is ShadowOverview {
  const d = data as Partial<ShadowOverview> | null;
  return Boolean(d && typeof d === 'object' && d.runtime && typeof d.runtime.total === 'number');
}

function isShadowReport(data: unknown): data is ShadowReport {
  const d = data as Partial<ShadowReport> | null;
  return Boolean(d && typeof d === 'object' && typeof d.ts_run_id === 'string' && d.summary && Array.isArray(d.cells));
}

export async function getShadowOverview(): Promise<ShadowOverview | null> {
  const { status, data } = await getJson<unknown>('/api/decision-support/shadow');
  const body = unwrapDecisionSupport(data);
  if (status !== 200 || !isShadowOverview(body)) return null;
  return body;
}

export async function getShadowReport(runId: string): Promise<ShadowReport | null> {
  const { status, data } = await getJson<unknown>(`/api/decision-support/shadow/${encodeURIComponent(runId)}`);
  const body = unwrapDecisionSupport(data);
  if (status !== 200 || !isShadowReport(body)) return null;
  return body;
}

/** یک تحلیل واقعی از مسیر محصول اجرا می‌کند تا سایه در کنار آن ساخته شود. */
export async function runShadowProbe(
  indicatorValues: Record<string, number>,
  neighborhoodName = 'نمونهٔ اجرای سایه',
): Promise<{ runId: string; report: ShadowReport | null; error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/decision-support/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ neighborhoodName, purpose: 'baseline', indicatorValues }),
    });
    const payload = await res.json() as { data?: { runId?: string }; error?: { message?: string } };
    const runId = payload?.data?.runId;
    if (!res.ok || !runId) {
      return { runId: '', report: null, error: payload?.error?.message ?? `تحلیل با کد ${res.status} ناموفق بود.` };
    }
    // سایه ممکن است در حالت async کمی بعد آماده شود؛ چند بار تلاش می‌کنیم.
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const report = await getShadowReport(runId);
      if (report) return { runId, report, error: null };
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return { runId, report: null, error: 'گزارش سایه در این مدت آماده نشد.' };
  } catch {
    return { runId: '', report: null, error: 'سرویس تصمیم‌یار در دسترس نیست.' };
  }
}

// ---------- UI helpers: وضعیت‌ها و badge ها ----------
export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  OBSERVED: { label: 'مشاهده‌شده', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PROXY: { label: 'پروکسی (برچسب‌دار)', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ESTIMATED: { label: 'تخمین‌زده‌شده', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  MISSING: { label: 'داده گمشده', className: 'bg-zinc-200 text-zinc-700 border-zinc-300' },
  INVALID: { label: 'نامعتبر', className: 'bg-red-100 text-red-800 border-red-200' },
  PENDING_VALIDATION: { label: 'در انتظار اعتبارسنجی', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  WAITING_FOR_DATA: { label: 'در انتظار داده', className: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
  INSUFFICIENT_COVERAGE: { label: 'پوشش ناکافی', className: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  SOURCE_UNAVAILABLE: { label: 'منبع در دسترس نیست', className: 'bg-rose-100 text-rose-800 border-rose-200' },
  ACCESS_REQUIRED: { label: 'نیازمند دسترسی رسمی', className: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  NOT_APPLICABLE: { label: 'غیرمرتبط', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
};

export function statusBadge(status: string | null | undefined) {
  if (!status) return STATUS_BADGE.MISSING;
  return STATUS_BADGE[status] ?? { label: status, className: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
}

export const CONFIDENCE_COLORS: Record<string, string> = {
  'ناکافی': 'text-rose-600',
  'محدود': 'text-amber-600',
  'قابل اتکا': 'text-sky-600',
  'همگرا': 'text-emerald-600',
  'آزمون‌شده': 'text-emerald-700',
};
