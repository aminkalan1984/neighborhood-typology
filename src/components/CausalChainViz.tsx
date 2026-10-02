import { CheckCircle2, FlaskConical, Lightbulb } from 'lucide-react';
import type { CausalHypothesis } from '../algorithm/types';
import { HYPOTHESIS_CATALOG } from '../algorithm/causalDiagnosis';

export default function CausalChainViz({ hypotheses }: { hypotheses: CausalHypothesis[] }) {
  if (hypotheses.length === 0) return <div className="rounded-2xl border border-dashed border-line p-8 text-center dark:border-wall-700"><Lightbulb size={34} className="mx-auto text-ink-300" /><p className="mt-3 text-sm font-black text-ink-700 dark:text-slate-300">شکاف معناداری برای ساخت فرضیه علّی شناسایی نشده است.</p></div>;
  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-black text-ink-900 dark:text-white">فرضیه‌های علّی رقیب</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">این موارد علت قطعی نیستند و باید با شواهد میدانی آزموده شوند.</p></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {hypotheses.map((hypothesis, index) => {
          const catalog = HYPOTHESIS_CATALOG[hypothesis.frictionType];
          const tested = hypothesis.evidenceStatus === 'tested';
          return (
            <article key={`${hypothesis.frictionType}-${index}`} className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-brand-100 text-brand-800 dark:bg-wall-850 dark:text-signal-400"><FlaskConical size={15} /></span><h4 className="text-xs font-black text-ink-800 dark:text-slate-200">{catalog.name}</h4></div><span className={`chip ${tested ? 'bg-ok-soft text-ok-700 dark:bg-ok/10 dark:text-ok' : 'bg-info-soft text-info-700 dark:bg-info/10 dark:text-teal-200'}`}>{tested && <CheckCircle2 size={10} />}{tested ? 'آزمون‌شده' : hypothesis.evidenceStatus === 'convergent' ? 'شواهد همگرا' : 'فرضیه اولیه'}</span></div>
              <p className="mt-3 text-xs font-semibold leading-6 text-ink-600 dark:text-slate-300">{hypothesis.hypothesis}</p>
              {hypothesis.causalChain.length > 0 && <div className="mt-3 overflow-x-auto rounded-xl bg-paper px-3 py-2 text-[10px] font-black text-brand-800 dark:bg-wall-850 dark:text-signal-400">{hypothesis.causalChain.join(' ← ')}</div>}
              {hypothesis.sources.length > 0 && <p className="mt-2 text-[9px] leading-4 text-ink-400 dark:text-slate-500">شواهد: {hypothesis.sources.slice(0, 5).join('، ')}{hypothesis.sources.length > 5 ? ` و ${hypothesis.sources.length - 5} مورد دیگر` : ''}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
