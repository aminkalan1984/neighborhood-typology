// ============================================================
// صفحهٔ اختصاصی هستهٔ محاسبات kernel (فاز صفر + فاز پنج)
// ------------------------------------------------------------
// نمایش یکپارچهٔ وضعیت هسته: طراحی API، اجرای اتصال، کالیبراسیون،
// نتایج واقعی پایلوت، تخلف‌ها (abstentions) و drill-down منشأ.
// قاعدهٔ UI: داده گمشده هرگز صفر نمایش داده نمی‌شود — badge وضعیت.
// ============================================================
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, ArrowRightLeft, BadgeCheck, Boxes, ChevronDown,
  Cpu, Database, FileSearch, GitCommitVertical, GitCompareArrows, Globe,
  HeartPulse, Layers, Loader2, Lock, RefreshCw, ShieldAlert, ShieldCheck,
  SlidersHorizontal, XCircle,
} from 'lucide-react';
import {
  type KernelHealth, type KernelPilotSummary, type KernelRunResponse,
  type KernelMappingResponse, type AnalyzeResponse,
  type ShadowOverview, type ShadowReport,
  getKernelHealth, getKernelPilot, runKernelCalculation, statusBadge,
  getKernelMapping, runKernelAnalyze,
  getShadowOverview, runShadowProbe,
  CONFIDENCE_COLORS,
} from '../lib/kernelApi';
import type { KernelIndicatorRecord, KernelRunResult } from '../../server/kernelTypes';

type TabKey = 'overview' | 'api' | 'mapping' | 'shadow' | 'pilot' | 'run' | 'drilldown';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Cpu }> = [
  { key: 'overview', label: 'معماری و گیت', icon: ShieldCheck },
  { key: 'api', label: 'طراحی API', icon: ArrowRightLeft },
  { key: 'mapping', label: 'نگاشت شاخص‌ها', icon: ArrowRightLeft },
  { key: 'shadow', label: 'اجرای سایه', icon: GitCompareArrows },
  { key: 'pilot', label: 'پایلوت منطقه ۶', icon: Database },
  { key: 'run', label: 'اجرای محاسبه', icon: Cpu },
  { key: 'drilldown', label: 'Drill-down منشأ', icon: FileSearch },
];

