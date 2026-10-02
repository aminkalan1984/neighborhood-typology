import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import am5themes_Dark from '@amcharts/amcharts5/themes/Dark';
import {
  BarChart3,
  Database,
  Info,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  loadRaceDataset,
  RACE_INDICATORS,
  RaceDataset,
  RaceIndicatorKey,
} from '../data/provinceIndicatorRace';

const STEP_DURATION = 2000;
const DEFAULT_VISIBLE_BARS = 12;

interface ProvinceIndicatorRaceProps {
  isWallMode?: boolean;
}

interface ChartController {
  root: am5.Root;
  updateFrame: (index: number, animate: boolean) => void;
  setVisibleBars: (count: number) => void;
}

function compactNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  const suffix = absolute >= 1_000_000_000
    ? 'B'
    : absolute >= 1_000_000
      ? 'M'
      : absolute >= 1_000
        ? 'K'
        : '';
  const divisor = suffix === 'B' ? 1_000_000_000 : suffix === 'M' ? 1_000_000 : suffix === 'K' ? 1_000 : 1;
  const fractionDigits = suffix ? Math.min(decimals, 1) : decimals;
  return `${(value / divisor).toLocaleString('fa-IR', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  })}${suffix}`;
}

function makeInitialRows(dataset: RaceDataset) {
  const provinces = new Set<string>();
  for (const frame of Object.values(dataset.frames)) {
    for (const point of frame) provinces.add(point.province);
  }
  return Array.from(provinces).sort((a, b) => a.localeCompare(b, 'fa')).map((province) => ({
    province,
    value: 0,
  }));
}

