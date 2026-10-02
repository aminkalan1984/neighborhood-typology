import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import type { JusticeGap } from '../algorithm/types';

export default function EquityMap({ gaps }: { gaps: JusticeGap[] }) {
  if (gaps.length === 0) return <Empty title="داده تفکیک گروهی موجود نیست" description="بدون داده گروهی، تصمیم‌یار حکم قطعی درباره عدالت صادر نمی‌کند." />;
  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-black text-ink-900 dark:text-white">نقشه عدالت</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">فاصله بهترین و بدترین گروه؛ میانگین خوب با شکاف زیاد، کیفیت عادلانه نیست.</p></div>
      <div className="space-y-3">
        {gaps.map(gap => {
          const critical = gap.verdict === 'critical';
          const unequal = gap.verdict === 'unequal_but_good';
          const color = critical ? '#E5484D' : unequal ? '#E8930C' : '#10B981';
          return (
            <article key={gap.indicatorCode} className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-ink-700 dark:text-slate-300">{gap.indicatorCode}</span><span className="chip" style={{ color, backgroundColor: `${color}18` }}>{critical ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}{critical ? 'بحرانی' : unequal ? 'خوب اما نابرابر' : 'عادلانه'}</span></div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10px] font-bold text-ink-500 dark:text-slate-400"><span className="truncate">بهترین: {gap.bestGroup}</span><strong className="text-sm tabular-nums" style={{ color }}>شکاف {gap.gap.toFixed(1)}</strong><span className="truncate text-left">بدترین: {gap.worstGroup}</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line dark:bg-wall-700"><div className="h-full rounded-full" style={{ width: `${Math.min(100, gap.gap)}%`, backgroundColor: color }} /></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center dark:border-wall-700"><Scale size={34} className="mx-auto text-ink-300 dark:text-slate-600" /><h3 className="mt-3 text-sm font-black text-ink-700 dark:text-slate-300">{title}</h3><p className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">{description}</p></div>;
}