/** رنگ/برچسب حکم هر سلول مقایسهٔ سایه */
const SHADOW_VERDICT_META: Record<string, { label: string; className: string }> = {
  both_numeric: { label: 'هر دو عدد دادند', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ts_only: { label: 'فقط TS (kernel خودداری کرد)', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  kernel_only: { label: 'فقط kernel', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  both_abstain: { label: 'هر دو خودداری', className: 'bg-zinc-200 text-zinc-700 border-zinc-300' },
  not_comparable: { label: 'غیرقابل مقایسه', className: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

const SHADOW_DIMENSION_FA: Record<string, string> = {
  capital: 'سرمایه', caueo: 'مرحله C-A-U-E-O', qtr: 'خروجی Q/T/R',
  chain_gap: 'شکاف زنجیره', equity: 'عدالت',
};

const SHADOW_AGREEMENT_FA: Record<string, { label: string; className: string }> = {
  same: { label: 'هم‌راستا', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  different: { label: 'ناهم‌راستا', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  kernel_abstained: { label: 'kernel خودداری کرد', className: 'bg-zinc-200 text-zinc-700 border-zinc-300' },
  ts_absent: { label: 'TS منتشر نکرد', className: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
  not_comparable: { label: 'غیرقابل مقایسه', className: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

const API_ENDPOINTS: Array<{ method: string; path: string; desc: string; layer: 'python' | 'express' }> = [
  { method: 'GET', path: '/v1/health', desc: 'سلامت سرویس، نسخه‌ها و وضعیت گیت', layer: 'python' },
  { method: 'GET', path: '/v1/registries', desc: 'کاتالوگ رجیسترها (۴۱۹/۴۰/۸۳/۲۵/۱۵/۲۳) و نسخه‌ها', layer: 'python' },
  { method: 'POST', path: '/v1/calculation-runs', desc: 'اجرای کامل ۱۶ مرحله‌ای + اطمینان + گلوگاه + گیت انتشار', layer: 'python' },
  { method: 'GET', path: '/v1/calculation-runs/:id', desc: 'بازیابی نتیجهٔ اجرا با fingerprint', layer: 'python' },
  { method: 'GET', path: '/v1/calculation-runs/:id/drilldown/:valueId', desc: 'زنجیرهٔ ده‌لایهٔ منشأ برای هر مقدار', layer: 'python' },
  { method: 'POST', path: '/v1/ingestion/validate', desc: 'اعتبارسنجی ورودی + گردش تأیید انسانی', layer: 'python' },
  { method: 'POST', path: '/v1/ingestion/approve', desc: 'تصمیم انسانی روی رکورد (دروازهٔ ورود به محاسبه)', layer: 'python' },
  { method: 'GET', path: '/v1/gis/boundaries/:id', desc: 'مرز append-only با منشأ اجباری', layer: 'python' },
  { method: 'GET', path: '/v1/pilot/mvp2', desc: 'artifact های واقعی پایلوت MVP-2', layer: 'python' },
  { method: 'GET', path: '/api/kernel/health', desc: 'سلامت اتصال Express ⇄ Python', layer: 'express' },
  { method: 'GET', path: '/api/kernel/pilot', desc: 'خلاصهٔ پایلوت + گیت برای UI', layer: 'express' },
  { method: 'POST', path: '/api/kernel/calculation-runs', desc: 'اجرای محاسبه + مقایسهٔ shadow + تخلف‌ها', layer: 'express' },
  { method: 'GET', path: '/api/kernel/calculation-runs/:id/drilldown/:valueId', desc: 'drill-down منشأ برای UI', layer: 'express' },
  { method: 'GET', path: '/api/kernel/gis/boundaries/:id', desc: 'مرز پروکسی برچسب‌دار با منشأ', layer: 'express' },
  { method: 'GET', path: '/api/decision-support/shadow', desc: 'خلاصهٔ اجرای سایه + قواعد ثابت', layer: 'express' },
  { method: 'GET', path: '/api/decision-support/shadow/:runId', desc: 'گزارش مقایسهٔ kernel در برابر موتور TypeScript', layer: 'express' },
  { method: 'POST', path: '/api/decision-support/shadow/:runId', desc: 'بازاجرای سایه روی یک اجرای موجود', layer: 'express' },
];

/** شاخص‌های نمونهٔ اجرای سایه — همان مجموعهٔ آزمایشی پذیرش مسیر محصول. */
const SHADOW_PROBE_VALUES: Record<string, number> = {
  H1: 80, H3: 72, S1: 70, S2: 64, E1: 60, P1: 65,
  P4: 58, N1: 55, C1: 75, G1: 50, R1: 68,
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${className}`}>{label}</span>;
}

function Section({ title, icon: Icon, children, subtitle }: { title: string; icon?: typeof Cpu; children: ReactNode; subtitle?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-3">
      <header className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-brand-700" />}
        <h3 className="text-sm font-bold text-ink-800">{title}</h3>
      </header>
      {subtitle && <p className="text-[11px] text-ink-500 leading-relaxed">{subtitle}</p>}
      {children}
    </section>
 );
}

function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-1.5 last:border-0">
      <span className="text-[11px] text-ink-500 shrink-0">{k}</span>
      <span className={`text-[11px] font-semibold text-ink-800 text-left ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  );
}

export default function KernelCorePage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [health, setHealth] = useState<KernelHealth | null>(null);
  const [pilot, setPilot] = useState<KernelPilotSummary | null>(null);
  const [run, setRun] = useState<KernelRunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedVid, setSelectedVid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState<KernelMappingResponse | null>(null);
  const [analyze, setAnalyze] = useState<AnalyzeResponse | { error: { code: string; message: string } } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [shadow, setShadow] = useState<ShadowOverview | null>(null);
  const [shadowReport, setShadowReport] = useState<ShadowReport | null>(null);
  const [shadowBusy, setShadowBusy] = useState(false);
  const [shadowError, setShadowError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [h, p, m, s] = await Promise.all([
      getKernelHealth(), getKernelPilot(), getKernelMapping(), getShadowOverview(),
    ]);
    setHealth(h);
    setPilot(p);
    setMapping(m);
    setShadow(s);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const executeRun = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    const r = await runKernelCalculation();
    if (r && 'error' in r) setRunError((r as { error: { message: string } }).error.message);
    else if (r) setRun(r);
    setRunning(false);
  }, []);

  // اجرای نمونهٔ یک شاخص از مسیر analyze (نگاشت TS → kernel → اجرای کامل)
  const runAnalyzeSample = useCallback(async (tsCode: string) => {
    setAnalyzing(true);
    setAnalyze(null);
    setTab('mapping');
    const r = await runKernelAnalyze({ [tsCode]: 70 });
    setAnalyze(r);
    setAnalyzing(false);
  }, []);

  // اجرای یک تحلیل واقعی محصول و سپس خواندن گزارش سایهٔ همان اجرا
  const runShadow = useCallback(async () => {
    setShadowBusy(true);
    setShadowError(null);
    setShadowReport(null);
    setTab('shadow');
    const { report, error } = await runShadowProbe(SHADOW_PROBE_VALUES);
    if (error && !report) setShadowError(error);
    if (report) setShadowReport(report);
    setShadow(await getShadowOverview());
    setShadowBusy(false);
  }, []);

  const gate = health?.kernel?.gate_summary;
  const meta = health?.kernel?.registry_meta;
  const stages: string[] = health?.kernel?.engine?.stages ?? [];
  const indicators: KernelIndicatorRecord[] = run?.result?.indicators ?? [];
  const drilldownIndex = run?.result?.drilldown_index ?? {};

  // aggregated status counts for the coverage donut-like summary
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of indicators) {
      const s = String(p.normalized.status);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [indicators]);

  const selectedRecord = selectedVid ? indicators.find((p) => p.raw.provenance_value_id === selectedVid) : null;
  const selectedDD = selectedVid ? drilldownIndex[selectedVid] : null;

  const connected = !!health?.ok;

  return (
    <div className="flex flex-col gap-5 text-right" dir="rtl">
      {/* ---------- Header ---------- */}
      <div className="bg-gradient-to-l from-brand-900 via-brand-800 to-brand-700 text-white p-6 rounded-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10"><Cpu size={22} /></div>
            <div>
              <h2 className="text-lg font-bold">هستهٔ محاسبات و حاکمیت داده (kernel)</h2>
              <p className="text-[11px] text-brand-100/90 mt-0.5">
                مرجع رسمی محاسبات — سنجش، تشخیص، اولویت‌بندی و آماده‌سازی تجویز کیفیت محله · {health?.kernel?.service ?? 'kernel-service'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 px-3 py-1 text-[11px] font-bold text-emerald-200">
                <HeartPulse size={13} /> متصل
              </span>
              ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-400/15 border border-rose-300/30 px-3 py-1 text-[11px] font-bold text-rose-200">
                <XCircle size={13} /> قطع
              </span>
            )}
            <button
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[11px] font-bold hover:bg-white/20 transition-colors"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> بروزرسانی
            </button>
          </div>
        </div>
        {/* gate banner */}
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-2.5 ${gate?.numeric_publishing_allowed === false
          ? 'bg-amber-400/10 border-amber-300/30'
          : 'bg-emerald-400/10 border-emerald-300/30'}`}>
          {gate?.numeric_publishing_allowed === false ? <Lock size={15} className="text-amber-300 mt-0.5 shrink-0" /> : <BadgeCheck size={15} className="text-emerald-300 mt-0.5 shrink-0" />}
          <div className="text-[11px] leading-relaxed">
            <b>گیت انتشار: {gate?.numeric_publishing_allowed === false ? 'بسته' : 'باز'}</b> — انتشار عدد محله فقط پس از کالیبراسیون L/U (T) و وزن‌ها (W) و تأمین دادهٔ U/E/O و مرز رسمی مجاز است.
            {gate?.pilot_gate_decision && <> · تصمیم گیت پایلوت: <b className="font-mono">{gate.pilot_gate_decision}</b></>}
          </div>
        </div>
      </div>

      {/* ---------- Tabs ---------- */}
      <nav className="flex gap-2 flex-wrap" aria-label="بخش‌های هستهٔ محاسبات">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
              tab === t.key ? 'bg-brand-800 text-white border-brand-800' : 'bg-surface text-ink-600 border-line hover:border-brand-400'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {/* ================= OVERVIEW ================= */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="تصمیم معماری فاز صفر" icon={Layers}>
            <ul className="text-[11px] text-ink-600 leading-relaxed flex flex-col gap-2 list-disc pr-4">
              <li><b>kernel = مرجع رسمی محاسبات</b>؛ TypeScript فقط لایهٔ API، orchestration محصول و نمایش است.</li>
              <li>مرز سرویس: <b>HTTP دابت (stdlib Python)</b> — بدون وابستگی خارجی؛ ارتقا به FastAPI مستقل در میان‌مدت.</li>
              <li>نسخه‌گذاری واحد: رجیسترها + methodology + calculation در <b>کلید بازتولیدپذیری</b> تجمیع می‌شوند.</li>
              <li>انتشار عدد فقط پس از عبور از <b>Publish Gate</b> — بدون استثنا.</li>
            </ul>
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-[11px] text-brand-900 leading-relaxed">
              جریان: منابع داده ← Ingestion/Validation/Provenance ← GIS ← موتور محاسبه (۱۶ مرحله) ← اطمینان ← گلوگاه ← نتیجهٔ قابل انتشار
            </div>
          </Section>

          <Section title="نسخه‌ها و کالیبراسیون" icon={GitCommitVertical}>
            <KV k="نسخهٔ شاخص‌ها" v={meta?.indicator_version ?? '—'} />
            <KV k="متدولوژی" v={meta?.methodology_version ?? '—'} />
            <KV k="مجموعه وزن (W)" v={<>{meta?.weight_set?.version ?? '—'} {meta?.weight_set?.calibrated ? <StatusPill label="کالیبره" className="bg-emerald-100 text-emerald-800 border-emerald-200" /> : <StatusPill label="کالیبره نشده" className="bg-amber-100 text-amber-800 border-amber-200" />}</>} mono={false} />
            <KV k="آستانه‌ها (T)" v={<>{meta?.threshold_set?.version ?? '—'} {meta?.threshold_set?.calibrated ? <StatusPill label="کالیبره" className="bg-emerald-100 text-emerald-800 border-emerald-200" /> : <StatusPill label="کالیبره نشده" className="bg-amber-100 text-amber-800 border-amber-200" />}</>} mono={false} />
            <KV k="نسخه‌های محاسبه (append-only)" v={(meta?.calculation_versions ?? []).join('، ') || '—'} />
            <p className="text-[10px] text-ink-500 leading-relaxed">
              نسخه‌های قبلی هرگز حذف نمی‌شوند؛ تغییر وزن یا آستانه = تولید نسخهٔ محاسبهٔ جدید با fingerprint متفاوت.
            </p>
          </Section>

          <Section title="وضعیت گیت انتشار" icon={gate?.numeric_publishing_allowed === false ? ShieldAlert : ShieldCheck}>
            <KV k="وزن‌ها کالیبره شده؟" v={gate?.weights_calibrated ? 'بله' : 'خیر'} mono={false} />
            <KV k="آستانه‌ها کالیبره شده؟" v={gate?.thresholds_calibrated ? 'بله' : 'خیر'} mono={false} />
            <KV k="انتشار عدد مجاز؟" v={<b className={gate?.numeric_publishing_allowed ? 'text-emerald-700' : 'text-rose-700'}>{gate?.numeric_publishing_allowed ? 'بله' : 'خیر — بسته'}</b>} mono={false} />
            <KV k="تصمیم گیت پایلوت" v={gate?.pilot_gate_decision ?? '—'} />
            <KV k="شرط‌های گیت پایلوت" v={pilot?.gate_conditions?.length ? `${pilot.gate_conditions.length} شرط` : '—'} mono={false} />
          </Section>

          <Section title="موتور محاسبه — ۱۶ مرحله" icon={SlidersHorizontal}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {stages.map((s, i) => (
                <div key={s} className="rounded-lg border border-line bg-brand-50/50 px-2 py-1.5 text-[10px] font-mono text-brand-900 flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-brand-800 text-white grid place-items-center text-[9px] shrink-0">{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-ink-500">اجرای کامل در زبانهٔ «اجرای محاسبه» با دادهٔ واقعی پایلوت انجام می‌شود.</p>
          </Section>
        </div>
      )}

      {/* ================= API DESIGN ================= */}
      {tab === 'api' && (
        <div className="flex flex-col gap-5">
          <Section title="قرارداد API — سرویس Python و لایهٔ Express" icon={ArrowRightLeft}
            subtitle="مرز سرویس کوتاه‌مدت: HTTP داخلی (stdlib) روی پورت 4105؛ کلاینت Express در server/kernelClient.ts به‌صورت خودکار سرویس را راه‌اندازی می‌کند.">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-ink-500 border-b border-line">
                    <th className="text-right py-2 font-bold">متد</th>
                    <th className="text-right py-2 font-bold">مسیر</th>
                    <th className="text-right py-2 font-bold">شرح</th>
                    <th className="text-right py-2 font-bold">لایه</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ENDPOINTS.map((e) => (
                    <tr key={e.path + e.method} className="border-b border-line/60 hover:bg-brand-50/50">
                      <td className="py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-mono ${e.method === 'GET' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>{e.method}</span>
                      </td>
                      <td className="py-2 font-mono text-brand-900" dir="ltr">{e.path}</td>
                      <td className="py-2 text-ink-600">{e.desc}</td>
                      <td className="py-2">
                        <StatusPill label={e.layer === 'python' ? 'سرویس Python' : 'Express'} className={e.layer === 'python' ? 'bg-brand-100 text-brand-800 border-brand-200' : 'bg-zinc-100 text-zinc-700 border-zinc-200'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title="کدهای خطای استاندارد قرارداد" icon={AlertTriangle}>
              <ul className="text-[11px] font-mono text-ink-700 flex flex-col gap-1.5" dir="ltr">
                {['INVALID_INPUT', 'INSUFFICIENT_COVERAGE', 'PENDING_VALIDATION', 'ACCESS_REQUIRED', 'SOURCE_UNAVAILABLE', 'CALCULATION_BLOCKED'].map((c) => (
                  <li key={c} className="rounded-lg bg-zinc-50 border border-line px-2.5 py-1.5">{c}</li>
                ))}
              </ul>
            </Section>
            <Section title="وضعیت‌های مجاز اندازه‌گیری" icon={Activity}>
              <div className="flex flex-wrap gap-1.5">
                {(['OBSERVED', 'ESTIMATED', 'PROXY', 'MISSING', 'INVALID', 'PENDING_VALIDATION', 'INSUFFICIENT_COVERAGE', 'WAITING_FOR_DATA', 'SOURCE_UNAVAILABLE', 'ACCESS_REQUIRED', 'NOT_APPLICABLE'] as const).map((s) => {
                  const b = statusBadge(s);
                  return <span key={s} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${b.className}`}>{`${s} — ${b.label}`}</span>;
                })}
              </div>
              <p className="text-[10px] text-ink-500 leading-relaxed">
                قاعدهٔ بنیادی: هر وضعیتی غیر از OBSERVED/ESTIMATED/PROXY مقدار عددی None دارد — داده گمشده هرگز صفر نمی‌شود.
              </p>
            </Section>
          </div>
        </div>
      )}

      {/* ================= MAPPING (Phase 1) ================= */}
      {tab === 'mapping' && (
        <div className="flex flex-col gap-5">
          <Section title="نگاشت شاخص‌های TypeScript به رجیستر kernel (فاز یک)"
            icon={ArrowRightLeft}
            subtitle="کدهای تصمیم (H1..R5 در core_40) به کدهای رجیستر مادر ۴۱۹ (PHY/BEH/NOR) با تطبیق سرمایه + عنوان نگاشت می‌شوند. نگاشت‌ناپذیرها صادقانه گزارش می‌شوند — هیچ حدس بی‌منبعی زده نمی‌شود.">
            {mapping && (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-1.5 text-[11px] font-bold text-brand-900">
                  کل: {mapping.summary.total}
                </span>
                <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                  نگاشت‌شده: {mapping.summary.mapped} ({mapping.summary.exact} دقیق + {mapping.summary.keyword} کلیدواژه‌ای)
                </span>
                {mapping.summary.unmapped.length > 0 && (
                  <span className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-800">
                    نگاشت‌نشده: {mapping.summary.unmapped.join('، ')}
                  </span>
                )}
              </div>
            )}
          </Section>

          {mapping && (
            <Section title={`جدول کامل نگاشت (${mapping.rows.length} شاخص)`} icon={Database}
              subtitle="روی هر سطر کلیک کنید تا همان مقدار نمونه از مسیر /api/kernel/analyze در موتور kernel اجرا شود.">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-ink-500 border-b border-line">
                      <th className="text-right py-2 font-bold">کد TS</th>
                      <th className="text-right py-2 font-bold">شاخص</th>
                      <th className="text-right py-2 font-bold">سرمایه</th>
                      <th className="text-right py-2 font-bold">کد kernel</th>
                      <th className="text-right py-2 font-bold">عنوان رجیستر</th>
                      <th className="text-right py-2 font-bold">نوع تطبیق</th>
                      <th className="text-right py-2 font-bold">جریان شاهد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapping.rows.map((row) => (
                      <tr
                        key={row.ts_code}
                        onClick={() => { void runAnalyzeSample(row.ts_code); }}
                        className="border-b border-line/60 hover:bg-brand-50/60 cursor-pointer transition-colors"
                        title="اجرای نمونه از مسیر analyze"
                      >
                        <td className="py-2 font-mono font-bold text-brand-900">{row.ts_code}</td>
                        <td className="py-2 text-ink-700 max-w-[180px] truncate">{row.name}</td>
                        <td className="py-2 text-ink-600 text-[10px]">{row.capital}</td>
                        <td className="py-2 font-mono text-[10px]" dir="ltr">{row.kernel_code ?? '—'}</td>
                        <td className="py-2 text-ink-600 max-w-[220px] truncate text-[10px]">{row.kernel_title ?? '—'}</td>
                        <td className="py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${row.confidence === 'exact' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : row.confidence === 'keyword' ? 'bg-sky-100 text-sky-800 border-sky-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                            {row.confidence === 'exact' ? 'دقیق' : row.confidence === 'keyword' ? 'کلیدواژه‌ای' : 'نگاشت‌نشده'}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1 flex-wrap">
                            {row.evidence_streams.map((s) => (
                              <span key={s} className="rounded bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] font-mono text-zinc-700" dir="ltr">{s}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {analyzing && (
            <Section title="اجرای نمونه analyze"><Loader2 className="animate-spin" size={16} /></Section>
          )}
          {analyze && 'error' in analyze && (
            <Section title="نتیجهٔ analyze">
              <p className="text-[11px] text-rose-700 font-bold">{analyze.error.code}: {analyze.error.message}</p>
            </Section>
          )}
          {analyze && !('error' in analyze) && (
            <Section title="نتیجهٔ اجرای نمونه از مسیر analyze" icon={Cpu}>
              <KV k="fingerprint" v={analyze.fingerprint.slice(0, 27) + '…'} />
              <KV k="نگاشت‌نشده" v={analyze.unmapped_count} mono={false} />
              <KV k="گیت انتشار" v={analyze.can_publish_numeric_scores ? 'باز' : 'بسته (وزن/آستانه کالیبره نشده)'} mono={false} />
              <p className="text-[10px] text-ink-500">محاسبه کاملاً در موتور Python انجام شد؛ TypeScript فقط ورودی را نگاشت کرد.</p>
            </Section>
          )}
        </div>
      )}

      {/* ================= SHADOW (فاز ۳) ================= */}
      {tab === 'shadow' && (
        <div className="flex flex-col gap-5">
          <Section
            title="اجرای سایه — kernel در برابر موتور TypeScript (فاز سه)"
            icon={GitCompareArrows}
            subtitle="مسیر محصول /api/decision-support/analyze نتیجهٔ خود را بدون هیچ تغییری برمی‌گرداند؛ در کنار آن همان ورودی از kernel عبور می‌کند و اختلاف دو موتور ثبت می‌شود. هیچ عددی از سایه وارد پاسخ محصول نمی‌شود."
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                shadow?.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-zinc-100 border-zinc-300 text-zinc-700'
              }`}>
                حالت: {shadow?.mode ?? '—'}{shadow?.enabled ? '' : ' (خاموش)'}
              </span>
              <span className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-1.5 text-[11px] font-bold text-brand-900">
                اجراهای سایه: {shadow?.runtime?.total ?? 0}
              </span>
              <span className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                سلول‌های «فقط TS»: {shadow?.runtime?.ts_only_total ?? 0}
              </span>
              <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                سلول‌های عدد مشترک: {shadow?.runtime?.both_numeric_total ?? 0}
              </span>
              <button
                type="button"
                onClick={() => { void runShadow(); }}
                disabled={shadowBusy}
                className="ms-auto inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
              >
                {shadowBusy ? <Loader2 className="animate-spin" size={14} /> : <GitCompareArrows size={14} />}
                اجرای تحلیل واقعی + سایه
              </button>
            </div>
            <ul className="text-[11px] text-ink-600 leading-relaxed flex flex-col gap-1.5 list-disc pr-4">
              {(shadow?.rules ?? []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Section>

          {shadowError && (
            <Section title="اجرای سایه ناموفق بود" icon={XCircle}>
              <p className="text-[11px] font-bold text-rose-700">{shadowError}</p>
            </Section>
          )}

          {shadowReport && (
            <>
              <Section title="خلاصهٔ مقایسه" icon={Activity} subtitle={shadowReport.headline}>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                    عدد مشترک: {shadowReport.summary.both_numeric}
                  </span>
                  <span className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                    فقط TS: {shadowReport.summary.ts_only}
                  </span>
                  <span className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 text-[11px] font-bold text-sky-800">
                    فقط kernel: {shadowReport.summary.kernel_only}
                  </span>
                  <span className="rounded-lg bg-zinc-100 border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700">
                    خودداری مشترک: {shadowReport.summary.both_abstain}
                  </span>
                  <span className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-1.5 text-[11px] font-bold text-zinc-700">
                    بیشترین اختلاف: {shadowReport.summary.max_abs_delta ?? '—'}
                  </span>
                </div>
                {shadowReport.status === 'error' && (
                  <p className="text-[11px] font-bold text-rose-700">{shadowReport.error}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <div>
                    <KV k="شناسهٔ اجرای محصول" v={shadowReport.ts_run_id} />
                    <KV k="شناسهٔ اجرای kernel" v={shadowReport.kernel_run_id ?? '—'} />
                    <KV k="fingerprint" v={shadowReport.kernel_fingerprint ? `${shadowReport.kernel_fingerprint.slice(0, 27)}…` : '—'} />
                    <KV k="نسخهٔ محاسبه" v={shadowReport.kernel_calculation_version ?? '—'} />
                  </div>
                  <div>
                    <KV k="رکورد ارسالی به kernel" v={shadowReport.records_sent} />
                    <KV k="نگاشت‌شده / نگاشت‌نشده" v={`${shadowReport.mapped} / ${shadowReport.unmapped.length}`} />
                    <KV k="گیت انتشار kernel" v={shadowReport.kernel_gate_open ? 'باز' : 'بسته'} mono={false} />
                    <KV k="مدت اجرای سایه" v={`${shadowReport.duration_ms} ms`} />
                  </div>
                </div>
                {shadowReport.unmapped.length > 0 && (
                  <p className="text-[10px] text-rose-700 font-bold">
                    نگاشت‌نشده: {shadowReport.unmapped.join('، ')}
                  </p>
                )}
              </Section>

              {shadowReport.divergences.length > 0 && (
                <Section title="واگرایی‌ها" icon={ShieldAlert}>
                  <ul className="text-[11px] text-ink-700 leading-relaxed flex flex-col gap-1.5 list-disc pr-4">
                    {shadowReport.divergences.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </Section>
              )}

              <Section
                title={`سلول‌های مقایسه (${shadowReport.cells.length})`}
                icon={GitCompareArrows}
                subtitle="عدد گمشده هرگز صفر نمایش داده نمی‌شود — جای آن وضعیت موتور و badge حکم می‌آید."
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-ink-500 border-b border-line">
                        <th className="text-right py-2 font-bold">بُعد</th>
                        <th className="text-right py-2 font-bold">مؤلفه</th>
                        <th className="text-right py-2 font-bold">موتور TS</th>
                        <th className="text-right py-2 font-bold">وضعیت kernel</th>
                        <th className="text-right py-2 font-bold">kernel</th>
                        <th className="text-right py-2 font-bold">delta</th>
                        <th className="text-right py-2 font-bold">حکم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shadowReport.cells.map((c) => {
                        const v = SHADOW_VERDICT_META[c.verdict] ?? SHADOW_VERDICT_META.not_comparable;
                        return (
                          <tr key={`${c.dimension}:${c.key}`} className="border-b border-line/60" title={c.note}>
                            <td className="py-2 text-ink-500 text-[10px]">{SHADOW_DIMENSION_FA[c.dimension] ?? c.dimension}</td>
                            <td className="py-2 font-bold text-ink-800">
                              {c.label}
                              {c.ts_source === 'derived' && (
                                <span className="ms-1 rounded bg-violet-100 border border-violet-200 px-1 py-0.5 text-[9px] text-violet-800">مشتق</span>
                              )}
                            </td>
                            <td className="py-2 font-mono text-ink-700">{c.ts_value ?? '—'}</td>
                            <td className="py-2">
                              <span className="rounded bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] font-mono text-zinc-700" dir="ltr">{c.kernel_status}</span>
                            </td>
                            <td className="py-2 font-mono text-ink-700">{c.kernel_value ?? '—'}</td>
                            <td className={`py-2 font-mono ${c.delta === null ? 'text-ink-400' : c.delta < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {c.delta === null ? '—' : c.delta}
                            </td>
                            <td className="py-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${v.className}`}>{v.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              {shadowReport.bottleneck_comparison && (
                <Section title="مقایسهٔ گلوگاه (غیرعددی)" icon={ShieldAlert}>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const a = SHADOW_AGREEMENT_FA[shadowReport.bottleneck_comparison.agreement] ?? SHADOW_AGREEMENT_FA.not_comparable;
                      return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${a.className}`}>{a.label}</span>;
                    })()}
                  </div>
                  <KV
                    k="گلوگاه TS"
                    v={shadowReport.bottleneck_comparison.ts
                      ? `سرمایهٔ ${shadowReport.bottleneck_comparison.ts.capital} · گذار ${shadowReport.bottleneck_comparison.ts.transition.join('→')} · ${shadowReport.bottleneck_comparison.ts.location}`
                      : '—'}
                  />
                  <KV k="وضعیت kernel" v={shadowReport.bottleneck_comparison.kernel_status} />
                  <KV k="گلوگاه kernel" v={shadowReport.bottleneck_comparison.kernel_primary ?? '— (خودداری)'} />
                  <p className="text-[10px] text-ink-500 leading-relaxed">{shadowReport.bottleneck_comparison.note}</p>
                </Section>
              )}
            </>
          )}

          {(shadow?.reports?.length ?? 0) > 0 && (
            <Section title={`اجراهای سایهٔ ثبت‌شده (${shadow?.reports?.length ?? 0})`} icon={Database}
              subtitle="گزارش‌های گذشته در حافظهٔ سرویس نگه داشته می‌شوند؛ هر گزارش به یک اجرای محصول گره خورده است.">
              <div className="flex flex-col gap-2">
                {shadow?.reports?.map((r) => (
                  <div key={r.ts_run_id} className="rounded-xl border border-line bg-surface-muted/40 p-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                      {r.status === 'completed' ? 'کامل' : 'خطا'}
                    </span>
                    <span className="text-[11px] font-bold text-ink-800">{r.neighborhood}</span>
                    <span className="font-mono text-[10px] text-ink-500" dir="ltr">{r.ts_run_id}</span>
                    <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">فقط TS: {r.summary.ts_only}</span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">مشترک: {r.summary.both_numeric}</span>
                    <span className="text-[10px] text-ink-500 ms-auto">{r.headline}</span>
                    <a
                      href={`/api/decision-support/shadow/${encodeURIComponent(r.ts_run_id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-brand-700 underline"
                    >JSON</a>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ================= PILOT ================= */}
      {tab === 'pilot' && (
        <div className="flex flex-col gap-5">
          {!pilot && (loading ? <Section title="پایلوت"><Loader2 className="animate-spin" size={16} /></Section> : (
            <Section title="پایلوت"><p className="text-xs text-ink-500">اطلاعات پایلوت در دسترس نیست.</p></Section>
          ))}
          {pilot && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Section title="تصمیم گیت" icon={BadgeCheck}>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex flex-col gap-1">
                    <span className="font-mono text-sm font-bold text-amber-800">{pilot.gate_decision ?? '—'}</span>
                    <span className="text-[10px] text-amber-700">عبور ساختاری موتور ≠ اعتبار تجربی وزن/آستانه/جهت</span>
                  </div>
                  <ul className="text-[11px] text-ink-600 leading-relaxed flex flex-col gap-1.5 list-disc pr-4">
                    {pilot.gate_conditions.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </Section>
                <Section title="پوشش داده (واقعی)" icon={Database}>
                  {(() => {
                    const dc = (pilot.coverage?.data_coverage ?? {}) as Record<string, any>;
                    return (
                      <>
                        <KV k="کل شاخص‌های رجیستر" v={dc.total_registry_indicators ?? '—'} />
                        <KV k="شاخص با دادهٔ واقعی" v={dc.distinct_indicators_with_real_data ?? '—'} />
                        <KV k="اندازه‌گیری دریافت‌شده" v={dc.measurements_acquired ?? '—'} />
                        <KV k="نیازمند دسترسی" v={dc.access_required ?? '—'} />
                        <KV k="نمرهٔ استاندارد معتبر" v={dc.indicators_with_valid_standardized_score ?? '—'} />
                        <p className="text-[10px] text-ink-500 leading-relaxed">{String(dc.note ?? '')}</p>
                      </>
                    );
                  })()}
                </Section>
                <Section title="پوشش شواهد" icon={Boxes}>
                  {(() => {
                    const ec = (pilot.coverage?.evidence_coverage ?? {}) as Record<string, any>;
                    return (
                      <>
                        <KV k="مقادیر ارزیابی‌شده" v={ec.values_assessed ?? '—'} />
                        <KV k="مقادیر پروکسی" v={ec.proxy_values ?? '—'} />
                        <KV k="چندجریانی" v={ec.multi_stream_values ?? '—'} />
                        <KV k="سطح‌های اطمینان" v={JSON.stringify(ec.level_counts ?? {})} />
                        <p className="text-[10px] text-ink-500 leading-relaxed">{String(ec.note ?? '')}</p>
                      </>
                    );
                  })()}
                </Section>
              </div>

              <Section title="آزمون‌های قراردادی (اجرای واقعی)" icon={BadgeCheck}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {Object.entries(pilot.test_suites ?? {}).map(([name, r]) => {
                      const suite = r as { passed: boolean; line: string };
                      return (
                    <div key={name} className={`rounded-xl border p-3 flex flex-col gap-1 ${suite.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <span className="text-[10px] font-mono text-ink-600 break-all" dir="ltr">{name.split('/').pop()}</span>
                      <span className={`text-xs font-bold font-mono ${suite.passed ? 'text-emerald-700' : 'text-rose-700'}`}>{suite.line}</span>
                    </div>
                      );
                    })}
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      {/* ================= RUN ================= */}
      {tab === 'run' && (
        <div className="flex flex-col gap-5">
          <Section title="اجرای زندهٔ موتور kernel روی دادهٔ واقعی پایلوت" icon={Cpu}
            subtitle="این اجرا همان ۱۶ مرحله + اطمینان + گلوگاه را روی ۷ مقدار واقعی دریافت‌شدهٔ پایلوت منطقه ۶ اجرا می‌کند.">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => void executeRun()}
                disabled={running || !connected}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-800 text-white px-4 py-2 text-xs font-bold hover:bg-brand-900 disabled:opacity-50 transition-colors"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                {running ? 'در حال اجرا…' : 'اجرای محاسبه'}
              </button>
              {runError && <span className="text-[11px] text-rose-700 font-bold">خطا: {runError}</span>}
              {run && !runError && (
                <span className="text-[11px] text-ink-500 font-mono" dir="ltr">
                  run: {run.run_id} · fp: {run.fingerprint.slice(0, 19)}…
                </span>
              )}
            </div>
          </Section>

          {run && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Section title="بازتولیدپذیری" icon={GitCommitVertical}>
                  <KV k="fingerprint" v={run.fingerprint.slice(0, 27) + '…'} />
                  <KV k="نسخهٔ محاسبه" v={run.calculation_version_id} />
                  <KV k="data_version" v={run.reproducibility_key.data_version} />
                  <KV k="W / T" v={`${run.reproducibility_key.weight_set} / ${run.reproducibility_key.threshold_set}`} />
                  <div className={`rounded-lg border p-2.5 text-[11px] flex items-center gap-2 ${run.shadow_comparison.matched ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    <GitCompareArrows size={14} />
                    Shadow mode: {run.shadow_comparison.matched ? 'مطابقت کامل با artifact پایلوت (بایت‌یکسان)' : 'عدم مطابقت با پایلوت!'}
                  </div>
                </Section>
                <Section title="گیت انتشار این اجرا" icon={gate?.numeric_publishing_allowed === false ? Lock : ShieldCheck}>
                  <KV k="انتشار عدد مجاز؟" v={<b className={run.can_publish_numeric_scores ? 'text-emerald-700' : 'text-rose-700'}>{run.can_publish_numeric_scores ? 'بله' : 'خیر'}</b>} mono={false} />
                  <ul className="text-[10px] text-ink-600 leading-relaxed flex flex-col gap-1 list-disc pr-4">
                    {run.publish_gate.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </Section>
                <Section title="توزیع وضعیت شاخص‌ها" icon={Layers}>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(statusCounts).map(([s, n]) => {
                      const b = statusBadge(s);
                      return <span key={s} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${b.className}`}>{`${b.label}: ${n}`}</span>;
                    })}
                  </div>
                  <p className="text-[10px] text-ink-500">هیچ وضعیت غیرعددی صفر نمایش داده نمی‌شود — فقط badge وضعیت.</p>
                </Section>
              </div>

              <Section title={`شاخص‌های اجرا (${indicators.length})`} icon={Database}
                subtitle="روی هر شاخص کلیک کنید تا drill-down کامل منشأ در زبانهٔ «Drill-down منشأ» باز شود.">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-ink-500 border-b border-line">
                        <th className="text-right py-2 font-bold">کد</th>
                        <th className="text-right py-2 font-bold">عنوان</th>
                        <th className="text-right py-2 font-bold">مقدار خام</th>
                        <th className="text-right py-2 font-bold">واحد</th>
                        <th className="text-right py-2 font-bold">وضعیت نمره</th>
                        <th className="text-right py-2 font-bold">اطمینان</th>
                        <th className="text-right py-2 font-bold">سرمایه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.map((p) => {
                        const b = statusBadge(p.normalized.status);
                        return (
                          <tr
                            key={p.raw.provenance_value_id}
                            onClick={() => { setSelectedVid(p.raw.provenance_value_id); setTab('drilldown'); }}
                            className="border-b border-line/60 hover:bg-brand-50/60 cursor-pointer transition-colors"
                          >
                            <td className="py-2 font-mono font-bold text-brand-900">{p.indicator_code}</td>
                            <td className="py-2 text-ink-700 max-w-[220px] truncate" title={p.title}>{p.title}</td>
                            <td className="py-2 font-mono">{p.raw.value ?? '—'}</td>
                            <td className="py-2 font-mono">{p.raw.unit ?? '—'}</td>
                            <td className="py-2">
                              <StatusPill label={b.label} className={b.className} />
                              {p.normalized.value === null && p.raw.value !== null && (
                                <span className="text-[10px] text-ink-500 mr-1">(مقدار خام حفظ شد — صفر نشد)</span>
                              )}
                            </td>
                            <td className="py-2">
                              {p.confidence ? (
                                <span className={`font-bold ${CONFIDENCE_COLORS[p.confidence.level] ?? ''}`}>
                                  {p.confidence.level} <span className="text-ink-400 font-mono text-[10px]">({p.confidence.score?.toFixed(2)})</span>
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-2 text-ink-600">{p.capital_name} <span className="font-mono text-[10px]">({p.capital_code})</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title={`تخلف‌ها — چرا عدد منتشر نشد (${run.abstentions.length})`} icon={AlertTriangle}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {run.abstentions.map((a, i) => (
                    <div key={i} className="rounded-xl border border-line bg-zinc-50/60 p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill label={a.status} className="bg-orange-100 text-orange-800 border-orange-200" />
                        <span className="text-[11px] font-bold text-ink-800 font-mono" dir="ltr">{a.field}</span>
                      </div>
                      {a.reason && <p className="text-[10px] text-ink-600 leading-relaxed">{a.reason}</p>}
                      <p className="text-[10px] text-emerald-800"><b>رفع مانع:</b> {a.unblocks}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      {/* ================= DRILLDOWN ================= */}
      {tab === 'drilldown' && (
        <div className="flex flex-col gap-5">
          {!run && (
            <Section title="Drill-down منشأ">
              <p className="text-xs text-ink-500">ابتدا در زبانهٔ «اجرای محاسبه» یک اجرا انجام دهید تا زنجیرهٔ منشأ قابل مشاهده شود.</p>
            </Section>
          )}
          {run && (
            <>
              <Section title="انتخاب مقدار" icon={FileSearch}>
                <div className="flex flex-wrap gap-1.5">
                  {indicators.map((p) => (
                    <button
                      key={p.raw.provenance_value_id}
                      onClick={() => setSelectedVid(p.raw.provenance_value_id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-mono font-bold transition-colors ${
                        selectedVid === p.raw.provenance_value_id ? 'bg-brand-800 text-white border-brand-800' : 'bg-surface border-line text-ink-600 hover:border-brand-400'}`}
                    >
                      {p.raw.provenance_value_id} · {p.indicator_code}
                    </button>
                  ))}
                </div>
              </Section>

              {selectedRecord && selectedDD && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Section title={`زنجیرهٔ ده‌لایهٔ منشأ — ${selectedVid}`} icon={GitCommitVertical}>
                    <ol className="flex flex-col gap-2">
                      {[
                        ['۱. نتیجه', `${selectedDD.result.indicator_code}: ${selectedDD.result.raw_value ?? '—'} ${selectedDD.result.raw_unit ?? ''}`, selectedDD.result.standardized_status],
                        ['۲. شاخص', selectedDD.indicator.title, selectedRecord.capital_code],
                        ['۳. فرمول', String(selectedDD.formula ?? '—'), null],
                        ['۴. مقدار خام', `${selectedDD.raw_value ?? '—'} ${selectedDD.unit ?? ''}`, null],
                        ['۵. منبع', `${selectedDD.source.source_name ?? '—'} / ${selectedDD.source.provider ?? '—'}`, selectedDD.source.source_id ?? null],
                        ['۶. درخواست/API', String(selectedDD.request_api.url_api ?? '—'), null],
                        ['۷. فایل/رکورد', `${selectedDD.file_record.raw_file_ref ?? '—'} · hash: ${String(selectedDD.file_record.raw_file_hash ?? '—').slice(0, 19)}…`, null],
                        ['۸. تاریخ', String(selectedDD.date ?? '—'), null],
                        ['۹. پردازش', `${selectedDD.processing.processing_version ?? '—'} · CRS: ${selectedDD.processing.crs ?? '—'}`, null],
                        ['۱۰. QC', `score: ${selectedDD.qc.quality_score ?? '—'} · checks: ${selectedDD.qc.quality_checks.length}`, null],
                      ].map(([label, value, pill]) => (
                        <li key={String(label)} className="rounded-xl border border-line bg-brand-50/40 px-3 py-2 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-brand-800">{label as string}</span>
                            {pill && <span className="text-[9px] font-mono text-ink-500" dir="ltr">{String(pill)}</span>}
                          </div>
                          <span className="text-[11px] text-ink-700 break-all" dir="ltr">{value as string}</span>
                        </li>
                      ))}
                    </ol>
                  </Section>

                  <div className="flex flex-col gap-5">
                    <Section title="مقادیر استانداردشده و دلیل عدم انتشار" icon={ShieldAlert}>
                      <KV k="وضعیت نمرهٔ استاندارد" v={(() => { const b = statusBadge(selectedDD.result.standardized_status); return <StatusPill label={b.label} className={b.className} />; })()} mono={false} />
                      <KV k="مقدار خام حفظ‌شده" v={`${selectedDD.result.raw_value ?? '—'} ${selectedDD.result.raw_unit ?? ''}`} />
                      {selectedDD.result.standardized_reason && (
                        <p className="text-[10px] text-ink-600 leading-relaxed rounded-lg bg-orange-50 border border-orange-200 p-2.5">{selectedDD.result.standardized_reason}</p>
                      )}
                    </Section>
                    <Section title="اطمینان چندعاملی (۷ عامل)" icon={Activity}>
                      {selectedDD.confidence?.factors ? (
                        <div className="flex flex-col gap-1.5">
                          {Object.entries(selectedDD.confidence.factors).map(([k, f]) => (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-ink-600 w-32 shrink-0" dir="ltr">{k}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                                <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round(((f as { score?: number }).score ?? 0) * 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-ink-700 w-10 text-left">{(((f as { score?: number }).score ?? 0)).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[11px] font-bold text-ink-700">سطح نهایی:</span>
                            <span className={`text-sm font-bold ${CONFIDENCE_COLORS[selectedDD.confidence.level] ?? ''}`}>{selectedDD.confidence.level}</span>
                            <span className="text-[10px] font-mono text-ink-500">({selectedDD.confidence.score?.toFixed(3)})</span>
                          </div>
                          {selectedDD.confidence.reason && <p className="text-[10px] text-ink-500 leading-relaxed">{selectedDD.confidence.reason}</p>}
                        </div>
                      ) : <p className="text-[11px] text-ink-500">عاملی ثبت نشده است.</p>}
                    </Section>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