export default function ProvinceIndicatorRace({ isWallMode = false }: ProvinceIndicatorRaceProps) {
  const [indicatorKey, setIndicatorKey] = useState<RaceIndicatorKey>('population');
  const [dataset, setDataset] = useState<RaceDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [visibleBars, setVisibleBars] = useState(DEFAULT_VISIBLE_BARS);
  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ChartController | null>(null);
  const visibleBarsRef = useRef(visibleBars);

  useEffect(() => {
    visibleBarsRef.current = visibleBars;
    controllerRef.current?.setVisibleBars(visibleBars);
  }, [visibleBars]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDataset(null);
    setFrameIndex(0);
    setIsPlaying(true);
    loadRaceDataset(indicatorKey)
      .then((nextDataset) => {
        if (!cancelled) setDataset(nextDataset);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'خطا در بارگذاری داده‌های سری‌زمانی');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [indicatorKey]);

  useLayoutEffect(() => {
    if (!dataset || !chartElementRef.current) return;
    controllerRef.current?.root.dispose();

    const root = am5.Root.new(chartElementRef.current);
    root.setThemes([
      am5themes_Animated.new(root),
      ...(isWallMode ? [am5themes_Dark.new(root)] : []),
    ]);
    root.numberFormatter.setAll({
      numberFormat: '#.#a',
      bigNumberPrefixes: [
        { number: 1e3, suffix: 'K' },
        { number: 1e6, suffix: 'M' },
        { number: 1e9, suffix: 'B' },
      ],
      smallNumberPrefixes: [],
    });

    const chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: false,
      panY: true,
      wheelX: 'none',
      wheelY: 'none',
      paddingLeft: 0,
      paddingRight: 12,
      paddingTop: 4,
      paddingBottom: 0,
    }));
    chart.zoomOutButton.set('forceHidden', true);

    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 22,
      inversed: true,
      minorGridEnabled: true,
    });
    yRenderer.grid.template.set('forceHidden', true);
    yRenderer.labels.template.setAll({
      fontSize: 10,
      fill: root.interfaceColors.get('text'),
      fontFamily: 'inherit',
      oversizedBehavior: 'truncate',
      width: 92,
      maxWidth: 92,
      ellipsis: '…',
      textAlign: 'right',
      centerX: am5.percent(100),
    });

    const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
      maxDeviation: 0,
      categoryField: 'province',
      renderer: yRenderer,
    }));

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 54,
    });
    xRenderer.grid.template.setAll({
      stroke: root.interfaceColors.get('grid'),
      strokeOpacity: 0.18,
      strokeDasharray: [3, 3],
    });
    xRenderer.labels.template.setAll({
      fontSize: 10,
      fill: root.interfaceColors.get('alternativeText'),
      fontFamily: 'inherit',
    });
    const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
      maxDeviation: 0,
      min: 0,
      strictMinMax: true,
      extraMax: 0.12,
      numberFormat: '#.#a',
      renderer: xRenderer,
    }));
    xAxis.set('interpolationDuration', STEP_DURATION / 10);
    xAxis.set('interpolationEasing', am5.ease.linear);

    const series = chart.series.push(am5xy.ColumnSeries.new(root, {
      name: dataset.indicator.label,
      xAxis,
      yAxis,
      valueXField: 'value',
      categoryYField: 'province',
      sequencedInterpolation: false,
      tooltip: am5.Tooltip.new(root, {
        labelText: '{categoryY}: {valueX}',
      }),
    }));
    series.columns.template.setAll({
      cornerRadiusBR: 6,
      cornerRadiusTR: 6,
      strokeOpacity: 0,
      height: am5.percent(72),
      focusable: true,
      role: 'figure',
      ariaLabel: '{categoryY}: {valueX}',
    });
    series.columns.template.adapters.add('fill', (fill, target) => (
      chart.get('colors').getIndex(series.columns.indexOf(target))
    ));
    series.columns.template.adapters.add('stroke', (stroke, target) => (
      chart.get('colors').getIndex(series.columns.indexOf(target))
    ));
    series.bullets.push(() => am5.Bullet.new(root, {
      locationX: 1,
      sprite: am5.Label.new(root, {
        text: '{valueXWorking.formatNumber("#.0a")}',
        fill: root.interfaceColors.get('text'),
        centerX: am5.percent(0),
        centerY: am5.percent(50),
        dx: 7,
        fontSize: 10,
        fontWeight: '700',
        populateText: true,
      }),
    }));

    const yearLabel = chart.plotContainer.children.push(am5.Label.new(root, {
      text: String(dataset.years[0] ?? ''),
      fontSize: '4em',
      fontWeight: '800',
      fill: root.interfaceColors.get('text'),
      opacity: 0.12,
      x: am5.percent(100),
      y: am5.percent(100),
      centerX: am5.percent(100),
      centerY: am5.percent(100),
      fontFamily: 'inherit',
    }));

    const initialRows = makeInitialRows(dataset);
    yAxis.data.setAll(initialRows);
    series.data.setAll(initialRows);

    const getSeriesItem = (province: string) => series.dataItems.find(
      (dataItem) => dataItem.get('categoryY') === province,
    );

    const sortCategoryAxis = () => {
      series.dataItems.sort((left, right) => (
        (right.get('valueX') ?? 0) - (left.get('valueX') ?? 0)
      ));
      am5.array.each(yAxis.dataItems, (dataItem) => {
        const seriesDataItem = getSeriesItem(dataItem.get('category'));
        if (!seriesDataItem) return;
        const index = series.dataItems.indexOf(seriesDataItem);
        const previousIndex = dataItem.get('index', 0);
        const deltaPosition = (index - previousIndex) / Math.max(series.dataItems.length, 1);
        if (previousIndex !== index) {
          dataItem.set('index', index);
          dataItem.set('deltaPosition', -deltaPosition);
          dataItem.animate({
            key: 'deltaPosition',
            to: 0,
            duration: STEP_DURATION / 2,
            easing: am5.ease.out(am5.ease.cubic),
          });
        }
      });
      yAxis.dataItems.sort((left, right) => (
        left.get('index', 0) - right.get('index', 0)
      ));
    };

    const setVisibleBars = (count: number) => {
      const nonZero = series.dataItems.filter((dataItem) => (dataItem.get('valueX') ?? 0) > 0).length;
      const visible = Math.min(Math.max(count, 1), Math.max(nonZero, 1));
      yAxis.zoom(0, visible / Math.max(yAxis.dataItems.length, 1));
    };

    const updateFrame = (index: number, animate: boolean) => {
      const year = dataset.years[index] ?? dataset.years[0];
      const values = new Map<string, number>(
        (dataset.frames[String(year)] ?? []).map((point): [string, number] => [point.province, point.value]),
      );
      for (const dataItem of series.dataItems) {
        const province = String(dataItem.get('categoryY') ?? '');
        const value = values.get(province) ?? 0;
        if (animate) {
          dataItem.animate({ key: 'valueX', to: value, duration: STEP_DURATION, easing: am5.ease.linear });
          dataItem.animate({ key: 'valueXWorking', to: value, duration: STEP_DURATION, easing: am5.ease.linear });
        } else {
          dataItem.set('valueX', value);
          dataItem.set('valueXWorking', value);
        }
      }
      yearLabel.set('text', String(year));
      sortCategoryAxis();
      setVisibleBars(visibleBarsRef.current);
    };

    const sortTimer = window.setInterval(sortCategoryAxis, 90);
    const controller: ChartController = {
      root,
      updateFrame,
      setVisibleBars,
    };
    controllerRef.current = controller;
    updateFrame(0, false);
    series.appear(700);
    chart.appear(700, 80);

    return () => {
      window.clearInterval(sortTimer);
      if (controllerRef.current === controller) controllerRef.current = null;
      root.dispose();
    };
  }, [dataset, isWallMode]);

  useEffect(() => {
    if (!dataset || !isPlaying || dataset.years.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current >= dataset.years.length - 1 ? 0 : current + 1;
        controllerRef.current?.updateFrame(next, true);
        return next;
      });
    }, STEP_DURATION);
    return () => window.clearInterval(timer);
  }, [dataset, isPlaying]);

  const selectedIndicator = RACE_INDICATORS.find((item) => item.key === indicatorKey) ?? RACE_INDICATORS[0];
  const currentYear = dataset?.years[frameIndex] ?? '—';
  const currentFrame = dataset?.frames[String(currentYear)] ?? [];
  const leadingProvince = currentFrame[0];

  const jumpToFrame = (nextIndex: number) => {
    const bounded = Math.max(0, Math.min(nextIndex, (dataset?.years.length ?? 1) - 1));
    setFrameIndex(bounded);
    controllerRef.current?.updateFrame(bounded, false);
  };

  return (
    <section className={`lg:col-span-6 rounded-[var(--radius-panel)] p-4 flex flex-col gap-3 relative overflow-hidden border transition-all ${isWallMode ? 'dark bg-wall-900/80 border-wall-700' : 'bg-surface border-line shadow-[var(--shadow-card)]'}`}>
      <header className="flex flex-col gap-3 border-b border-line dark:border-wall-700 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="icon-tile"><BarChart3 size={18} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-xs font-black text-ink-900 dark:text-slate-100">روند متحرک شاخص‌های استانی</h2>
                <span className="text-[9px] bg-signal-400 text-brand-900 px-1.5 py-0.5 rounded font-extrabold">BAR RACE</span>
              </div>
              <p className="text-[10px] text-ink-400 dark:text-slate-400 mt-1 leading-relaxed">
                رتبه و فاصله استان‌ها در طول سال‌های واقعی داده، با مرتب‌سازی زنده
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-ink-400 dark:text-slate-400 shrink-0">
            <Sparkles size={13} className="text-signal-500" />
            <span>{dataset?.provinceCount ?? 31} استان</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
          <label className="flex items-center gap-2 bg-brand-50 dark:bg-wall-800 border border-line dark:border-wall-700 rounded-xl px-2.5 py-2">
            <SlidersHorizontal size={14} className="text-brand-800 dark:text-signal-400 shrink-0" />
            <span className="sr-only">انتخاب شاخص</span>
            <select
              value={indicatorKey}
              onChange={(event) => setIndicatorKey(event.target.value as RaceIndicatorKey)}
              className="w-full bg-transparent text-[11px] font-bold text-brand-800 dark:text-signal-400 outline-none cursor-pointer"
              aria-label="انتخاب شاخص برای نمودار متحرک"
            >
              {RACE_INDICATORS.map((indicator) => (
                <option key={indicator.key} value={indicator.key}>{indicator.label}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-end gap-1.5">
            <label className="flex items-center gap-1.5 text-[10px] text-ink-500 dark:text-slate-400">
              <span>نمایش</span>
              <select
                value={visibleBars}
                onChange={(event) => setVisibleBars(Number(event.target.value))}
                className="bg-brand-50 dark:bg-wall-800 border border-line dark:border-wall-700 rounded-lg px-1.5 py-1 font-bold text-brand-800 dark:text-signal-400 outline-none"
                aria-label="تعداد استان‌های قابل نمایش"
              >
                {[8, 12, 20, 31].map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setIsPlaying((playing) => !playing)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 hover:bg-brand-700 text-signal-400 px-2.5 py-1.5 text-[10px] font-bold transition-colors"
              aria-label={isPlaying ? 'توقف پخش نمودار' : 'پخش نمودار'}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              {isPlaying ? 'توقف' : 'پخش'}
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); jumpToFrame(0); }}
              className="inline-flex items-center justify-center rounded-lg border border-line dark:border-wall-700 text-ink-500 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-wall-800 p-1.5 transition-colors"
              aria-label="بازنشانی نمودار"
              title="بازنشانی"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 text-[10px] text-ink-500 dark:text-slate-400">
        <div className="flex items-center gap-2 min-w-0">
          <Database size={13} className="text-brand-800 dark:text-signal-400 shrink-0" />
          <span className="truncate" title={selectedIndicator.sourceDetail}>{selectedIndicator.source}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-brand-800 dark:text-signal-400">{currentYear}</span>
          <span className="size-1.5 rounded-full bg-ok animate-pulse" />
          <span>{isPlaying ? 'پخش خودکار ۲ ثانیه‌ای' : 'پخش متوقف است'}</span>
        </div>
      </div>

      <div className="relative h-[320px] sm:h-[350px] w-full rounded-2xl border border-line/70 dark:border-wall-700 bg-paper/50 dark:bg-wall-950/60 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface/90 dark:bg-wall-900/90 text-ink-500 dark:text-slate-300">
            <span className="size-8 rounded-full border-2 border-brand-200 border-t-brand-800 animate-spin" />
            <span className="text-xs font-bold">در حال آماده‌سازی داده‌های استان‌ها…</span>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-5 text-center text-danger">
            <Info size={22} />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}
        <div ref={chartElementRef} className="h-full w-full" aria-label="نمودار مسابقه‌ای تغییر جایگاه استان‌ها" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] text-ink-500 dark:text-slate-400 shrink-0">سال</span>
        <input
          type="range"
          min={0}
          max={Math.max((dataset?.years.length ?? 1) - 1, 0)}
          value={Math.min(frameIndex, Math.max((dataset?.years.length ?? 1) - 1, 0))}
          onChange={(event) => { setIsPlaying(false); jumpToFrame(Number(event.target.value)); }}
          className="w-full accent-brand-800 dark:accent-signal-400"
          aria-label="انتخاب سال نمودار"
        />
        <span className="min-w-14 text-left text-xs font-black text-brand-800 dark:text-signal-400 font-mono">{currentYear}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-xl bg-brand-50 dark:bg-wall-800 border border-line dark:border-wall-700 px-3 py-2">
          <span className="block text-ink-400 dark:text-slate-500 mb-1">شاخص منتخب</span>
          <strong className="block text-brand-800 dark:text-signal-400 truncate">{selectedIndicator.label}</strong>
        </div>
        <div className="rounded-xl bg-brand-50 dark:bg-wall-800 border border-line dark:border-wall-700 px-3 py-2">
          <span className="block text-ink-400 dark:text-slate-500 mb-1">پیشتاز قاب جاری</span>
          <strong className="block text-brand-800 dark:text-signal-400 truncate">{leadingProvince?.province ?? '—'}</strong>
        </div>
        <div className="rounded-xl bg-brand-50 dark:bg-wall-800 border border-line dark:border-wall-700 px-3 py-2">
          <span className="block text-ink-400 dark:text-slate-500 mb-1">مقدار پیشتاز</span>
          <strong className="block text-brand-800 dark:text-signal-400 font-mono">{leadingProvince ? `${compactNumber(leadingProvince.value, selectedIndicator.decimals)} ${selectedIndicator.unit}` : '—'}</strong>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-ink-400 dark:text-slate-500" title={selectedIndicator.sourceDetail}>
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>{selectedIndicator.description} · داده‌های خام/استخراج‌شده: {selectedIndicator.sourceDetail}</span>
      </p>
    </section>
  );
}
