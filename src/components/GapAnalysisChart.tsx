import type { CapitalScore, ChainGaps } from '../algorithm/types';

interface Props { gaps: ChainGaps; capitalScores?: CapitalScore[]; }

export default function GapAnalysisChart({ gaps }: Props) {
  const data = [
    { key: 'G_CA', label: 'ظرفیت ← دسترسی', value: gaps.G_CA },
    { key: 'G_AU', label: 'دسترسی ← استفاده', value: gaps.G_AU },
    { key: 'G_UE', label: 'استفاده ← تجربه', value: gaps.G_UE },
    { key: 'G_EO', label: 'تجربه ← پیامد', value: gaps.G_EO },
  ];
  const maxAbs = Math.max(...data.map(item => Math.abs(item.value)), 1);
  return (
    <div className="space-y-5">
      <div><h3 className="text-base font-black text-ink-900 dark:text-white">نقشه ناترازی</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-slate-400">شکاف مثبت یعنی مرحله پیشین هنوز به مرحله بعدی تبدیل نشده است.</p></div>
      <div className="space-y-3">
        {data.map(item => {
          const severity = Math.abs(item.value) > 15 ? 'critical' : Math.abs(item.value) > 8 ? 'warning' : 'stable';
          const color = severity === 'critical' ? '#E5484D' : severity === 'warning' ? '#E8930C' : '#10B981';
          return (
            <article key={item.key} className="rounded-2xl border border-line bg-surface p-4 dark:border-wall-700 dark:bg-wall-800">
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-ink-700 dark:text-slate-300">{item.label}</span><span className="text-sm font-black tabular-nums" style={{ color }}>{item.value > 0 ? '+' : ''}{item.value.toFixed(1)}</span></div>
              <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-line dark:bg-wall-700" aria-label={`شکاف ${item.label}: ${item.value.toFixed(1)}`}>
                <div className="absolute inset-y-0 left-1/2 w-px bg-ink-300 dark:bg-slate-500" />
                <div className="absolute inset-y-0 rounded-full transition-[width]" style={{ width: `${Math.min(50, Math.abs(item.value) / maxAbs * 50)}%`, backgroundColor: color, ...(item.value < 0 ? { right: '50%' } : { left: '50%' }) }} />
              </div>
              <p className="mt-2 text-[9px] font-bold text-ink-400 dark:text-slate-500">{severity === 'critical' ? 'گلوگاه شدید؛ نیازمند مداخله مستقیم' : severity === 'warning' ? 'شکاف قابل توجه؛ نیازمند بررسی علت' : 'تبدیل نسبتاً پایدار'}</p>
            </article>
          );
        })}
      </div>
      <div className="rounded-2xl border border-info/20 bg-info-soft p-4 text-[11px] leading-6 text-info-700 dark:bg-info/10 dark:text-teal-200">ظرفیت بدون دسترسی معمولاً مسئله توزیع است؛ دسترسی بدون استفاده به هزینه یا امنیت اشاره دارد؛ استفاده بدون تجربه مثبت مسئله طراحی یا اعتماد است؛ و تجربه بدون پیامد می‌تواند از عوامل بیرونی محله ناشی شود.</div>
    </div>
  );
}
