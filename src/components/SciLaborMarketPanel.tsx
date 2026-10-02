// ============================================================
// پنل «بازار کار» — بر پایهٔ دادهٔ خام آمارگیری نیروی کار (LFS)
// که توسط backend سینک (server/ + scripts/sync_lfs.ps1) از فایل‌های
// سنگین mdb پردازش و از طریق /api/sci به برنامه داده می‌شود.
// سال‌های واقعی: ۱۳۸۴، ۱۳۹۶، ۱۳۹۹ (وزن‌گذاری IW).
// اگر سرور در دسترس نباشد، وضعیت آفلاین نمایش داده می‌شود.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Server, WifiOff, ArrowDownUp } from 'lucide-react';
import {
  getLfsBreakdown,
  getLfsSummary,
  getLfsTimeseries,
  getLfsYears,
  LfsBreakdownRow,
  LfsSummaryRow,
  LfsYearInfo,
} from '../lib/sciApi';

const faNum = (n: number | undefined | null): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('fa-IR');
};

const fmtRate = (n: number | null | undefined): string => (n == null ? '—' : `${n.toFixed(1)}٪`);

export default function SciLaborMarketPanel() {
  const [years, setYears] = useState<LfsYearInfo[] | null>(null);
  const [year, setYear] = useState<number>(1399);
  const [summary, setSummary] = useState<LfsSummaryRow[] | null>(null);
  const [province, setProvince] = useState<string>('23');
  const [sexRows, setSexRows] = useState<LfsBreakdownRow[] | null>(null);
  const [ageRows, setAgeRows] = useState<LfsBreakdownRow[] | null>(null);
  const [trend, setTrend] = useState<{ year: number; unemploymentRate: number | null }[] | null>(null);
  const [offline, setOffline] = useState(false);

  // بارگذاری سال‌ها + سری زمانی + خلاصهٔ ملی
  useEffect(() => {
    let alive = true;
    (async () => {
      const [ys, ts] = await Promise.all([getLfsYears(), getLfsTimeseries()]);
      if (!alive) return;
      if (!ys || !ts) {
        setOffline(true);
        return;
      }
      setYears(ys);
      setTrend(ts.rows.map((r) => ({ year: r.year, unemploymentRate: r.unemploymentRate })));
      const latest = ys[ys.length - 1];
      if (latest) setYear(latest.year);
    })();
    return () => { alive = false; };
  }, []);

  // خلاصهٔ استانی برای سال انتخاب‌شده
  useEffect(() => {
    if (year === 0) return;
    let alive = true;
    (async () => {
      const rows = await getLfsSummary(year);
      if (!alive || !rows) return;
      setSummary(rows);
    })();
    return () => { alive = false; };
  }, [year]);

  // تفکیک جنس و سن برای استان انتخاب‌شده
  useEffect(() => {
    if (year === 0) return;
    let alive = true;
    (async () => {
      const [s, a] = await Promise.all([
        getLfsBreakdown(year, 'sex', province),
        getLfsBreakdown(year, 'age', province),
      ]);
      if (!alive) return;
      setSexRows(s?.rows ?? null);
      setAgeRows(a?.rows ?? null);
    })();
    return () => { alive = false; };
  }, [year, province]);

  const national = useMemo<LfsSummaryRow | undefined>(
    () => summary?.reduce((acc, r) => ({
      year: r.year,
      province: 'IR',
      alpha: '',
      fa: 'ایران',
      employed: acc.employed + r.employed,
      unemployed: acc.unemployed + r.unemployed,
      inactive: acc.inactive + r.inactive,
      laborForce: acc.laborForce + r.laborForce,
      pop15: acc.pop15 + r.pop15,
      popAll: acc.popAll + r.popAll,
      unemploymentRate: null,
      participationRate: null,
      unknown: acc.unknown + r.unknown,
    }), { year, province: 'IR', alpha: '', fa: 'ایران', employed: 0, unemployed: 0, inactive: 0, laborForce: 0, pop15: 0, popAll: 0, unemploymentRate: null, participationRate: null, unknown: 0 } as LfsSummaryRow),
    [summary, year],
  );

  if (offline) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-5 flex items-start gap-3 text-xs text-ink-500">
        <WifiOff size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-bold text-ink-700">بازار کار — آمارگیری نیروی کار</span>
          <span>سرور سینک مرکز آمار در دسترس نیست (npm run sci:server). دادهٔ خام LFS فقط از طریق backend پردازش می‌شود.</span>
        </div>
      </div>
    );
  }

  if (!years || !summary) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-5 flex items-center gap-3 text-xs text-ink-500">
        <Server size={16} className="animate-pulse text-brand-700" />
        در حال بارگذاری از سرور سینک مرکز آمار…
      </div>
    );
  }

  const sorted = [...summary].sort((a, b) => (b.unemploymentRate ?? -1) - (a.unemploymentRate ?? -1));
  const top12 = sorted.slice(0, 12);
  const maxRate = Math.max(...sorted.map((r) => r.unemploymentRate ?? 0), 1);
  const unemp = national?.laborForce ? (national.unemployed / national.laborForce) * 100 : null;
  const part = national?.pop15 ? (national.laborForce / national.pop15) * 100 : null;

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-ink-800 flex items-center gap-2">
          <Briefcase size={15} className="text-brand-700" />
          بازار کار — آمارگیری نیروی کار
          <span className="text-[8px] font-black text-teal-700 bg-teal-50 border border-teal-300/40 rounded-full px-1.5 py-0.5">مرکز آمار ایران</span>
        </h3>
        <span className="text-[9px] font-semibold text-ink-400 flex items-center gap-1">
          <Server size={10} className="text-ok" /> backend سینک برخط · دادهٔ خام mdb
        </span>
      </div>

      {/* انتخاب سال */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {years.map((y) => (
          <button
            key={y.year}
            onClick={() => setYear(y.year)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-colors ${year === y.year ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-800 border border-brand-100 hover:bg-brand-100'}`}
          >
            {y.year}
            <span className={`mr-1 text-[8px] font-medium ${year === y.year ? 'text-white/70' : 'text-ink-400'}`}>
              {faNum(y.totalWeighted)} نفر
            </span>
          </button>
        ))}
      </div>

      {/* شاخص‌های ملی */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500">نرخ بیکاری ملی (۱۵ ساله و بیشتر)</span>
          <span className="text-lg font-black text-brand-800">{fmtRate(unemp)}</span>
          <span className="text-[8.5px] text-ink-400">{faNum(national?.unemployed)} بیکار</span>
        </div>
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500">نرخ مشارکت اقتصادی</span>
          <span className="text-lg font-black text-brand-800">{fmtRate(part)}</span>
          <span className="text-[8.5px] text-ink-400">{faNum(national?.laborForce)} جمعیت فعال</span>
        </div>
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500">شاغلین</span>
          <span className="text-lg font-black text-brand-800">{faNum(national?.employed)}</span>
          <span className="text-[8.5px] text-ink-400">با وزن آمارگیری</span>
        </div>
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500">جمعیت ۱۵+ کشور</span>
          <span className="text-lg font-black text-brand-800">{faNum(national?.pop15)}</span>
          <span className="text-[8.5px] text-ink-400">کل {faNum(national?.popAll)}</span>
        </div>
      </div>

      {/* روند + بیکاری استانی */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-black text-ink-700 mb-1">روند نرخ بیکاری ملی ۱۳۸۴ ← ۱۳۹۹</div>
          <div className="flex items-end gap-1 h-16">
            {(trend ?? []).map((t) => (
              <div key={t.year} className="flex-1 flex flex-col items-center gap-0.5" title={`${t.year}: ${fmtRate(t.unemploymentRate)}`}>
                <div className="w-full bg-brand-700/70 rounded-t" style={{ height: `${Math.max(4, ((t.unemploymentRate ?? 0) / 14) * 52)}px` }} />
                <span className="text-[7px] text-ink-400">{t.year}</span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-ink-400 flex flex-col gap-0.5 mt-1">
            {trend?.map((t) => (
              <span key={t.year} className="flex justify-between"><span>{t.year}</span><b>{fmtRate(t.unemploymentRate)}</b></span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-black text-ink-700 mb-1">۱۲ استان با بیشترین نرخ بیکاری — {year}</div>
          {top12.map((r) => (
            <div key={r.province} className="flex items-center gap-2 text-[9.5px]">
              <span className="w-24 shrink-0 font-bold text-ink-700 truncate" title={r.fa}>{r.fa}</span>
              <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-danger/70 rounded-full" style={{ width: `${Math.min(100, ((r.unemploymentRate ?? 0) / maxRate) * 100)}%` }} />
              </div>
              <span className="w-11 shrink-0 text-ink-700 font-black text-left">{fmtRate(r.unemploymentRate)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* تفکیک استان انتخاب‌شده */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-black text-ink-700 flex items-center gap-1.5">
          <ArrowDownUp size={11} className="text-brand-700" />
          تفکیک نیروی کار به تفکیک استان
        </div>
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          className="self-start text-[10px] font-bold bg-surface border border-line rounded-lg px-2 py-1.5 text-ink-700"
        >
          {sorted.map((r) => (
            <option key={r.province} value={r.province}>{r.fa} — بیکاری {fmtRate(r.unemploymentRate)}</option>
          ))}
        </select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-[9.5px] font-black text-ink-600">به تفکیک جنس</div>
            {(sexRows ?? []).map((r) => (
              <div key={r.label} className="flex items-center justify-between text-[9px] border-b border-line/60 pb-1">
                <span className="font-bold text-ink-700">{r.label}</span>
                <span className="text-ink-500">بیکاری <b>{fmtRate(r.unemploymentRate)}</b> · مشارکت {fmtRate(r.participationRate)} · فعال {faNum(r.employed + r.unemployed)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[9.5px] font-black text-ink-600">به تفکیک گروه سنی</div>
            {(ageRows ?? []).map((r) => (
              <div key={r.label} className="flex items-center justify-between text-[9px] border-b border-line/60 pb-1">
                <span className="font-bold text-ink-700">{r.label} سال</span>
                <span className="text-ink-500">بیکاری <b>{fmtRate(r.unemploymentRate)}</b> · فعال {faNum(r.employed + r.unemployed)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
