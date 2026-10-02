import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { apiUrl } from '../algorithm/realDataConnectors';

interface RegistrySummary {
  version: string;
  source_file: string;
  plan_file: string | null;
  indicator_count: number;
  core_indicator_count: number;
  by_engine: Record<string, number>;
  by_automation_class: Record<string, number>;
  by_allowed_output: Record<string, number>;
  by_phase: Record<string, number>;
  without_field_survey: Record<string, number>;
}

interface RegistryMetadata {
  version: string;
  indicator_count: number;
  core_indicator_count: number;
  source_file: string;
  plan_file: string | null;
}

interface RegistryRow {
  code: string;
  name: string;
  engine: string;
  family: string;
  capitalKey: string | null;
  legacyCode: string | null;
  isCore: boolean;
  direction: string;
  phase: string;
  automationClass: string;
  allowedOutput: string;
  sourceMethod: string;
  spatialLevel: string;
  equityBreakdown: string;
  usableWithoutFieldSurvey: string;
  currentGap: string;
  nextAction: string;
}

const CAPITAL_FA: Record<string, string> = {
  H: 'انسانی', S: 'اجتماعی', E: 'اقتصادی', P: 'کالبدی', N: 'طبیعی', C: 'فرهنگی', G: 'نهادی', R: 'شبکه‌ای',
};

