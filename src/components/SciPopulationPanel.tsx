// ============================================================
// پنل «جمعیت و توسعهٔ سرزمینی» — دادهٔ واقعی استخراج‌شده از
// فایل‌های مرکز آمار ایران (Portals → src/data/portals):
//   - پیش‌بینی جمعیت استان‌ها ۱۳۹۶–۱۴۱۵
//   - سری ملی جمعیت ۱۳۷۵–۱۳۹۵ و خانوارهای استانی
//   - بلوک‌های سرشماری ۹۵ به تفکیک استان
// همهٔ اعداد از JSONهای استخراج‌شده خوانده می‌شوند (lazy).
// ============================================================
import { useEffect, useState } from 'react';
import { Users, Home, Grid3x3, TrendingUp, MapPin } from 'lucide-react';
import SciLaborMarketPanel from './SciLaborMarketPanel';
import populationUrl from '../data/portals/population/projections-1396-1415.json?url';
import nationalPopUrl from '../data/portals/population/national-1375-1395.json?url';
import householdsUrl from '../data/portals/population/households-1385-1395.json?url';
import blocksUrl from '../data/portals/geo/blocks-per-province.json?url';

interface ProjectionRow { year: string; province: string; total: number; urban_total: number; urban_male: number; urban_female: number; rural_total: number }
interface NationalRow { year: string; total: number; urban_total: number }
interface HouseholdRow { province: string; years: Record<string, number> }
interface BlockRow { code: string; province: string; blocks: number }

const faNum = (n: number | undefined | null): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('fa-IR');
};

