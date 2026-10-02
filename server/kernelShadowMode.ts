// ============================================================
// Kernel Shadow Mode (فاز ۳ — اجرای سایه)
// ------------------------------------------------------------
// مسیر محصول /api/decision-support/analyze نتیجهٔ خود را **بدون هیچ
// تغییری** برمی‌گرداند. در کنار آن، همان ورودی از kernel عبور می‌کند و
// اختلاف دو موتور در یک گزارش مقایسه‌ای ثبت می‌شود.
//
// قواعد:
//   * اجرای سایه هرگز روی پاسخ محصول اثر ندارد (غیرمسدودکننده).
//   * اجرای سایه هرگز خطا پرتاب نمی‌کند؛ خطا به status='error' تبدیل می‌شود.
//   * هیچ عددی در TypeScript محاسبه نمی‌شود؛ مقایسه فقط «خواندن» دو خروجی است.
//   * تفاوت TS و kernel پنهان نمی‌شود: خودداری kernel در برابر انتشار عدد TS
//     صریحاً به‌عنوان «واگرایی» گزارش می‌شود.
// ============================================================
import { kernelClient } from './kernelClient';
import { buildKernelRecordBatch } from './indicatorMapping';
import {
  numericOrNull,
  isNumericStatus,
  type KernelRunResult,
  type ReproducibilityKey,
} from './kernelTypes';

// ---------- ورودی کارت TS (ساختاری — بدون وابستگی سنگین) ----------
export interface ShadowCardInput {
  capitalScores: Array<{ capitalKey: string; score: number; band?: string }>;
  chainProfile?: Record<string, Array<{ stage: string; score: number }>>;
  chainGaps: { G_CA: number; G_AU: number; G_UE: number; G_EO: number };
  qualityVerdict: { Q: number; T: number; R: number };
  equityMap?: Array<{ indicatorCode: string; bestGroup: string; worstGroup: string; gap: number; verdict?: string }>;
  equityDataStatus?: string;
  bottleneck?: { capital: string; transition: [string, string]; location: string; group: string } | null;
  diagnosticType?: string;
}

// ---------- انواع گزارش ----------
export type ShadowVerdict =
  | 'both_numeric'    // هر دو موتور عدد دادند → delta معنادار است
  | 'ts_only'         // TS عدد داد، kernel خودداری کرد (محافظه‌کارتر)
  | 'kernel_only'     // kernel عدد داد، TS نداشت
  | 'both_abstain'    // هیچ‌کدام عدد ندادند — توافق بر خودداری
  | 'not_comparable'; // ابعاد غیرعددی (مثل گلوگاه)

export interface ShadowCell {
  dimension: 'capital' | 'caueo' | 'qtr' | 'chain_gap' | 'equity';
  key: string;
  label: string;
  ts_value: number | null;
  ts_status: 'PUBLISHED' | 'ABSENT';
  /** آیا مقدار TS از کارت خوانده شده یا برای مقایسه مشتق شده است */
  ts_source: 'card' | 'derived';
  kernel_value: number | null;
  kernel_status: string;
  /** kernel − TS؛ فقط وقتی هر دو عدد دارند */
  delta: number | null;
  verdict: ShadowVerdict;
  note: string;
}

export interface ShadowBottleneckComparison {
  ts: { capital: string; transition: [string, string]; location: string; group: string } | null;
  kernel_status: string;
  kernel_primary: string | null;
  kernel_dimension: string | null;
  agreement: 'same' | 'different' | 'kernel_abstained' | 'ts_absent' | 'not_comparable';
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
  /** قواعد ثابت اجرای سایه — در UI نمایش داده می‌شود */
  rules: string[];
  error: string | null;
}

export const SHADOW_RULES = [
  'پاسخ محصول بدون هیچ تغییری از مسیر TypeScript برمی‌گردد؛ سایه فقط خواندنی است.',
  'هیچ fallback عددی یا داده ساختگی وجود ندارد؛ خطای سایه به گزارش status=error تبدیل می‌شود.',
  'خودداری kernel یک نقص نیست — تخطی از گیت است که فقط با کالیبراسیون W/T برداشته می‌شود.',
  'کلید بازتولید و fingerprint اجرای سایه ثبت می‌شود تا مقایسه قابل استناد باشد.',
] as const;