const ENGINE_OPTIONS = ['سنجش', 'تشخیص', 'تجویز', 'یادگیری'];
const PHASE_OPTIONS = ['P0', 'P1', 'P2', 'P3'];

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
      <h4 className="text-[10px] font-black text-brand-800 dark:text-signal-400">{title}</h4>
      <div className="mt-2 space-y-1.5">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-[10px]">
            <span className="truncate font-bold text-ink-500 dark:text-slate-400" dir="ltr">{key}</span>
            <span className="shrink-0 font-mono font-black text-ink-800 dark:text-slate-200">{count.toLocaleString('fa-IR')}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function DecisionRegistryView({ measuredCodes = [] }: { measuredCodes?: string[] }) {
  const measuredSet = useMemo(() => new Set(measuredCodes), [measuredCodes]);
  const [summary, setSummary] = useState<RegistrySummary | null>(null);
  const [metadata, setMetadata] = useState<RegistryMetadata | null>(null);
  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [engline, setEngine] = useState('');
  const [phase, setPhase] = useState('');
  const [coreOnly, setCoreOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/decision-support/registry'), { headers: { Accept: 'application/json' } });
        const payload = await res.json() as { success?: boolean; data?: { summary: RegistrySummary; metadata: RegistryMetadata }; error?: { message?: string } };
        if (cancelled) return;
        if (!res.ok || !payload.data) throw new Error(payload.error?.message || `دریافت رجیستر با کد ${res.status} ناموفق بود.`);
        setSummary(payload.data.summary);
        setMetadata(payload.data.metadata);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خطای ناشناخته در دریافت رجیستر');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (engline) params.set('engine', engline);
      if (phase) params.set('phase', phase);
      if (coreOnly) params.set('core', 'true');
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(apiUrl(`/api/decision-support/registry/indicators?${params.toString()}`), { headers: { Accept: 'application/json' } });
      const payload = await res.json() as { data?: { rows: RegistryRow[] }; error?: { message?: string } };
      if (!res.ok || !payload.data) throw new Error(payload.error?.message || `دریافت شاخص‌ها با کد ${res.status} ناموفق بود.`);
      setRows(payload.data.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته در دریافت شاخص‌ها');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [coreOnly, engline, phase, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRows(); }, 250);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  const coreCovered = useMemo(
    () => rows.filter((row) => row.isCore && row.legacyCode && measuredSet.has(row.legacyCode)).length,
    [rows, measuredSet],
  );
  const coreShown = rows.filter((row) => row.isCore).length;
  const total = summary?.indicator_count ?? metadata?.indicator_count ?? 0;
  const coreCount = summary?.core_indicator_count ?? metadata?.core_indicator_count ?? 0;
  const versionShort = useMemo(() => (summary?.version ?? '').replace(/^sha256:/, '').slice(0, 12), [summary]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="icon-tile"><Database size={17} /></div>
          <div>
            <h3 className="text-base font-black text-ink-900 dark:text-white">رجیستر کنترل‌شده ۱۶۴ شاخصی</h3>
            <p className="mt-1 text-[11px] font-medium leading-5 text-ink-500 dark:text-slate-400">
              تنها measurement معتبر روی این رجیستر به امتیاز تبدیل می‌شود؛ داده گمشده هرگز صفر نمی‌شود و شاخص ادراکی با پروکسی جایگزین نمی‌گردد.
            </p>
            {measuredCodes.length > 0 && coreShown > 0 && (
              <p className="mt-1.5 text-[10px] font-black text-brand-800 dark:text-signal-400">
                تحلیل جاری {coreCovered.toLocaleString('fa-IR')} از {coreShown.toLocaleString('fa-IR')} شاخص هستهٔ نمایش‌داده‌شده را اندازه‌گیری کرده است.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-3 py-2 text-[10px] font-black text-brand-800 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-800/10 dark:border-wall-700 dark:bg-wall-800 dark:text-signal-400"
        >
          <RefreshCw size={14} /> بازخوانی
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
          <div className="text-[9px] font-black text-ink-400 dark:text-slate-500">کل شاخص‌ها</div>
          <div className="mt-1 text-2xl font-black tabular-nums text-ink-900 dark:text-white">{total.toLocaleString('fa-IR')}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
          <div className="text-[9px] font-black text-ink-400 dark:text-slate-500">شاخص‌های هسته (۴۰ شاخص الگوریتم)</div>
          <div className="mt-1 text-2xl font-black tabular-nums text-ink-900 dark:text-white">{coreCount.toLocaleString('fa-IR')}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
          <div className="text-[9px] font-black text-ink-400 dark:text-slate-500">نسخه رجیستر (SHA-256)</div>
          <div className="mt-1 truncate font-mono text-sm font-black text-ink-800 dark:text-slate-200" dir="ltr">{versionShort || '—'}</div>
        </div>
      </section>

      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Breakdown title="به تفکیک موتور" values={summary.by_engine} />
          <Breakdown title="کلاس اتوماسیون" values={summary.by_automation_class} />
          <Breakdown title="سطح خروجی مجاز" values={summary.by_allowed_output} />
          <Breakdown title="فاز پیشنهادی" values={summary.by_phase} />
          <Breakdown title="قابل استفاده بدون پیمایش حضوری" values={summary.without_field_survey} />
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-40 flex-1">
            <span className="mb-1.5 block text-[10px] font-bold text-ink-500 dark:text-slate-400">جستجو در کد، نام و خانواده</span>
            <span className="relative block">
              <Search size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="مثال: بیکاری"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 pr-8 text-xs font-semibold text-ink-800 outline-none focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-800/10 dark:border-wall-700 dark:bg-wall-850 dark:text-slate-200"
              />
            </span>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold text-ink-500 dark:text-slate-400">موتور</span>
            <select
              value={engline}
              onChange={(event) => setEngine(event.target.value)}
              className="rounded-xl border border-line bg-paper px-3 py-2 text-xs font-bold text-ink-800 dark:border-wall-700 dark:bg-wall-850 dark:text-slate-200"
            >
              <option value="">همه</option>
              {ENGINE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold text-ink-500 dark:text-slate-400">فاز</span>
            <select
              value={phase}
              onChange={(event) => setPhase(event.target.value)}
              className="rounded-xl border border-line bg-paper px-3 py-2 text-xs font-bold text-ink-800 dark:border-wall-700 dark:bg-wall-850 dark:text-slate-200"
            >
              <option value="">همه</option>
              {PHASE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[11px] font-bold text-ink-600 dark:border-wall-700 dark:bg-wall-850 dark:text-slate-300">
            <input type="checkbox" checked={coreOnly} onChange={(event) => setCoreOnly(event.target.checked)} className="size-4 accent-brand-800" />
            فقط هسته
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-ink-400 dark:text-slate-500">
          {loading ? <><Loader2 size={12} className="animate-spin" /> در حال بارگذاری…</> : <>{rows.length.toLocaleString('fa-IR')} شاخص مطابق فیلتر</>}
        </div>

        {error && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-[11px] font-bold text-danger-700 dark:bg-danger/10 dark:text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {!error && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line dark:border-wall-700">
            <table className="w-full min-w-[860px] text-right text-[10px]">
              <thead>
                <tr className="border-b border-line bg-paper text-ink-500 dark:border-wall-700 dark:bg-wall-850 dark:text-slate-400">
                  <th className="px-3 py-2 font-black">کد</th>
                  <th className="px-3 py-2 font-black">نام شاخص</th>
                  <th className="px-3 py-2 font-black">موتور</th>
                  <th className="px-3 py-2 font-black">سرمایه</th>
                  <th className="px-3 py-2 font-black">فاز</th>
                  <th className="px-3 py-2 font-black">سطح خروجی مجاز</th>
                  <th className="px-3 py-2 font-black">تحلیل جاری</th>
                  <th className="px-3 py-2 font-black">منبع/روش</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code} className="border-b border-line/60 last:border-0 dark:border-wall-700/50">
                    <td className="px-3 py-2 font-mono font-black text-ink-800 dark:text-slate-200" dir="ltr">
                      {row.isCore && <ShieldCheck size={11} className="mb-0.5 mr-1 inline text-ok" aria-label="شاخص هسته" />}
                      {row.legacyCode ?? row.code}
                    </td>
                    <td className="px-3 py-2 font-bold text-ink-700 dark:text-slate-300">{row.name}</td>
                    <td className="px-3 py-2 font-bold text-ink-500 dark:text-slate-400">{row.engine}</td>
                    <td className="px-3 py-2 font-bold text-ink-500 dark:text-slate-400">{row.capitalKey ? (CAPITAL_FA[row.capitalKey] ?? row.capitalKey) : '—'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-ink-500 dark:text-slate-400" dir="ltr">{row.phase}</td>
                    <td className="px-3 py-2 font-mono text-[9px] font-bold text-ink-500 dark:text-slate-400" dir="ltr">{row.allowedOutput}</td>
                    <td className="px-3 py-2">
                      {row.isCore && row.legacyCode
                        ? (measuredSet.has(row.legacyCode)
                            ? <span className="rounded-md border border-ok/30 bg-ok-soft px-1.5 py-0.5 text-[9px] font-black text-ok-700 dark:bg-ok/10 dark:text-ok">اندازه‌گیری‌شده</span>
                            : <span className="rounded-md border border-warn/30 bg-warn-soft px-1.5 py-0.5 text-[9px] font-black text-warn-700 dark:bg-warn/10 dark:text-warn">کمبود داده</span>)
                        : <span className="text-[9px] text-ink-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-ink-400 dark:text-slate-500">{row.sourceMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
