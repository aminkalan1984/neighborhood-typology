import { useEffect, useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Crosshair, X, Users, Mountain, Map as MapIcon, AlertTriangle, ExternalLink } from 'lucide-react';
import { IRAN_PROVINCES, IRAN_WATERS, IRAN_VIEWBOX, IRAN_VIEWBOX_WIDTH, IRAN_VIEWBOX_HEIGHT, getPathLabelAnchor, PROVINCES_DATA } from '../data/iranProvincePaths';
import { toPersianDigits } from './AnimatedCounter';

export interface IranSVGMapProps {
  mapKPI: string;
  setMapKPI: (kpi: string) => void;
  mapMode: 'choropleth' | 'symbols' | 'hexbin';
  setMapMode: (mode: 'choropleth' | 'symbols' | 'hexbin') => void;
  hoveredProvince: string | null;
  setHoveredProvince: (id: string | null) => void;
  isAltPressed?: boolean;
  /** فراخوانی‌شده هنگام کلیک روی «مشاهده در ژئوپرتال» — با کد استان (مثل TEH) */
  onOpenGeoportal?: (provinceId: string) => void;
}

const KPI_LABELS: Record<string, string> = {
  'water-stress': 'تنش آبی',
  'gdp-growth': 'رشد اقتصادی',
  inflation: 'نرخ تورم',
  'public-satisfaction': 'رضایت عمومی',
};

/** مقدار عددی KPI برای هر استان (هماهنگ با منطق MapirWebGIS) */
function getKPIValue(kpiCode: string, mapKPI: string): number {
  const prov = PROVINCES_DATA.find((p) => p.id === kpiCode);
  if (!prov) return 50;
  if (mapKPI === 'gdp-growth') return prov.gdpGrowth * 10;
  if (mapKPI === 'inflation') return prov.inflation;
  if (mapKPI === 'public-satisfaction') return prov.satisfaction;
  return prov.waterStress;
}

