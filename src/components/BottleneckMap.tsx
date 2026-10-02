import { Clock3, Layers, MapPin, Target, Users } from 'lucide-react';
import type { ProblemAddress } from '../algorithm/types';
import { CAPITAL_FA, CHAIN_FA } from '../algorithm/types';

export default function BottleneckMap({ bottleneck }: { bottleneck: ProblemAddress }) {
  const dimensions = [
    { label: 'سرمایه', value: CAPITAL_FA[bottleneck.capital], icon: <Target size={17} /> },
    { label: 'گذار', value: `${CHAIN_FA[bottleneck.transition[0]]} ← ${CHAIN_FA[bottleneck.transition[1]]}`, icon: <Layers size={17} /> },
    { label: 'مکان', value: bottleneck.location, icon: <MapPin size={17} /> },
    { label: 'گروه', value: bottleneck.group, icon: <Users size={17} /> },
    { label: 'زمان', value: bottleneck.time, icon: <Clock3 size={17} /> },
  ];
  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-black text-ink-900 dark:text-white">نشانی پنج‌بعدی گلوگاه</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">تعریف دقیق مسئله، پیش از انتخاب راه‌حل.</p></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {dimensions.map(item => <article key={item.label} className="min-w-0 rounded-2xl border border-line bg-surface p-3 text-center dark:border-wall-700 dark:bg-wall-800"><span className="mx-auto flex size-9 items-center justify-center rounded-xl bg-brand-100 text-brand-800 dark:bg-wall-850 dark:text-signal-400">{item.icon}</span><div className="mt-2 text-[9px] font-bold text-ink-400 dark:text-slate-500">{item.label}</div><div className="mt-1 break-words text-xs font-black leading-5 text-ink-800 dark:text-slate-200">{item.value}</div></article>)}
      </div>
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-signal-400/20 dark:bg-wall-800"><div className="text-[10px] font-black text-brand-800 dark:text-signal-400">صورت مسئله استاندارد</div><p className="mt-2 text-sm font-semibold leading-7 text-ink-700 dark:text-slate-200">در سرمایه <strong>{CAPITAL_FA[bottleneck.capital]}</strong>، گذار <strong>{CHAIN_FA[bottleneck.transition[0]]} به {CHAIN_FA[bottleneck.transition[1]]}</strong>، در <strong>{bottleneck.location}</strong>، برای <strong>{bottleneck.group}</strong> و در <strong>{bottleneck.time}</strong> دچار افت است.</p></div>
    </div>
  );
}