export default function SciPopulationPanel() {
  const [pop, setPop] = useState<ProjectionRow[] | null>(null);
  const [nat, setNat] = useState<NationalRow[] | null>(null);
  const [hh, setHh] = useState<HouseholdRow[] | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, n, h, b] = await Promise.all([
          fetch(populationUrl).then((r) => r.json()),
          fetch(nationalPopUrl).then((r) => r.json()),
          fetch(householdsUrl).then((r) => r.json()),
          fetch(blocksUrl).then((r) => r.json()),
        ]);
        if (!alive) return;
        setPop(p as ProjectionRow[]);
        setNat(n as NationalRow[]);
        setHh(h as HouseholdRow[]);
        setBlocks(b as BlockRow[]);
      } catch {
        // بی‌صدا — پنل فقط در صورت دسترسی داده رندر می‌شود
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!pop || !nat || !hh || !blocks) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-5 flex items-center gap-3 text-xs text-ink-500">
        <TrendingUp size={16} className="animate-pulse text-brand-700" />
        بارگذاری داده‌های رسمی مرکز آمار ایران…
      </div>
    );
  }

  // ── آمارهای کلیدی ──
  const latest = nat[nat.length - 1];
  const hhLatest = hh.map((h) => {
    const ks = Object.keys(h.years).sort();
    return { prov: h.province, first: ks[0], last: ks[ks.length - 1], vFirst: h.years[ks[0]], vLast: h.years[ks[ks.length - 1]] };
  }).filter((x) => x.vFirst != null && x.vLast != null);
  const totalHhLast = hhLatest.reduce((s, x) => s + (x.vLast ?? 0), 0);
  const totalHhFirst = hhLatest.reduce((s, x) => s + (x.vFirst ?? 0), 0);
  const hhGrowth = totalHhFirst ? (((totalHhLast - totalHhFirst) / totalHhFirst) * 100).toFixed(1) : '—';
  const totalBlocks = blocks.reduce((s, b) => s + b.blocks, 0);

  // ── پیش‌بینی: تهران/اصفهان/خراسان/کل کشورها در ۱۳۹۶ و ۱۴۱۵ ──
  const byProv: Record<string, Record<string, ProjectionRow>> = {};
  for (const p of pop) (byProv[p.province] = byProv[p.province] || {})[p.year] = p;
  const provNames = Object.keys(byProv);
  const startY = '1396', endY = '1415';
  const top10 = provNames
    .map((prov) => {
      const a = byProv[prov][startY], b = byProv[prov][endY] ?? Object.values(byProv[prov]).pop();
      return { prov, a: a?.total, b: b?.total, growth: a && b && a.total ? ((b.total - a.total) / a.total) * 100 : null };
    })
    .filter((x) => x.a != null && x.b != null)
    .sort((x, y) => (y.b ?? 0) - (x.b ?? 0))
    .slice(0, 10);

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-800 flex items-center gap-2">
          <Users size={15} className="text-brand-700" />
          جمعیت و توسعهٔ سرزمینی ایران
          <span className="text-[8px] font-black text-teal-700 bg-teal-50 border border-teal-300/40 rounded-full px-1.5 py-0.5">مرکز آمار ایران</span>
        </h3>
        <span className="text-[9px] font-semibold text-ink-400">منبع: فایل‌های رسمی استخراج‌شده (۱۴۰۱–۱۴۰۴)</span>
      </div>

      {/* آمار کلان */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500 flex items-center gap-1"><Users size={10} /> جمعیت کل کشور (سری ۱۳۹۵)</span>
          <span className="text-lg font-black text-brand-800">{latest ? faNum(latest.total) : '—'}</span>
          <span className="text-[8.5px] text-ink-400">{latest ? `هزار نفر · شهری ${faNum(latest.urban_total)}` : ''}</span>
        </div>
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500 flex items-center gap-1"><Home size={10} /> خانوارهای استانی</span>
          <span className="text-lg font-black text-brand-800">{faNum(totalHhLast)}</span>
          <span className="text-[8.5px] text-ink-400">رشد {hhGrowth}٪ در بازهٔ سرشماری‌ها</span>
        </div>
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500 flex items-center gap-1"><Grid3x3 size={10} /> بلوک‌های آماری سرشماری ۹۵</span>
          <span className="text-lg font-black text-brand-800">{faNum(totalBlocks)}</span>
          <span className="text-[8.5px] text-ink-400">در {blocks.length} استان</span>
        </div>
        <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-ink-500 flex items-center gap-1"><TrendingUp size={10} /> جمعیت پیش‌بینی‌شده ۱۴۱۵</span>
          <span className="text-lg font-black text-brand-800">{faNum(top10.reduce((s, x) => s + (x.b ?? 0), 0))}</span>
          <span className="text-[8.5px] text-ink-400">جمع ۱۰ استان پرجمعیت (هزار نفر)</span>
        </div>
      </div>

      {/* رشد ۱۰ استان پرجمعیت */}
      <div>
        <div className="text-[10px] font-black text-ink-700 mb-2 flex items-center gap-1.5">
          <MapPin size={11} className="text-brand-700" /> ۱۰ استان پرجمعیت — پیش‌بینی ۱۳۹۶ ← ۱۴۱۵ (هزار نفر)
        </div>
        <div className="flex flex-col gap-1.5">
          {top10.map((x) => (
            <div key={x.prov} className="flex items-center gap-2 text-[9.5px]">
              <span className="w-24 shrink-0 font-bold text-ink-700 truncate">{x.prov}</span>
              <span className="w-12 shrink-0 text-ink-400 text-left">{faNum(x.a)}</span>
              <div className="flex-1 h-2 bg-line rounded-full overflow-hidden relative">
                <div className="h-full bg-brand-700/80 rounded-full" style={{ width: `${Math.min(100, ((x.b ?? 0) / (top10[0]?.b ?? 1)) * 100)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-ink-700 font-black text-left">{faNum(x.b)}</span>
              <span className={`w-12 shrink-0 text-left font-bold ${(x.growth ?? 0) >= 0 ? 'text-ok' : 'text-danger'}`}>
                {x.growth != null ? `${x.growth >= 0 ? '+' : ''}${x.growth.toFixed(1)}٪` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* بازار کار — دادهٔ خام LFS از backend سینک */}
      <SciLaborMarketPanel />

      {/* سری ملی + بلوک‌های برتر */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-black text-ink-700 mb-1">سری ملی جمعیت ۱۳۷۵ ← ۱۳۹۵ (هزار نفر)</div>
          <div className="flex items-end gap-1 h-20">
            {nat.map((n) => (
              <div key={n.year} className="flex-1 flex flex-col items-center gap-0.5" title={`${n.year}: ${faNum(n.total)}`}>
                <div className="w-full bg-brand-700/70 rounded-t" style={{ height: `${Math.max(4, (n.total / (nat[nat.length - 1]?.total ?? 1)) * 64)}px` }} />
                <span className="text-[7px] text-ink-400">{n.year.slice(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-black text-ink-700 mb-1">بیشترین بلوک سرشماری ۹۵ — ۵ استان برتر</div>
          {[...blocks].sort((a, b) => b.blocks - a.blocks).slice(0, 5).map((b, i) => (
            <div key={b.code} className="flex items-center gap-2 text-[9.5px]">
              <span className="w-24 shrink-0 font-bold text-ink-700 truncate">{b.province}</span>
              <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-teal-700/70 rounded-full" style={{ width: `${(b.blocks / (blocks[0]?.blocks ?? 1)) * 100}%` }} />
              </div>
              <span className="w-14 shrink-0 text-ink-700 font-black text-left">{faNum(b.blocks)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