/** رنگ‌بندی choropleth با گرادیان سبز هماهنگ با تم (برند روشن → جنگلی تیره) */
function getChoroplethColor(val: number): string {
  const t = Math.min(Math.max(val / 100, 0), 1);
  // brand-200 #BEE1CB → brand-500 #3C9C6A → brand-900 #12402D
  const stops: [number, [number, number, number]][] = [
    [0, [190, 225, 203]],
    [0.5, [60, 156, 106]],
    [1, [18, 64, 45]],
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const f = (t - lower[0]) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f);
  const [r1, g1, b1] = lower[1];
  const [r2, g2, b2] = upper[1];
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

/** مرکز تقریبی هر استان از مختصات مسیر SVG (برای حالت نمادی و هگزبین) */
// مرکز برچسب هر استان از هلپر مشترک getPathLabelAnchor (مرکز سطح داخل چندضلعی) می‌آید

const STATUS_COLOR: Record<string, string> = {
  critical: '#E5484D',
  warning: '#E8930C',
  optimal: '#10B981',
};

const WATER_FILL = '#BFDFE8';
const WATER_STROKE = '#8FBCC9';

function hexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export default function IranSVGMap({
  mapKPI,
  setMapKPI,
  mapMode,
  setMapMode,
  hoveredProvince,
  setHoveredProvince,
  isAltPressed = false,
  onOpenGeoportal,
}: IranSVGMapProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  // بستن پنل جزئیات با کلید Escape
  useEffect(() => {
    if (!selectedProvince) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProvince(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedProvince]);

  const valueOf = (kpi: string) => getKPIValue(kpi, mapKPI);

  const centroids = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    // لنگرگاه برچسب مشترک: مرکز سطحِ داخل چندضلعی (با fallback bbox) به‌جای مرکز bbox خام
    IRAN_PROVINCES.forEach((p) => { map[p.kpi] = getPathLabelAnchor(p.d); });
    return map;
  }, []);

  const showLabels = isAltPressed || mapMode === 'symbols' || mapMode === 'hexbin';

  // تبدیل مختصات SVG به درصد کانتینر (برای tooltip شناور)
  const centroidPct = (kpi: string) => {
    const c = centroids[kpi];
    if (!c) return { x: 50, y: 50 };
    return { x: (c.x / IRAN_VIEWBOX_WIDTH) * 100, y: (c.y / IRAN_VIEWBOX_HEIGHT) * 100 };
  };

  // Zoom حول مرکز واقعی viewBox — transformOrigin درصدی تا در هر اندازهٔ کانتینر درست کار کند
  const tx = 600 * (1 - zoom);
  const ty = 535.3 * (1 - zoom);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 !rounded-none border-0' : ''
      } ${mapMode === 'choropleth'
        ? 'border-line bg-paper dark:border-wall-700 dark:bg-wall-900'
        : 'border-line bg-paper/80 dark:border-wall-700 dark:bg-wall-900/80'}`}
    >
      {/* Header bar */}
      <div className="absolute top-3 right-3 left-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-surface/90 dark:bg-wall-850/90 backdrop-blur-md border border-line dark:border-wall-700 px-3 py-1.5 shadow-[var(--shadow-card)]">
          <Crosshair size={14} className="text-brand-700 dark:text-signal-400" />
          <span className="text-[10px] font-black text-ink-700 dark:text-slate-200">
            نقشهٔ کامل ایران — {IRAN_PROVINCES.length} استان
          </span>
          <span className="text-line-strong dark:text-wall-600">|</span>
          <span className="text-[10px] font-bold text-ink-500 dark:text-slate-400">
            {KPI_LABELS[mapKPI] || mapKPI}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-brand-100/70 dark:bg-wall-700/70 border border-brand-200/60 dark:border-wall-600 px-2 py-0.5 text-[9px] font-bold text-brand-800 dark:text-signal-400">
            <AlertTriangle size={9} /> برای جزئیات کلیک کنید
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 bg-surface/90 dark:bg-wall-850/90 backdrop-blur-md border border-line dark:border-wall-700 rounded-xl p-1 shadow-[var(--shadow-card)]">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.35, 5))}
            className="size-7 flex items-center justify-center rounded-lg text-ink-600 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-wall-700 hover:text-brand-800 dark:hover:text-signal-400 transition-all active:scale-90 cursor-pointer"
            title="بزرگ‌نمایی"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.35, 1))}
            className="size-7 flex items-center justify-center rounded-lg text-ink-600 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-wall-700 hover:text-brand-800 dark:hover:text-signal-400 transition-all active:scale-90 cursor-pointer"
            title="کوچک‌نمایی"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="size-7 flex items-center justify-center rounded-lg text-ink-600 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-wall-700 hover:text-brand-800 dark:hover:text-signal-400 transition-all active:scale-90 cursor-pointer"
            title="بازنشانی نما"
          >
            <RotateCcw size={14} />
          </button>
          <span className="size-1 rounded-full bg-line-strong dark:bg-wall-600" />
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="size-7 flex items-center justify-center rounded-lg text-brand-700 dark:text-signal-400 hover:bg-brand-100 dark:hover:bg-wall-700 transition-all active:scale-90 cursor-pointer"
            title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Map canvas */}
      <div className="relative w-full select-none" style={{ aspectRatio: '1200 / 1070.6' }}>
        <svg
          viewBox={IRAN_VIEWBOX}
          className="absolute inset-0 w-full h-full"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: '0 0' }}
          role="img"
          aria-label="نقشهٔ استان‌های ایران"
        >
          <defs>
            <radialGradient id="iran-bg-glow" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <filter id="iran-hover-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#1D5940" floodOpacity="0.35" />
            </filter>
            <filter id="iran-hover-glow-dark" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#BBF49C" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* پس‌زمینهٔ نقشه — کلیک روی فضای خالی، پنل را می‌بندد */}
          <rect
            x="0"
            y="0"
            width="1200"
            height="1070.6"
            fill="url(#iran-bg-glow)"
            onClick={() => setSelectedProvince(null)}
            className="cursor-default"
          />

          {/* دریاها و جزایر */}
          {IRAN_WATERS.map((w) => (
            <path
              key={w.id}
              d={w.d}
              fill={WATER_FILL}
              stroke={WATER_STROKE}
              strokeWidth={0.8}
              opacity={0.75}
            />
          ))}

          {/* استان‌ها */}
          {IRAN_PROVINCES.map((prov) => {
            const val = valueOf(prov.kpi);
            const isHovered = hoveredProvince === prov.kpi;
            const isSelected = selectedProvince === prov.kpi;
            const provData = PROVINCES_DATA.find((p) => p.id === prov.kpi);
            const status = provData?.status || 'warning';
            const centroid = centroids[prov.kpi];
            const showSymbol = mapMode === 'symbols';
            const showHex = mapMode === 'hexbin';

            const fill =
              mapMode === 'choropleth'
                ? getChoroplethColor(val)
                : isHovered || isSelected
                  ? '#BBF49C'
                  : 'rgba(190, 225, 203, 0.35)';

            const strokeColor = isHovered || isSelected
              ? 'var(--color-signal-400)'
              : 'var(--color-brand-900)';

            return (
              <g
                key={prov.id}
                onMouseEnter={() => setHoveredProvince(prov.kpi)}
                onMouseLeave={() => setHoveredProvince(null)}
                onClick={() => setSelectedProvince((cur) => (cur === prov.kpi ? null : prov.kpi))}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={prov.d}
                  fill={fill}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.2 : isHovered ? 2 : 0.9}
                  strokeOpacity={isSelected ? 1 : isHovered ? 1 : 0.5}
                  filter={isHovered || isSelected ? 'url(#iran-hover-glow)' : undefined}
                  className="transition-all duration-200"
                />
                {showSymbol && centroid && (
                  <circle
                    cx={centroid.x}
                    cy={centroid.y}
                    r={isHovered ? Math.max(val / 3.5, 12) + 4 : Math.max(val / 3.5, 12)}
                    fill={STATUS_COLOR[status]}
                    fillOpacity={0.85}
                    stroke={isHovered ? '#BBF49C' : '#FFFFFF'}
                    strokeWidth={isHovered ? 3 : 1.6}
                    className="transition-all duration-200"
                  />
                )}
                {showHex && centroid && (
                  <polygon
                    points={hexagonPoints(centroid.x, centroid.y, isHovered ? 16 : 13)}
                    fill={getChoroplethColor(val)}
                    fillOpacity={0.9}
                    stroke="#FFFFFF"
                    strokeWidth={1.4}
                    className="transition-all duration-200"
                  />
                )}
                {(showLabels || isHovered || isSelected) && centroid && (
                  <text
                    x={centroid.x}
                    y={centroid.y - (showSymbol ? 20 : 14)}
                    textAnchor="middle"
                    fontSize={isHovered || isSelected ? 20 : 16}
                    fontWeight={800}
                    fill={isHovered || isSelected ? 'var(--color-brand-900)' : 'rgba(29, 89, 64, 0.78)'}
                    style={{ fontFamily: 'inherit', pointerEvents: 'none' }}
                    className="select-none map-province-label"
                  >
                    {prov.fa}
                  </text>
                )}
              </g>
            );
          })}

          {/* راهنمای مقیاس */}
          <g transform="translate(36, 1000)" className="select-none pointer-events-none">
            <rect x="0" y="0" width="150" height="26" rx="8" fill="rgba(255,255,255,0.82)" stroke="#E3EAE5" strokeWidth="1" />
            <text x="14" y="17" fontSize="12" fontWeight={700} fill="#5E6B66" style={{ fontFamily: 'inherit' }}>
              مقیاس ۱ : ۴۰,۰۰۰,۰۰۰
            </text>
          </g>
        </svg>

        {/* Tooltip شناور */}
        {hoveredProvince && (() => {
          const prov = IRAN_PROVINCES.find((p) => p.kpi === hoveredProvince);
          const provData = PROVINCES_DATA.find((p) => p.id === hoveredProvince);
          if (!prov || !provData) return null;
          const pct = centroidPct(hoveredProvince);
          const val = valueOf(hoveredProvince);
          const statusText = provData.status === 'critical' ? 'بحرانی' : provData.status === 'warning' ? 'هشدار' : 'پایدار';
          const statusColor = STATUS_COLOR[provData.status];
          const tooltipLeft = Math.min(Math.max(pct.x, 22), 78);
          return (
            <div
              className="absolute z-20 w-52 pointer-events-none"
              style={{ top: `${Math.min(Math.max(pct.y - 12, 4), 72)}%`, left: `${tooltipLeft}%`, transform: 'translate(-50%, 0)' }}
            >
              <div className="rounded-xl border border-line dark:border-wall-700 bg-surface/95 dark:bg-wall-850/95 backdrop-blur-md shadow-xl p-3 text-right">
                <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-line dark:border-wall-700">
                  <span className="text-xs font-black text-brand-800 dark:text-signal-400">استان {prov.fa}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: statusColor }}>
                    {statusText}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-ink-500 dark:text-slate-400 font-medium">{KPI_LABELS[mapKPI] || mapKPI}:</span>
                  <span className="font-mono font-black" style={{ color: mapMode === 'choropleth' ? getChoroplethColor(val) : statusColor }}>
                    {toPersianDigits(val.toFixed(1))}٪
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-ink-500 dark:text-slate-400 font-medium">رشد اقتصادی:</span>
                  <span className="font-mono font-bold text-ink-800 dark:text-slate-200">{toPersianDigits(provData.gdpGrowth)}٪</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-ink-500 dark:text-slate-400 font-medium">مختصات:</span>
                  <span className="font-mono font-bold text-ink-700 dark:text-slate-300" dir="ltr">
                    {provData.lat.toFixed(2)}, {provData.lng.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* پنل جزئیات استان (کلیک روی نقشه) */}
      {selectedProvince && (() => {
        const prov = IRAN_PROVINCES.find((p) => p.kpi === selectedProvince);
        const provData = PROVINCES_DATA.find((p) => p.id === selectedProvince);
        if (!prov || !provData) return null;
        const statusText = provData.status === 'critical' ? 'بحرانی' : provData.status === 'warning' ? 'هشدار' : 'پایدار';
        const statusColor = STATUS_COLOR[provData.status];
        // مقدار نمایشی (واقعی) + عرض نوار (مقیاس‌شده) جدا از هم — تا عدد واقعی گمراه‌کننده نباشد
        const bars: { label: string; pct: number; display: string; color: string; hint?: string }[] = [
          { label: 'تنش آبی', pct: provData.waterStress, display: `${provData.waterStress.toFixed(0)}٪`, color: getChoroplethColor(provData.waterStress) },
          { label: 'رشد اقتصادی', pct: Math.min(provData.gdpGrowth * 10, 100), display: `${provData.gdpGrowth.toFixed(1)}٪`, color: '#10B981' },
          { label: 'رضایت عمومی', pct: provData.satisfaction, display: `${provData.satisfaction.toFixed(0)}٪`, color: '#3C9C6A' },
          { label: 'نرخ تورم', pct: Math.min(provData.inflation * 2, 100), display: `${provData.inflation.toFixed(0)}٪`, color: '#E8930C' },
        ];
        return (
          <div className="absolute left-3 top-14 bottom-3 z-20 w-64 pointer-events-auto animate-[slideInLeft_0.25s_ease-out]">
            <div className="flex flex-col h-full rounded-2xl border border-line dark:border-wall-700 bg-surface/95 dark:bg-wall-850/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* سربرگ */}
              <div className="relative px-4 py-3 border-b border-line dark:border-wall-700 bg-gradient-to-l from-brand-50/80 to-brand-100/40 dark:from-wall-800 dark:to-wall-850">
                <button
                  onClick={() => setSelectedProvince(null)}
                  className="absolute top-2.5 left-2.5 size-6 flex items-center justify-center rounded-lg text-ink-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-wall-700 hover:text-danger transition-all active:scale-90 cursor-pointer"
                  title="بستن پنل"
                >
                  <X size={13} />
                </button>
                <div className="pr-8">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-brand-800 dark:text-signal-400">استان {prov.fa}</span>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm"
                      style={{ backgroundColor: statusColor }}
                    >
                      {statusText}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[9px] font-medium text-ink-500 dark:text-slate-400" dir="ltr">
                    {provData.lat.toFixed(2)}°N — {provData.lng.toFixed(2)}°E
                  </div>
                </div>
              </div>

              {/* آمار کلی */}
              <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-line/70 dark:border-wall-700/70">
                <div className="rounded-xl bg-brand-50/70 dark:bg-wall-800/80 border border-line/70 dark:border-wall-700/70 p-2">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-ink-500 dark:text-slate-400">
                    <Users size={10} className="text-brand-700 dark:text-signal-400" />
                    جمعیت
                  </div>
                  <div className="mt-0.5 font-mono text-[13px] font-black text-ink-800 dark:text-slate-100">
                    {toPersianDigits(provData.population.toFixed(1))} <span className="text-[8px] font-bold text-ink-500">میلیون</span>
                  </div>
                </div>
                <div className="rounded-xl bg-brand-50/70 dark:bg-wall-800/80 border border-line/70 dark:border-wall-700/70 p-2">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-ink-500 dark:text-slate-400">
                    <MapIcon size={10} className="text-brand-700 dark:text-signal-400" />
                    مساحت
                  </div>
                  <div className="mt-0.5 font-mono text-[13px] font-black text-ink-800 dark:text-slate-100">
                    {toPersianDigits(provData.area.toLocaleString('en-US'))} <span className="text-[8px] font-bold text-ink-500">km²</span>
                  </div>
                </div>
                <div className="rounded-xl bg-brand-50/70 dark:bg-wall-800/80 border border-line/70 dark:border-wall-700/70 p-2">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-ink-500 dark:text-slate-400">
                    <Mountain size={10} className="text-brand-700 dark:text-signal-400" />
                    ارتفاع متوسط
                  </div>
                  <div className="mt-0.5 font-mono text-[13px] font-black text-ink-800 dark:text-slate-100">
                    {toPersianDigits(provData.elevation.toLocaleString('en-US'))} <span className="text-[8px] font-bold text-ink-500">متر</span>
                  </div>
                </div>
                <div className="rounded-xl bg-brand-50/70 dark:bg-wall-800/80 border border-line/70 dark:border-wall-700/70 p-2">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-ink-500 dark:text-slate-400">
                    <AlertTriangle size={10} className="text-warn" />
                    هشدار فعال
                  </div>
                  <div className="mt-0.5 font-mono text-[13px] font-black" style={{ color: provData.activeAlerts > 0 ? '#E5484D' : 'var(--color-ok)' }}>
                    {toPersianDigits(provData.activeAlerts)} <span className="text-[8px] font-bold text-ink-500">مورد</span>
                  </div>
                </div>
              </div>

              {/* نوارهای KPI */}
              <div className="flex flex-col gap-3 px-4 py-3 overflow-y-auto flex-1">
                {bars.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-[9px] mb-1">
                      <span className="font-bold text-ink-600 dark:text-slate-300">{b.label}</span>
                      <span className="font-mono font-black" style={{ color: b.color }}>
                        {toPersianDigits(b.display)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-line/80 dark:bg-wall-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(Math.max(b.pct, 2), 100)}%`, backgroundColor: b.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* اقدام‌ها */}
              <div className="px-4 pb-4 pt-1 border-t border-line/70 dark:border-wall-700/70">
                {onOpenGeoportal && (
                  <button
                    onClick={() => onOpenGeoportal(selectedProvince)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-800 hover:bg-brand-700 dark:bg-signal-500 dark:hover:bg-signal-400 text-white dark:text-wall-950 text-[10px] font-black px-3 py-2.5 shadow-[var(--shadow-card)] transition-all hover:shadow-lg active:scale-[0.97] cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    مشاهده در ژئوپرتال
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Legend برای choropleth */}
      {mapMode === 'choropleth' && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-xl bg-surface/90 dark:bg-wall-850/90 backdrop-blur-md border border-line dark:border-wall-700 px-3 py-2 shadow-[var(--shadow-card)] pointer-events-none">
          <span className="text-[9px] font-bold text-ink-500 dark:text-slate-400">کم</span>
          <div
            className="h-2 w-28 rounded-full"
            style={{ background: 'linear-gradient(to left, #BEE1CB, #3C9C6A, #12402D)' }}
          />
          <span className="text-[9px] font-bold text-ink-500 dark:text-slate-400">زیاد</span>
        </div>
      )}
    </div>
  );
}