// ---------- نگاشت کلیدهای سرمایه ----------
/** TS از «E» و kernel از «EC» برای سرمایهٔ اقتصادی استفاده می‌کند. */
const TS_TO_KERNEL_CAPITAL: Record<string, string> = { E: 'EC' };

export const CAPITAL_LABEL_FA: Record<string, string> = {
  H: 'انسانی', S: 'اجتماعی', E: 'اقتصادی', P: 'کالبدی',
  N: 'طبیعی', C: 'فرهنگی', G: 'حکمرانی', R: 'ارتباطی',
  EC: 'اقتصادی',
};

const CAUEO_LABEL_FA: Record<string, string> = {
  C: 'ظرفیت', A: 'دسترسی', U: 'استفاده', E: 'تجربه', O: 'پیامد',
};

/** TS از نام کامل مرحله استفاده می‌کند؛ kernel از حرف کوتاه C-A-U-E-O. */
const TS_STAGE_TO_CAUEO: Record<string, string> = {
  CAPACITY: 'C', ACCESS: 'A', USE: 'U', EXPERIENCE: 'E', OUTCOME: 'O',
  C: 'C', A: 'A', U: 'U', E: 'E', O: 'O',
};

const CHAIN_GAP_LABEL_FA: Record<string, string> = {
  G_CA: 'شکاف ظرفیت→دسترسی',
  G_AU: 'شکاف دسترسی→استفاده',
  G_UE: 'شکاف استفاده→تجربه',
  G_EO: 'شکاف تجربه→پیامد',
};

// ---------- کمک‌تابع‌ها ----------
function cell(
  dimension: ShadowCell['dimension'],
  key: string,
  label: string,
  tsValue: number | null,
  kernel: { value: number | null; status: string } | null,
  note: string,
  tsSource: ShadowCell['ts_source'] = 'card',
): ShadowCell {
  const ts = typeof tsValue === 'number' && Number.isFinite(tsValue) ? tsValue : null;
  const kv = kernel ? numericOrNull(kernel.status, kernel.value) : null;
  const ks = kernel ? String(kernel.status) : 'NOT_PRESENT';

  let verdict: ShadowVerdict;
  if (ts !== null && kv !== null) verdict = 'both_numeric';
  else if (ts !== null) verdict = 'ts_only';
  else if (kv !== null) verdict = 'kernel_only';
  else verdict = 'both_abstain';

  return {
    dimension,
    key,
    label,
    ts_value: ts,
    ts_status: ts === null ? 'ABSENT' : 'PUBLISHED',
    ts_source: tsSource,
    kernel_value: kv,
    kernel_status: ks,
    delta: ts !== null && kv !== null ? round(kv - ts) : null,
    verdict,
    note,
  };
}

