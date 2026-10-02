import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { SURVEY_QUESTIONS, checkSkipTriggers, type SurveyResponse } from '../algorithm/perceptualSurvey';

export default function PerceptualSurveyForm({ onComplete }: { onComplete?: (responses: SurveyResponse[]) => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const question = SURVEY_QUESTIONS[currentQ];
  if (!question) return null;
  const response = responses.find(item => item.questionId === question.id);
  const activeTrigger = response ? checkSkipTriggers([response]).find(item => item.questionId === question.id) : undefined;
  const progress = (currentQ + 1) / SURVEY_QUESTIONS.length * 100;
  const handleAnswer = (value: number) => setResponses(previous => [...previous.filter(item => item.questionId !== question.id), { questionId: question.id, value, triggeredFollowUp: activeTrigger?.followUp }]);
  const next = () => { if (activeTrigger && response && followUpAnswer) setResponses(previous => previous.map(item => item.questionId === question.id ? { ...item, followUpAnswer } : item)); if (currentQ < SURVEY_QUESTIONS.length - 1) { setCurrentQ(value => value + 1); setFollowUpAnswer(''); } else onComplete?.(responses); };
  const labels = ['کاملاً مخالف','مخالف','خنثی','موافق','کاملاً موافق'];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3"><div className="icon-tile"><ClipboardCheck size={17} /></div><div><h3 className="text-base font-black text-ink-900 dark:text-white">پیمایش ادراکی محله</h3><p className="mt-1 text-[10px] text-ink-400 dark:text-slate-500">صدای ساکنان برای تکمیل داده‌های ثبتی</p></div></div>
      <div><div className="flex justify-between text-[9px] font-black text-ink-400 dark:text-slate-500"><span>سؤال {currentQ+1} از {SURVEY_QUESTIONS.length}</span><span>{Math.round(progress)}٪</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-line dark:bg-wall-700" role="progressbar" aria-valuenow={progress}><div className="h-full rounded-full bg-brand-600 dark:bg-signal-400" style={{width:`${progress}%`}} /></div></div>
      <fieldset className="rounded-2xl border border-line bg-surface p-4 md:p-6 dark:border-wall-700 dark:bg-wall-800"><legend className="sr-only">{question.text}</legend><span className="chip bg-brand-50 text-brand-800 dark:bg-wall-850 dark:text-signal-400">{question.chainStage}</span><p className="mt-4 text-base font-black leading-7 text-ink-900 dark:text-white">{question.text}</p><div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">{[1,2,3,4,5].map((value,index)=><button key={value} type="button" aria-pressed={response?.value===value} onClick={()=>handleAnswer(value)} className={`rounded-xl border px-2 py-3 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-800/15 ${response?.value===value?'border-brand-800 bg-brand-800 text-white dark:border-signal-400 dark:bg-signal-400 dark:text-wall-950':'border-line bg-paper text-ink-500 hover:border-brand-300 dark:border-wall-700 dark:bg-wall-850 dark:text-slate-400'}`}><strong className="block text-base">{value}</strong><span className="mt-1 block text-[9px] font-bold">{labels[index]}</span>{response?.value===value&&<CheckCircle2 size={12} className="mx-auto mt-1" />}</button>)}</div></fieldset>
      {activeTrigger && response && <div className="rounded-2xl border border-warn/30 bg-warn-soft p-4 dark:bg-warn/10"><label htmlFor="survey-followup" className="text-xs font-black text-warn-700 dark:text-warn">سؤال تکمیلی: {activeTrigger.followUp}</label><input id="survey-followup" value={followUpAnswer} onChange={event=>setFollowUpAnswer(event.target.value)} className="mt-3 w-full rounded-xl border border-warn/30 bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-warn/15 dark:bg-wall-800" /></div>}
      <div className="flex justify-between gap-3"><button type="button" onClick={()=>setCurrentQ(value=>Math.max(0,value-1))} disabled={currentQ===0} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-xs font-black text-ink-500 disabled:opacity-35 dark:border-wall-700 dark:text-slate-400"><ChevronRight size={15}/>قبلی</button><button type="button" onClick={next} disabled={!response} className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-5 py-2 text-xs font-black text-white disabled:opacity-40 dark:bg-signal-400 dark:text-wall-950">{currentQ===SURVEY_QUESTIONS.length-1?'ثبت پیمایش':'بعدی'}<ChevronLeft size={15}/></button></div>
    </div>
  );
}
