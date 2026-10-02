import type { InterventionCandidate } from '../algorithm/types';
import { CAPITAL_FA } from '../algorithm/types';

export default function InterventionMatrix({ interventions }: { interventions: InterventionCandidate[] }) {
  const scored = interventions.map(item => ({ ...item, equityAdjusted: item.severity * item.population * item.leverage * item.feasibility * item.equity })).sort((a, b) => b.equityAdjusted - a.equityAdjusted);
  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-black text-ink-900 dark:text-white">سبد مداخله</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">اولویت تعدیل‌شده با عدالت = شدت × جمعیت × اهرم × امکان اجرا × عدالت</p></div>
      <div className="grid gap-3 md:hidden">
        {scored.map((item, index) => <article key={item.id} className={`rounded-2xl border p-4 ${index === 0 ? 'border-brand-300 bg-brand-50 dark:border-signal-400/30 dark:bg-wall-800' : 'border-line bg-surface dark:border-wall-700 dark:bg-wall-900'}`}><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black text-brand-800 dark:text-signal-400">اولویت {index + 1}</span><h4 className="mt-1 text-sm font-black text-ink-900 dark:text-white">{item.name}</h4><p className="mt-1 text-[10px] text-ink-400 dark:text-slate-500">سرمایه {CAPITAL_FA[item.targetCapital]}</p></div><strong className="text-lg tabular-nums text-brand-800 dark:text-signal-400">{item.equityAdjusted.toFixed(2)}</strong></div><div className="mt-3 grid grid-cols-5 gap-1 text-center text-[8px] font-bold text-ink-400 dark:text-slate-500">{[['شدت',item.severity],['جمعیت',item.population],['اهرم',item.leverage],['امکان',item.feasibility],['عدالت',item.equity]].map(([label,value]) => <div key={String(label)} className="rounded-lg bg-paper p-2 dark:bg-wall-850"><strong className="block text-[10px] text-ink-700 dark:text-slate-300">{(Number(value)*100).toFixed(0)}٪</strong>{label}</div>)}</div></article>)}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block dark:border-wall-700">
        <table className="w-full min-w-[760px] text-[11px]"><thead className="bg-paper text-ink-500 dark:bg-wall-850 dark:text-slate-400"><tr>{['رتبه','سرمایه','نام اقدام','شدت','جمعیت','اهرم','امکان','عدالت','اولویت'].map(label => <th key={label} className="px-3 py-3 text-right font-black">{label}</th>)}</tr></thead><tbody>{scored.map((item,index) => <tr key={item.id} className={`border-t border-line dark:border-wall-700 ${index===0?'bg-brand-50/60 dark:bg-wall-800':''}`}><td className="px-3 py-3 font-black text-brand-800 dark:text-signal-400">{index+1}</td><td className="px-3 py-3 font-bold">{CAPITAL_FA[item.targetCapital]}</td><td className="max-w-xs px-3 py-3 font-black text-ink-800 dark:text-slate-200">{item.name}</td>{[item.severity,item.population,item.leverage,item.feasibility,item.equity].map((value,i)=><td key={i} className="px-3 py-3 text-center tabular-nums">{(value*100).toFixed(0)}٪</td>)}<td className="px-3 py-3 text-center font-black tabular-nums text-brand-800 dark:text-signal-400">{item.equityAdjusted.toFixed(2)}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