function round(n: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** مقدار TS فقط اگر عدد متناهی باشد، وگرنه null — «داده گمشده هرگز صفر نمی‌شود». */
function tsNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function kernelAggregate(
  group: Record<string, { value?: number | null; status?: string }> | undefined,
  key: string,
): { value: number | null; status: string } | null {
  const a = group?.[key];
  if (!a) return null;
  return { value: a.value ?? null, status: String(a.status ?? 'MISSING') };
}

// ---------- مقایسهٔ خالص (بدون I/O) ----------
export function compareShadow(input: { card: ShadowCardInput; kernel: KernelRunResult }): {
  cells: ShadowCell[];
  bottleneck_comparison: ShadowBottleneckComparison;
  summary: ShadowSummary;
  divergences: string[];
  headline: string;
} {
  const { card, kernel } = input;
  const agg = kernel.aggregates;
  const cells: ShadowCell[] = [];

  // ---- سرمایه‌ها ----
  const tsCapitals = new Map<string, number>();
  for (const c of card.capitalScores ?? []) {
    const v = tsNumber(c.score);
    if (v !== null) tsCapitals.set(c.capitalKey, v);
  }
  const kernelCapitalKeys = Object.keys(agg?.capitals ?? {});
  const allCapitalKeys = Array.from(new Set([...tsCapitals.keys(), ...kernelCapitalKeys])).sort();
  for (const k of allCapitalKeys) {
    const kernelKey = TS_TO_KERNEL_CAPITAL[k] ?? k;
    const tsVal = tsCapitals.get(k) ?? null;
    const kAgg = kernelAggregate(agg?.capitals, kernelKey);
    const label = `سرمایهٔ ${CAPITAL_LABEL_FA[k] ?? k}`;
    cells.push(cell(
      'capital', k, label, tsVal, kAgg,
      kAgg && !isNumericStatus(String(kAgg.status))
        ? `${kAgg.status} — اجماع سرمایه در kernel منتشر نشد`
        : `نگاشت سرمایه TS ${k} → kernel ${kernelKey}`,
    ));
  }

  // ---- مراحل C-A-U-E-O (میانگین TS از پروفایل زنجیرهٔ سرمایه‌ها — فقط برای مقایسه) ----
  const derivedStages = new Map<string, { sum: number; n: number }>();
  for (const stages of Object.values(card.chainProfile ?? {})) {
    for (const s of stages ?? []) {
      const v = tsNumber(s.score);
      if (v === null) continue;
      const stageKey = TS_STAGE_TO_CAUEO[String(s.stage).toUpperCase()];
      if (!stageKey) continue; // مرحله ناشناخته هرگز حدس زده نمی‌شود
      const cur = derivedStages.get(stageKey) ?? { sum: 0, n: 0 };
      cur.sum += v;
      cur.n += 1;
      derivedStages.set(stageKey, cur);
    }
  }
  for (const stageKey of ['C', 'A', 'U', 'E', 'O']) {
    const d = derivedStages.get(stageKey);
    const tsVal = d && d.n > 0 ? round(d.sum / d.n) : null;
    const kAgg = kernelAggregate(agg?.caueo, stageKey);
    cells.push(cell(
      'caueo', stageKey, `مرحلهٔ ${CAUEO_LABEL_FA[stageKey] ?? stageKey} (${stageKey})`,
      tsVal, kAgg,
      tsVal === null
        ? 'TS امتیاز مرحله را در کارت منتشر نکرد'
        : 'TS: میانگین سادهٔ امتیاز مرحله در همهٔ سرمایه‌ها (فقط برای مقایسهٔ سایه مشتق شده)',
      'derived',
    ));
  }

  // ---- شکاف‌های زنجیره (۱:۱ با کلید یکسان) ----
  for (const gapKey of ['G_CA', 'G_AU', 'G_UE', 'G_EO'] as const) {
    const tsVal = tsNumber((card.chainGaps ?? {})[gapKey]);
    const kAgg = kernelAggregate(agg?.chain_gaps, gapKey);
    cells.push(cell(
      'chain_gap', gapKey, CHAIN_GAP_LABEL_FA[gapKey] ?? gapKey, tsVal, kAgg,
      kAgg && String(kAgg.status) !== 'OBSERVED' && !isNumericStatus(String(kAgg.status))
        ? 'نقطهٔ انتهایی زنجیره در kernel فاقد عدد معتبر است — شکاف صادر نمی‌شود'
        : 'شکاف زنجیره با کلید یکسان قابل مقایسه مستقیم است',
    ));
  }

  // ---- Q / T / R (+ K که TS منتشر نمی‌کند) ----
  const verdictMap: Record<string, unknown> = {
    Q: (card.qualityVerdict ?? {}).Q,
    T: (card.qualityVerdict ?? {}).T,
    R: (card.qualityVerdict ?? {}).R,
  };
  const qtrLabelFa: Record<string, string> = {
    K: 'K — سرمایهٔ کل', Q: 'Q — کیفیت', T: 'T — تحول', R: 'R — بازتولیدپذیری',
  };
  const kernelQtrKeys = Object.keys(agg?.qtr ?? {});
  const allQtrKeys = Array.from(new Set([...Object.keys(verdictMap), ...kernelQtrKeys]));
  // ترتیب پایدار: K اول (اگر فقط در kernel باشد)، سپس Q/T/R
  allQtrKeys.sort((a, b) => (a === 'K' ? -1 : b === 'K' ? 1 : a.localeCompare(b)));
  for (const key of allQtrKeys) {
    const tsVal = tsNumber(verdictMap[key]);
    const kAgg = kernelAggregate(agg?.qtr, key);
    cells.push(cell(
      'qtr', key, qtrLabelFa[key] ?? key, tsVal, kAgg,
      tsVal === null && key === 'K'
        ? 'TS فقط Q/T/R را منتشر می‌کند؛ K صرفاً خروجی kernel است'
        : 'Q/T/R جدا نگه داشته می‌شوند و در هیچ امتیاز ترکیبی پنهانی ادغام نمی‌شوند',
    ));
  }

  // ---- عدالت ----
  const gaps = (card.equityMap ?? []).map(g => tsNumber(g.gap)).filter((v): v is number => v !== null);
  const tsEquity = gaps.length > 0 ? round(Math.max(...gaps)) : null;
  const kEquity = agg?.equity
    ? { value: agg.equity.value ?? null, status: String(agg.equity.status ?? 'MISSING') }
    : null;
  cells.push(cell(
    'equity', 'equity_gap', 'شکاف عدالت (P_best − P_worst)', tsEquity, kEquity,
    tsEquity === null
      ? `TS هیچ شکاف گروهی صادر نکرد (وضعیت داده: ${card.equityDataStatus ?? 'نامعلوم'})`
      : `TS بزرگ‌ترین شکاف از ${gaps.length} شاخص را گزارش می‌کند؛ kernel یک اجماع واحد می‌دهد`,
  ));

  // ---- خلاصه ----
  const deltas = cells.map(c => c.delta).filter((d): d is number => d !== null);
  const summary: ShadowSummary = {
    total_cells: cells.length,
    both_numeric: cells.filter(c => c.verdict === 'both_numeric').length,
    ts_only: cells.filter(c => c.verdict === 'ts_only').length,
    kernel_only: cells.filter(c => c.verdict === 'kernel_only').length,
    both_abstain: cells.filter(c => c.verdict === 'both_abstain').length,
    not_comparable: cells.filter(c => c.verdict === 'not_comparable').length,
    max_abs_delta: deltas.length > 0 ? round(Math.max(...deltas.map(Math.abs))) : null,
    mean_abs_delta: deltas.length > 0 ? round(deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length) : null,
  };

  // ---- گلوگاه (غیرعددی — فقط مقایسهٔ حضور/بُعد) ----
  const kb = agg?.bottleneck as (Record<string, unknown> | undefined);
  const kernelPrimary = kb
    ? (typeof kb.primary_bottleneck === 'string' ? kb.primary_bottleneck : null)
    : null;
  const kernelDimension = kb && kb.bottleneck && typeof kb.bottleneck === 'object'
    ? String(((kb.bottleneck as Record<string, unknown>).dimension) ?? '')
    : null;
  const kernelBnStatus = kb ? String(kb.status ?? 'MISSING') : 'MISSING';
  const tsBn = card.bottleneck ?? null;

  let agreement: ShadowBottleneckComparison['agreement'];
  let bnNote: string;
  if (!tsBn) {
    agreement = 'ts_absent';
    bnNote = 'کارت TS گلوگاهی منتشر نکرد';
  } else if (kernelBnStatus !== 'OBSERVED' && kernelPrimary === null) {
    agreement = 'kernel_abstained';
    bnNote = `kernel خودداری کرد (${kernelBnStatus}) — هیچ گلوگاهی بدون شواهد کافی منتشر نمی‌شود`;
  } else if (kernelDimension && tsBn.capital && kernelDimension.includes(tsBn.capital)) {
    agreement = 'same';
    bnNote = 'بُعد گلوگاه هر دو موتور هم‌راستا است';
  } else {
    agreement = 'different';
    bnNote = `TS: سرمایهٔ ${tsBn.capital} / گذار ${tsBn.transition.join('→')} — kernel: ${kernelPrimary ?? '—'}`;
  }

  const bottleneckComparison: ShadowBottleneckComparison = {
    ts: tsBn ? { capital: tsBn.capital, transition: tsBn.transition, location: tsBn.location, group: tsBn.group } : null,
    kernel_status: kernelBnStatus,
    kernel_primary: kernelPrimary,
    kernel_dimension: kernelDimension,
    agreement,
    note: bnNote,
  };

  // ---- واگرایی‌های قابل استناد ----
  const divergences: string[] = [];
  if (summary.ts_only > 0) {
    const keys = cells.filter(c => c.verdict === 'ts_only').map(c => c.key).join('، ');
    divergences.push(
      `${summary.ts_only} سلول: TS عدد منتشر می‌کند ولی kernel خودداری می‌کند (${keys}) — همین اختلاف موضوع تصمیم معماری فاز صفر است.`,
    );
  }
  if (summary.kernel_only > 0) {
    const keys = cells.filter(c => c.verdict === 'kernel_only').map(c => c.key).join('، ');
    divergences.push(`${summary.kernel_only} سلول فقط در kernel عدد دارد (${keys}) — TS این خروجی را پوشش نمی‌دهد.`);
  }
  if (summary.both_numeric > 0 && summary.max_abs_delta !== null && summary.max_abs_delta > 5) {
    divergences.push(
      `در ${summary.both_numeric} سلول هر دو موتور عدد داده‌اند و بیشترین اختلاف ${summary.max_abs_delta} امتیاز است — نیازمند بررسی هم‌ترازی مقیاس.`,
    );
  }
  if (agreement === 'different') {
    divergences.push(`گلوگاه دو موتور هم‌راستا نیست: ${bnNote}`);
  }
  if (divergences.length === 0) {
    divergences.push('واگرایی معناداری یافت نشد — دو موتور در همهٔ ابعاد قابل‌مقایسه هم‌رفتار بوده‌اند.');
  }

  // ---- تیتر ----
  let headline: string;
  if (summary.ts_only > 0) {
    headline = `${summary.ts_only} از ${summary.total_cells} سلول: TS عدد منتشر می‌کند در حالی که kernel خودداری می‌کند${summary.both_numeric > 0 ? ` (و ${summary.both_numeric} سلول عدد مشترک)` : ''}.`;
  } else if (summary.both_numeric === summary.total_cells) {
    headline = `هر دو موتور در همهٔ ${summary.total_cells} سلول عدد داده‌اند؛ بیشترین اختلاف ${summary.max_abs_delta} امتیاز.`;
  } else {
    headline = `${summary.both_numeric} سلول عدد مشترک، ${summary.both_abstain} سلول خودداری مشترک.`;
  }

  return { cells, bottleneck_comparison: bottleneckComparison, summary, divergences, headline };
}

// ---------- اجرای سایه ----------
export interface ShadowRunInput {
  tsRunId: string;
  neighborhoodName: string;
  indicatorValues: Record<string, number>;
  groupValues?: Record<string, Record<string, number>>;
  card: ShadowCardInput;
  dataVersion?: string;
}

/**
 * اجرای کامل مسیر سایه: نگاشت ورودی TS → رکوردهای kernel → اجرای kernel →
 * مقایسه. هرگز خطا پرتاب نمی‌کند؛ در صورت شکست یک گزارش status='error'
 * برمی‌گرداند تا مشکل دیده شود ولی محصول آسیب نبیند.
 */
export async function runShadowComparison(input: ShadowRunInput): Promise<ShadowReport> {
  const startedAt = Date.now();
  const base: ShadowReport = {
    ts_run_id: input.tsRunId,
    neighborhood: input.neighborhoodName,
    created_at: new Date().toISOString(),
    status: 'error',
    duration_ms: 0,
    kernel_run_id: null,
    kernel_fingerprint: null,
    kernel_calculation_version: null,
    kernel_reproducibility_key: null,
    kernel_gate_open: false,
    records_sent: 0,
    mapped: 0,
    unmapped: [],
    cells: [],
    bottleneck_comparison: null,
    summary: {
      total_cells: 0, both_numeric: 0, ts_only: 0, kernel_only: 0,
      both_abstain: 0, not_comparable: 0, max_abs_delta: null, mean_abs_delta: null,
    },
    divergences: [],
    headline: 'اجرای سایه کامل نشد.',
    rules: [...SHADOW_RULES],
    error: null,
  };

  try {
    const batch = buildKernelRecordBatch(input.indicatorValues, input.groupValues ?? {}, {
      source_name: 'decision-support shadow adapter',
      provider: 'shadow mode — read-only comparison',
      api: '/api/decision-support/analyze',
      value_id_prefix: `VAL-SHADOW-${input.tsRunId}`,
    });

    if (batch.records.length === 0) {
      return {
        ...base,
        duration_ms: Date.now() - startedAt,
        mapped: 0,
        unmapped: batch.unmapped,
        error: batch.unmapped.length > 0
          ? `هیچ شاخصی به رجیستر kernel نگاشت نشد: ${batch.unmapped.join('، ')}`
          : 'هیچ رکورد معتبری برای اجرای سایه ساخته نشد',
      };
    }

    const run = await kernelClient.calculationRun({
      data_version: input.dataVersion ?? `shadow-${input.tsRunId}`,
      use_pilot_records: false,
      records: batch.records as Array<Record<string, unknown>>,
    });

    const comparison = compareShadow({ card: input.card, kernel: run });

    return {
      ...base,
      status: 'completed',
      duration_ms: Date.now() - startedAt,
      kernel_run_id: run.run_id,
      kernel_fingerprint: run.fingerprint,
      kernel_calculation_version: run.calc_run?.calculation_version_id ?? null,
      kernel_reproducibility_key: run.reproducibility_key ?? null,
      kernel_gate_open: Boolean(run.publish_gate?.can_publish_numeric_scores),
      records_sent: batch.records.length,
      mapped: batch.mappings.filter(m => m.kernel_code).length,
      unmapped: batch.unmapped,
      cells: comparison.cells,
      bottleneck_comparison: comparison.bottleneck_comparison,
      summary: comparison.summary,
      divergences: comparison.divergences,
      headline: comparison.headline,
    };
  } catch (error) {
    return {
      ...base,
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'shadow comparison failed',
    };
  }
}

// ---------- انبار گزارش‌ها ----------
const SHADOW_STORE = new Map<string, ShadowReport>();
const SHADOW_MAX = 200;

export function putShadowReport(report: ShadowReport): void {
  SHADOW_STORE.set(report.ts_run_id, report);
  while (SHADOW_STORE.size > SHADOW_MAX) {
    const oldest = SHADOW_STORE.keys().next().value;
    if (oldest === undefined) break;
    SHADOW_STORE.delete(oldest);
  }
}

export function getShadowReport(tsRunId: string): ShadowReport | null {
  return SHADOW_STORE.get(tsRunId) ?? null;
}

export function listShadowReports(): ShadowReport[] {
  return Array.from(SHADOW_STORE.values()).reverse();
}

export function clearShadowReports(): void {
  SHADOW_STORE.clear();
}

/** خلاصهٔ تجمعی برای داشبورد */
export function shadowRuntimeSummary(): {
  total: number;
  completed: number;
  errored: number;
  ts_only_total: number;
  both_numeric_total: number;
  unmapped_codes: string[];
} {
  const reports = Array.from(SHADOW_STORE.values());
  const unmapped = new Set<string>();
  for (const r of reports) for (const u of r.unmapped) unmapped.add(u);
  return {
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    errored: reports.filter(r => r.status === 'error').length,
    ts_only_total: reports.reduce((a, r) => a + r.summary.ts_only, 0),
    both_numeric_total: reports.reduce((a, r) => a + r.summary.both_numeric, 0),
    unmapped_codes: Array.from(unmapped),
  };
}

// ---------- تنظیم حالت ----------
export type ShadowMode = 'off' | 'async' | 'await';

/**
 * حالت پیش‌فرض «async» است: گزارش سایه در پس‌زمینه ساخته می‌شود و پاسخ
 * محصول نه تغییر می‌کند و نه کند می‌شود. برای خاموش‌کردن کامل:
 * ARA_KERNEL_SHADOW=off
 */
export function shadowModeSetting(): ShadowMode {
  const raw = (process.env.ARA_KERNEL_SHADOW ?? 'async').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'disabled') return 'off';
  if (raw === 'await' || raw === 'sync' || raw === 'blocking') return 'await';
  return 'async';
}

export function shadowModeEnabled(): boolean {
  return shadowModeSetting() !== 'off';
}

/**
 * اجرای غیرمسدودکنندهٔ سایه. نتیجه را در انبار می‌گذارد و هرگز خطا پرتاب
 * نمی‌کند. برای استفاده در مسیر محصول: void scheduleShadowComparison(...)
 */
export function scheduleShadowComparison(input: ShadowRunInput): Promise<ShadowReport | null> {
  if (!shadowModeEnabled()) return Promise.resolve(null);
  return runShadowComparison(input)
    .then((report) => {
      putShadowReport(report);
      return report;
    })
    .catch(() => null); // سایه هرگز مسیر محصول را نمی‌شکند
}
