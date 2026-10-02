import type { CapitalScore } from '../algorithm/types';
import { BAND_CONFIG, CAPITALS, CAPITAL_FA } from '../algorithm/types';
import { scoreToBand } from '../algorithm/statusBands';

interface Props {
  scores: CapitalScore[];
  width?: number;
  height?: number;
}

export default function CapitalRadarChart({ scores, width = 480, height = 420 }: Props) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / CAPITALS.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };
  const points = CAPITALS.map((capital, index) => getPoint(index, scores.find(score => score.capitalKey === capital)?.score ?? 0));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-black text-ink-900 dark:text-white">پروفایل هشت سرمایه</h3>
        <p className="mt-1 text-[11px] font-medium text-ink-500 dark:text-slate-400">شکل متوازن‌تر نشان‌دهنده تبدیل هماهنگ‌تر سرمایه‌های محله است.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-paper p-2 dark:border-wall-700 dark:bg-wall-850">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="capital-radar-title capital-radar-desc">
            <title id="capital-radar-title">نمودار راداری سرمایه‌های محله</title>
            <desc id="capital-radar-desc">مقایسه امتیاز هشت سرمایه در مقیاس صفر تا صد؛ مقادیر دقیق در فهرست کنار نمودار آمده‌اند.</desc>
            {[1, 2, 3, 4, 5].map(level => {
              const levelRadius = radius * level / 5;
              return <polygon key={level} points={CAPITALS.map((_, index) => {
                const angle = (Math.PI * 2 * index) / CAPITALS.length - Math.PI / 2;
                return `${cx + levelRadius * Math.cos(angle)},${cy + levelRadius * Math.sin(angle)}`;
              }).join(' ')} fill="none" stroke="currentColor" className="text-line-strong dark:text-wall-700" strokeWidth="1" />;
            })}
            {CAPITALS.map((capital, index) => {
              const angle = (Math.PI * 2 * index) / CAPITALS.length - Math.PI / 2;
              return (
                <g key={capital}>
                  <line x1={cx} y1={cy} x2={cx + radius * Math.cos(angle)} y2={cy + radius * Math.sin(angle)} stroke="currentColor" className="text-line-strong dark:text-wall-700" />
                  <text x={cx + (radius + 36) * Math.cos(angle)} y={cy + (radius + 36) * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle" fill="currentColor" className="text-ink-500 dark:text-slate-400" fontSize="11" fontWeight="700">{CAPITAL_FA[capital]}</text>
                </g>
              );
            })}
            <polygon points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="rgba(44,129,86,.2)" stroke="#2C8156" strokeWidth="3" />
            {points.map((point, index) => {
              const score = scores.find(item => item.capitalKey === CAPITALS[index]);
              const band = score ? BAND_CONFIG[scoreToBand(score.score)] : null;
              return <circle key={CAPITALS[index]} cx={point.x} cy={point.y} r="5" fill={band?.color ?? '#2C8156'} stroke="white" strokeWidth="2" />;
            })}
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-1">
          {scores.map(score => (
            <div key={score.capitalKey} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 dark:border-wall-700 dark:bg-wall-800">
              <span className="min-w-0 truncate text-[10px] font-black text-ink-600 dark:text-slate-300">{CAPITAL_FA[score.capitalKey]}</span>
              <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: BAND_CONFIG[score.band].color }}>{score.score.toFixed(1)}</span>
              <span className="sr-only">{BAND_CONFIG[score.band].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
