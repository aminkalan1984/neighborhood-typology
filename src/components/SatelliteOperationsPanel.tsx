import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, Cloud, Columns2, Crosshair,
  Database, Gauge, Image, Layers3, Loader2, MapPin, Palette, Play, RefreshCw,
  Satellite, ScanSearch, Search, SlidersHorizontal, Sparkles, X, XCircle,
} from 'lucide-react';
import {
  createSatelliteChange,
  createSatelliteComposite,
  createSatelliteProcessingJob,
  createSatelliteSegmentation,
  getSatelliteConnectorHealth,
  getSatelliteAlerts,
  getSatelliteAuditEvents,
  getSatelliteStatusSummary,
  getSatelliteTimeline,
  getSatelliteZonalStatistics,
  listSatelliteProcessingJobs,
  replaySatelliteProcessingJob,
  retrySatelliteProcessingJob,
  acknowledgeSatelliteAlert,
  cleanupSatelliteTileCache,
  satelliteArtifactTileUrl,
  searchSatelliteMetadata,
  type SatelliteArtifact,
  type SatelliteCollection,
  type SatelliteIndexName,
  type SatelliteItemMetadata,
  type SatelliteProcessingJob,
  type SatelliteProviderName,
  type SatelliteStatusSummary,
  type SatelliteAlertRecord,
  type SatelliteAuditEvent,
  type SatelliteTilePalette,
} from '../lib/satelliteApi';

type MapRef = { current: L.Map | null };
type RangeMode = 'full' | 'vegetation' | 'data';
type PanelTab = 'search' | 'jobs' | 'timeline' | 'status';
type ManagedSatelliteLayer = L.TileLayer & { _araSatellite?: { key: string; jobId: string; artifactName: string; role: string } };

export interface SatelliteMapLayerDescriptor {
  jobId: string;
  artifactName: string;
  tileUrl: string;
  bounds: [number, number, number, number];
  opacity: number;
  attribution: string;
}

const IRAN_BBOX: [number, number, number, number] = [44, 25, 63, 40];
const NORMALIZED_INDICES = new Set(['ndvi', 'ndwi', 'mndwi', 'ndbi', 'ndmi', 'nbr']);
const PALETTE_COLORS: Record<SatelliteTilePalette, string[]> = {
  ndvi: ['#b41e2d', '#f59e0b', '#fafad2', '#16a34a', '#054b2d'],
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  magma: ['#000004', '#51127c', '#b73779', '#fc8961', '#fcfdbf'],
  gray: ['#191919', '#f5f5f5'],
  water: ['#7c4a30', '#f1eedc', '#3899d3', '#053061'],
  change: ['#7f1d1d', '#f8b88b', '#f5f5f5', '#86efac', '#065f46'],
};

const INDEX_OPTIONS: Array<{ value: SatelliteIndexName; label: string; description: string; optical: boolean }> = [
  { value: 'rgb', label: 'RGB', description: 'رنگ طبیعی', optical: true },
  { value: 'false_color', label: 'False Color', description: 'ترکیب NIR/Red/Green', optical: true },
  { value: 'ndvi', label: 'NDVI', description: 'پوشش و سلامت گیاه', optical: true },
  { value: 'ndwi', label: 'NDWI', description: 'آب سطحی', optical: true },
  { value: 'mndwi', label: 'MNDWI', description: 'آب در بافت ساخته‌شده', optical: true },
  { value: 'ndbi', label: 'NDBI', description: 'سطح مصنوعی و ساخت‌وساز', optical: true },
  { value: 'ndmi', label: 'NDMI', description: 'رطوبت پوشش', optical: true },
  { value: 'nbr', label: 'NBR', description: 'سوختگی و آتش', optical: true },
  { value: 'vv', label: 'VV', description: 'بازپراکنش هم‌قطب', optical: false },
  { value: 'vh', label: 'VH', description: 'بازپراکنش متقاطع', optical: false },
  { value: 'vv_vh_ratio', label: 'VV/VH', description: 'نسبت قطبش راداری', optical: false },
];

const COLLECTIONS: Array<{ value: SatelliteCollection; label: string; providerHint: string }> = [
  { value: 'sentinel-2-l2a', label: 'Sentinel-2 L2A', providerHint: 'اپتیکی ۱۰ متر' },
  { value: 'sentinel-1-grd', label: 'Sentinel-1 GRD', providerHint: 'راداری؛ مستقل از ابر' },
  { value: 'hls-s30', label: 'NASA HLS S30', providerHint: 'سری زمانی هماهنگ' },
  { value: 'hls-l30', label: 'NASA HLS L30', providerHint: 'سری زمانی Landsat' },
  { value: 'modis-nrt', label: 'NASA LANCE NRT', providerHint: 'پایش و هشدار سریع' },
];

function bboxFromMap(mapRef: MapRef): [number, number, number, number] {
  const bounds = mapRef.current?.getBounds();
  return bounds ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] : IRAN_BBOX;
}

function isoDateTime(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

function statusLabel(status: SatelliteProcessingJob['status']): string {
  return ({ queued: 'در صف', downloading: 'دریافت', processing: 'پردازش', ready: 'آماده', failed: 'ناموفق' })[status];
}

function statusTone(status: SatelliteProcessingJob['status']): string {
  return status === 'ready' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : status === 'failed' ? 'text-red-700 bg-red-50 border-red-200' : status === 'processing' || status === 'downloading' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-amber-700 bg-amber-50 border-amber-200';
}

function paletteForArtifact(artifact: SatelliteArtifact, selected: SatelliteTilePalette): SatelliteTilePalette {
  if (artifact.name.startsWith('change_')) return 'change';
  if (artifact.name.includes('ndwi')) return 'water';
  if (artifact.kind === 'classification') return 'viridis';
  return selected;
}

function bytesLabel(bytes: number): string {
  return bytes > 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export interface SatelliteOperationsPanelProps {
  mapRef: MapRef;
  onClose?: () => void;
  onActiveLayerChange?: (layer: SatelliteMapLayerDescriptor | null) => void;
}

export default function SatelliteOperationsPanel({ mapRef, onClose, onActiveLayerChange }: SatelliteOperationsPanelProps) {
  const now = useMemo(() => new Date(), []);
  const compareLayers = useRef<{ before?: ManagedSatelliteLayer; after?: ManagedSatelliteLayer }>({});
  const [tab, setTab] = useState<PanelTab>('search');
  const [bbox, setBbox] = useState<[number, number, number, number]>(() => bboxFromMap(mapRef));
  const [collection, setCollection] = useState<SatelliteCollection>('sentinel-2-l2a');
  const [start, setStart] = useState(() => isoDateTime(new Date(now.getTime() - 72 * 60 * 60 * 1000)));
  const [end, setEnd] = useState(() => isoDateTime(now));
  const [cloudCover, setCloudCover] = useState('40');
  const [provider, setProvider] = useState<'auto' | SatelliteProviderName>('auto');
  const [items, setItems] = useState<SatelliteItemMetadata[]>([]);
  const [selectedItem, setSelectedItem] = useState<SatelliteItemMetadata | null>(null);
  const [indices, setIndices] = useState<SatelliteIndexName[]>(['rgb', 'ndvi']);
  const [jobs, setJobs] = useState<SatelliteProcessingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<SatelliteProcessingJob | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getSatelliteConnectorHealth>> | null>(null);
  const [summary, setSummary] = useState<SatelliteStatusSummary | null>(null);
  const [alerts, setAlerts] = useState<SatelliteAlertRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<SatelliteAuditEvent[]>([]);
  const [timelineArtifact, setTimelineArtifact] = useState('ndvi');
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof getSatelliteTimeline>> | null>(null);
  const [beforeJobId, setBeforeJobId] = useState('');
  const [afterJobId, setAfterJobId] = useState('');
  const [compositeIds, setCompositeIds] = useState<string[]>([]);
  const [swipe, setSwipe] = useState(50);
  const [zonal, setZonal] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tilePalette, setTilePalette] = useState<SatelliteTilePalette>('ndvi');
  const [rangeMode, setRangeMode] = useState<RangeMode>('vegetation');
  const [tileOpacity, setTileOpacity] = useState(80);

  const optical = collection !== 'sentinel-1-grd';
  const readyJobs = useMemo(() => jobs.filter((job) => job.status === 'ready'), [jobs]);

  const artifactRange = useCallback((artifact: SatelliteArtifact): { min: number; max: number } => {
    if (artifact.band_count && artifact.band_count >= 3) return { min: 0, max: 255 };
    const statistics = artifact.statistics;
    if (!NORMALIZED_INDICES.has(artifact.name) && !artifact.name.startsWith('change_')) {
      const min = statistics?.min ?? 0; const max = statistics?.max ?? 1;
      return min < max ? { min, max } : { min: min - 1, max: max + 1 };
    }
    if (artifact.name.startsWith('change_')) return { min: -0.5, max: 0.5 };
    if (rangeMode === 'vegetation') return { min: -0.2, max: 0.8 };
    if (rangeMode === 'data' && statistics && statistics.min < statistics.max) return { min: statistics.min, max: statistics.max };
    return { min: -1, max: 1 };
  }, [rangeMode]);

  const layerDescriptor = useCallback((job: SatelliteProcessingJob, artifact: SatelliteArtifact, opacity = tileOpacity / 100): SatelliteMapLayerDescriptor => ({
    jobId: job.job_id,
    artifactName: artifact.name,
    tileUrl: satelliteArtifactTileUrl(job.job_id, artifact.name, { palette: paletteForArtifact(artifact, tilePalette), ...artifactRange(artifact) }),
    bounds: artifact.bounds,
    opacity,
    attribution: `Satellite COG / ARA · ${job.collection}`,
  }), [artifactRange, tileOpacity, tilePalette]);

  const findManagedLayer = useCallback((jobId: string, artifactName: string, role = 'primary'): ManagedSatelliteLayer | null => {
    const map = mapRef.current; if (!map) return null;
    const key = `${role}:${jobId}:${artifactName}`; let found: ManagedSatelliteLayer | null = null;
    map.eachLayer((candidate) => { const managed = candidate as ManagedSatelliteLayer; if (managed._araSatellite?.key === key) found = managed; });
    return found;
  }, [mapRef]);

  const refreshAll = useCallback(async () => {
    const [jobResult, connector, status, alertResult, auditResult] = await Promise.all([
      listSatelliteProcessingJobs({ limit: 100 }), getSatelliteConnectorHealth(), getSatelliteStatusSummary(), getSatelliteAlerts({ limit: 30 }), getSatelliteAuditEvents({ limit: 40 }),
    ]);
    setJobs(jobResult.jobs); setHealth(connector); setSummary(status); setAlerts(alertResult.alerts); setAuditEvents(auditResult.events);
    setSelectedJob((current) => current ? jobResult.jobs.find((job) => job.job_id === current.job_id) ?? current : current);
  }, []);

  const refreshTimeline = useCallback(async () => {
    setTimeline(await getSatelliteTimeline({ artifact: timelineArtifact, bbox, limit: 100 }));
  }, [bbox, timelineArtifact]);

  useEffect(() => {
    let active = true;
    void refreshAll().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'دریافت وضعیت سامانه ناموفق بود'); });
    const timer = window.setInterval(() => { void refreshAll().catch(() => undefined); }, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refreshAll]);

  useEffect(() => { if (tab === 'timeline') void refreshTimeline().catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در timeline')); }, [refreshTimeline, tab]);

  useEffect(() => {
    setIndices(optical ? ['rgb', 'ndvi'] : ['vv', 'vh', 'vv_vh_ratio']); setSelectedItem(null);
  }, [optical]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    map.eachLayer((candidate) => { const managed = candidate as ManagedSatelliteLayer; if (managed._araSatellite?.role === 'primary') managed.setOpacity(tileOpacity / 100); });
  }, [mapRef, tileOpacity]);

  useEffect(() => {
    const container = compareLayers.current.after?.getContainer();
    if (container) container.style.clipPath = `inset(0 0 0 ${swipe}%)`;
  }, [swipe]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    map.eachLayer((candidate) => {
      const managed = candidate as ManagedSatelliteLayer; const metadata = managed._araSatellite;
      if (!metadata || metadata.role !== 'primary') return;
      const job = jobs.find((item) => item.job_id === metadata.jobId); const artifact = job?.artifacts.find((item) => item.name === metadata.artifactName);
      if (!job || !artifact) return;
      const descriptor = layerDescriptor(job, artifact, tileOpacity / 100);
      managed.setUrl(descriptor.tileUrl, false); managed.redraw();
      onActiveLayerChange?.(descriptor);
    });
  }, [artifactRange, jobs, layerDescriptor, mapRef, onActiveLayerChange, tileOpacity, tilePalette]);

  const runSearch = async () => {
    setBusy('search'); setError(null); setNotice(null);
    try {
      const result = await searchSatelliteMetadata({ bbox, collections: [collection], datetime: `${new Date(start).toISOString()}/${new Date(end).toISOString()}`, maxCloudCover: optical ? Number(cloudCover) : undefined, maxAgeHours: collection.startsWith('hls') ? 240 : 72, minimumCoverage: 0.5, purpose: collection.startsWith('hls') ? 'time-series' : collection === 'modis-nrt' ? 'alert' : optical ? 'optical' : 'radar', provider, limit: 20 });
      setItems(result.items); setSelectedItem(result.recommended);
      setNotice(result.fallback ?? (result.recommended ? `بهترین صحنه با امتیاز ${result.recommended.selection_score?.toFixed(1)} انتخاب شد.` : 'صحنهٔ قابل‌استفاده پیدا نشد.'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'جست‌وجوی STAC ناموفق بود'); } finally { setBusy(null); }
  };

  const createJob = async () => {
    if (!selectedItem) { setError('ابتدا یک صحنه را انتخاب کنید.'); return; }
    setBusy('job'); setError(null);
    try {
      const job = await createSatelliteProcessingJob({ metadata_id: selectedItem.metadata_id, aoi: { bbox, geometry: selectedItem.geometry }, indices });
      setSelectedJob(job); setJobs((current) => [job, ...current.filter((candidate) => candidate.job_id !== job.job_id)]); setTab('jobs'); setNotice('job ساخته شد؛ وضعیت آن زنده به‌روزرسانی می‌شود.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ساخت job ناموفق بود'); } finally { setBusy(null); }
  };

  const addArtifactToMap = (job: SatelliteProcessingJob, artifactName: string, role = 'primary', opacity = tileOpacity / 100, zIndex = 450): ManagedSatelliteLayer | null => {
    const map = mapRef.current;
    const artifact = job.artifacts.find((candidate) => candidate.name === artifactName); if (!artifact) return null;
    const existing = findManagedLayer(job.job_id, artifactName, role);
    if (existing) { map?.removeLayer(existing); if (role === 'primary') onActiveLayerChange?.(null); return null; }
    const descriptor = layerDescriptor(job, artifact, opacity);
    if (!map) {
      if (role === 'primary') onActiveLayerChange?.(descriptor);
      setNotice('لایه برای نمایش سه‌بعدی انتخاب شد.');
      return null;
    }
    const bounds = L.latLngBounds([artifact.bounds[1], artifact.bounds[0]], [artifact.bounds[3], artifact.bounds[2]]);
    const layer = L.tileLayer(descriptor.tileUrl, { opacity, maxZoom: 24, tileSize: 256, zIndex, bounds, noWrap: true, attribution: descriptor.attribution }) as ManagedSatelliteLayer;
    layer._araSatellite = { key: `${role}:${job.job_id}:${artifactName}`, jobId: job.job_id, artifactName, role }; layer.addTo(map);
    if (role === 'primary') onActiveLayerChange?.(descriptor);
    if (role === 'primary') map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    return layer;
  };

  const startComparison = () => {
    const map = mapRef.current; const before = jobs.find((job) => job.job_id === beforeJobId); const after = jobs.find((job) => job.job_id === afterJobId);
    if (!map || !before || !after) { setError('دو job آماده برای مقایسه انتخاب کنید.'); return; }
    for (const layer of Object.values(compareLayers.current) as ManagedSatelliteLayer[]) {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    }
    const beforeLayer = addArtifactToMap(before, timelineArtifact, 'compare-before', 1, 460) ?? undefined;
    const afterLayer = addArtifactToMap(after, timelineArtifact, 'compare-after', 1, 470) ?? undefined;
    compareLayers.current = { before: beforeLayer, after: afterLayer };
    if (afterLayer?.getContainer()) afterLayer.getContainer()!.style.clipPath = `inset(0 0 0 ${swipe}%)`;
    const artifact = after.artifacts.find((candidate) => candidate.name === timelineArtifact); if (artifact) map.fitBounds([[artifact.bounds[1], artifact.bounds[0]], [artifact.bounds[3], artifact.bounds[2]]], { maxZoom: 15 });
    setNotice('مقایسهٔ swipe فعال شد؛ لغزنده را جابه‌جا کنید.');
  };

  const runChange = async () => {
    if (!beforeJobId || !afterJobId) { setError('دو تاریخ را انتخاب کنید.'); return; }
    setBusy('change');
    try { const job = await createSatelliteChange({ beforeJobId, afterJobId, artifact: timelineArtifact, aoi: { bbox } }); setJobs((current) => [job, ...current]); setSelectedJob(job); setTab('jobs'); setNotice('لایهٔ تغییر ساخته شد.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تحلیل تغییر ناموفق بود'); } finally { setBusy(null); }
  };

  const runComposite = async () => {
    setBusy('composite');
    try { const job = await createSatelliteComposite({ jobIds: compositeIds, artifact: timelineArtifact, aoi: { bbox } }); setJobs((current) => [job, ...current]); setSelectedJob(job); setTab('jobs'); setNotice('ترکیب زمانی median ساخته شد.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ساخت composite ناموفق بود'); } finally { setBusy(null); }
  };

  const runZonal = async (job: SatelliteProcessingJob, artifact: SatelliteArtifact) => {
    setBusy('zonal');
    try { const result = await getSatelliteZonalStatistics({ jobId: job.job_id, artifact: artifact.name, aoi: { bbox } }); setZonal(result.statistics); setNotice('آمار مکانی ثبت و به catalog شواهد افزوده شد.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'آمار zonal ناموفق بود'); } finally { setBusy(null); }
  };

  const runSegmentation = async (job: SatelliteProcessingJob, artifact: SatelliteArtifact) => {
    setBusy('segment');
    try { const result = await createSatelliteSegmentation({ jobId: job.job_id, artifact: artifact.name, classes: 4, aoi: { bbox } }); setJobs((current) => [result, ...current]); setSelectedJob(result); setNotice('segmentation پایه ساخته شد؛ خروجی نیازمند ارزیابی انسانی است.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'segmentation ناموفق بود'); } finally { setBusy(null); }
  };

  const retryJob = async (job: SatelliteProcessingJob) => {
    setBusy('retry'); try { const retried = await retrySatelliteProcessingJob(job.job_id); setSelectedJob(retried); await refreshAll(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'تلاش مجدد ناموفق بود'); } finally { setBusy(null); }
  };

  const replayJob = async (job: SatelliteProcessingJob) => {
    setBusy('replay'); setError(null);
    try {
      const replayed = await replaySatelliteProcessingJob(job.job_id);
      setSelectedJob(replayed); setJobs((current) => [replayed, ...current]); setNotice('بازپخش job در صف پردازش قرار گرفت.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'بازپخش job ناموفق بود'); } finally { setBusy(null); }
  };

  const acknowledgeAlert = async (alert: SatelliteAlertRecord) => {
    try { await acknowledgeSatelliteAlert(alert.alert_id); setAlerts((current) => current.map((item) => item.alert_id === alert.alert_id ? { ...item, acknowledged_at: new Date().toISOString() } : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تأیید هشدار ناموفق بود'); }
  };

  const cleanupCache = async () => {
    setBusy('cache');
    try { const result = await cleanupSatelliteTileCache(); setNotice(`پاک‌سازی cache انجام شد: ${result.removed} tile حذف شد.`); await refreshAll(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'پاک‌سازی cache ناموفق بود'); } finally { setBusy(null); }
  };

  const selectedArtifacts = selectedJob?.artifacts ?? [];
  const timelineJobs = timeline?.entries.map((entry) => jobs.find((job) => job.job_id === entry.job_id)).filter((job): job is SatelliteProcessingJob => Boolean(job)) ?? [];

  return (
    <aside dir="rtl" className="absolute left-3 top-20 z-30 flex max-h-[calc(100%-112px)] w-[min(500px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-surface/95 text-ink-800 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line bg-brand-950 px-3 py-2.5 text-signal-400">
        <div className="flex items-center gap-2 text-xs font-black"><Satellite size={16} /><span>مرکز عملیات ماهواره‌ای</span></div>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10" aria-label="بستن"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-4 border-b border-line bg-paper text-[10px] font-black">
        {([
          ['search', 'جست‌وجو', Search], ['jobs', 'پردازش', Activity], ['timeline', 'زمان/تغییر', Columns2], ['status', 'وضعیت', Gauge],
        ] as const).map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex items-center justify-center gap-1 border-l border-line px-2 py-2 ${tab === key ? 'bg-brand-50 text-brand-800' : 'text-ink-500 hover:bg-surface'}`}><Icon size={12} />{label}</button>)}
      </div>

      <div className="max-h-[calc(100vh-205px)] space-y-2 overflow-y-auto p-2.5 text-[11px]">
        {tab === 'search' && <>
          <section className="rounded-xl border border-line bg-paper p-2.5">
            <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 font-black"><ScanSearch size={14} className="text-brand-800" /> کشف و انتخاب هوشمند</span><button onClick={() => setBbox(bboxFromMap(mapRef))} className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[10px] font-bold"><MapPin size={12} /> نمای فعلی</button></div>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="col-span-2">محصول<select value={collection} onChange={(event) => setCollection(event.target.value as SatelliteCollection)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5">{COLLECTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.providerHint}</option>)}</select></label>
              <label>از<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-1.5 py-1.5" /></label>
              <label>تا<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-1.5 py-1.5" /></label>
              <label>حد ابر (%)<input type="number" min="0" max="100" value={cloudCover} disabled={!optical} onChange={(event) => setCloudCover(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 disabled:opacity-50" /></label>
              <label>ارائه‌دهنده<select value={provider} onChange={(event) => setProvider(event.target.value as 'auto' | SatelliteProviderName)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5"><option value="auto">خودکار و امتیازی</option><option value="cdse">CDSE</option><option value="earth-search">Earth Search</option><option value="hls">NASA HLS</option><option value="nasa-lance">NASA LANCE</option></select></label>
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-ink-500"><span>{bbox[0].toFixed(2)}…{bbox[2].toFixed(2)}</span><span>{bbox[1].toFixed(2)}…{bbox[3].toFixed(2)}</span></div>
            <button onClick={() => void runSearch()} disabled={busy === 'search'} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 font-black text-signal-400 disabled:opacity-60">{busy === 'search' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} جست‌وجوی صحنه‌ها</button>
          </section>

          {items.length > 0 && <section className="space-y-1.5"><div className="flex justify-between px-1 font-black"><span>نتایج ({items.length})</span><span className="text-[9px] text-ink-400">مرتب‌شده با freshness/cloud/coverage/health</span></div>{items.map((item, index) => <button key={item.metadata_id} onClick={() => setSelectedItem(item)} className={`w-full rounded-xl border p-2 text-right ${selectedItem?.metadata_id === item.metadata_id ? 'border-brand-500 bg-brand-50' : 'border-line bg-paper hover:border-brand-300'}`}><div className="flex items-center justify-between gap-2"><span className="truncate font-black">{index === 0 && <span className="ml-1 text-emerald-700">★</span>}{item.item_id}</span><span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{item.selection_score?.toFixed(1) ?? '—'}</span></div><div className="mt-1 flex flex-wrap gap-x-2 text-[9px] text-ink-500"><span>{formatDate(item.datetime)}</span><span>{item.provider}</span>{item.cloud_cover != null && <span className="flex items-center gap-0.5"><Cloud size={10} />{item.cloud_cover.toFixed(1)}٪</span>}<span>{item.resolution_m ?? '—'}m</span><span>پوشش {Math.round((item.selection?.coverage_fraction ?? 0) * 100)}٪</span></div>{item.quicklook_url && selectedItem?.metadata_id === item.metadata_id && <img src={item.quicklook_url} alt="پیش‌نمایش صحنه" className="mt-2 h-28 w-full rounded-lg object-cover" loading="lazy" />}{selectedItem?.metadata_id === item.metadata_id && <div className="mt-1 text-[9px] text-ink-500">انتشار: {formatDate(item.published_datetime)} · تأخیر: {item.latency_minutes?.toFixed(0) ?? '—'} دقیقه · مجوز: {item.license ?? 'ثبت‌نشده'}</div>}</button>)}</section>}

          {selectedItem && <section className="rounded-xl border border-brand-200 bg-brand-50/50 p-2.5"><div className="mb-2 flex justify-between"><span className="font-black">خروجی‌های پردازش</span><span className="text-[9px] text-brand-700">{Object.keys(selectedItem.assets).length} asset</span></div><div className="grid grid-cols-2 gap-1.5">{INDEX_OPTIONS.filter((option) => option.optical === optical).map((option) => <label key={option.value} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 ${indices.includes(option.value) ? 'border-brand-400 bg-white' : 'border-line bg-surface'}`}><input type="checkbox" checked={indices.includes(option.value)} onChange={(event) => setIndices((current) => event.target.checked ? [...new Set([...current, option.value])] : current.filter((value) => value !== option.value))} className="accent-brand-800" /><span><strong className="block">{option.label}</strong><span className="block text-[9px] text-ink-500">{option.description}</span></span></label>)}</div><button onClick={() => void createJob()} disabled={busy === 'job' || indices.length === 0} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 font-black text-white disabled:opacity-50">{busy === 'job' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} ساخت job COG</button></section>}
        </>}

        {tab === 'jobs' && <>
          <section className="rounded-xl border border-line bg-paper p-2.5"><div className="mb-2 flex items-center justify-between"><span className="font-black">صف و وضعیت پردازش</span><button onClick={() => void refreshAll()}><RefreshCw size={13} /></button></div>{jobs.length === 0 ? <p className="py-4 text-center text-ink-400">هنوز job ثبت نشده است.</p> : <div className="space-y-1.5">{jobs.map((job) => <button key={job.job_id} onClick={() => setSelectedJob(job)} className={`w-full rounded-lg border p-2 text-right ${selectedJob?.job_id === job.job_id ? 'border-brand-400 bg-brand-50' : 'border-line bg-surface'}`}><div className="flex justify-between"><span className="font-mono text-[9px]">{job.job_id.slice(0, 8)} · {job.job_type ?? 'scene'}</span><span className={`rounded-full border px-1.5 text-[9px] font-bold ${statusTone(job.status)}`}>{statusLabel(job.status)}</span></div><div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-brand-600" style={{ width: `${job.progress}%` }} /></div><div className="mt-1 flex justify-between text-[9px] text-ink-500"><span>{job.collection}</span><span>{formatDate(job.updated_at)}</span></div></button>)}</div>}</section>
          {selectedJob && <section className="rounded-xl border border-line bg-surface p-2.5"><div className="flex justify-between"><span className="font-black">جزئیات job</span><span className={`rounded-full border px-2 py-0.5 text-[9px] ${statusTone(selectedJob.status)}`}>{statusLabel(selectedJob.status)}</span></div>{selectedJob.fallback_history?.length ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[9px] text-amber-800"><AlertTriangle size={12} className="ml-1 inline" />{selectedJob.fallback_history.length} failover در asset؛ منبع موفق: {String(selectedJob.result?.provider ?? '—')}</div> : null}{selectedJob.error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700"><XCircle size={13} className="ml-1 inline" />{selectedJob.error}</div>}{selectedJob.validation && <div className="mt-2 grid grid-cols-2 gap-1">{selectedJob.validation.checks.map((check) => <div key={check.name} title={check.message} className="flex items-center gap-1 rounded border border-line bg-paper px-1.5 py-1 text-[9px]"><CheckCircle2 size={11} className={check.status === 'passed' ? 'text-emerald-600' : check.status === 'failed' ? 'text-red-600' : 'text-amber-600'} /><span className="truncate">{check.name}</span></div>)}</div>}{selectedJob.status === 'failed' && <div className="mt-2 grid grid-cols-2 gap-1"><button onClick={() => void retryJob(selectedJob)} className="rounded-lg border border-brand-300 bg-brand-50 py-1.5 font-black text-brand-800">تلاش مجدد</button><button onClick={() => void replayJob(selectedJob)} disabled={busy === 'replay'} className="rounded-lg border border-amber-300 bg-amber-50 py-1.5 font-black text-amber-800">بازپخش</button></div>}{selectedJob.status === 'ready' && <div className="mt-2 space-y-1.5">{selectedArtifacts.map((artifact) => <div key={artifact.artifact_id} className="rounded-lg border border-line bg-paper p-2"><div className="flex items-center justify-between"><div><strong>{artifact.name.toUpperCase()}</strong><div className="text-[9px] text-ink-500">{Math.round(artifact.valid_fraction * 100)}٪ معتبر · {bytesLabel(artifact.bytes)} · {artifact.kind}</div></div><button onClick={() => addArtifactToMap(selectedJob, artifact.name)} className="rounded-lg bg-brand-800 px-2 py-1 text-[9px] font-black text-signal-400">{findManagedLayer(selectedJob.job_id, artifact.name) ? 'حذف' : 'نقشه'}</button></div><div className="mt-1 grid grid-cols-2 gap-1"><button onClick={() => void runZonal(selectedJob, artifact)} className="rounded border border-line bg-surface py-1 text-[9px] font-bold"><BarChart3 size={10} className="ml-1 inline" />آمار AOI</button>{artifact.kind === 'index' && <button onClick={() => void runSegmentation(selectedJob, artifact)} className="rounded border border-line bg-surface py-1 text-[9px] font-bold"><Sparkles size={10} className="ml-1 inline" />segmentation</button>}</div></div>)}</div>}{zonal && <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center text-[9px]"><span>میانگین<strong className="block">{zonal.mean?.toFixed(3)}</strong></span><span>میانه<strong className="block">{zonal.median?.toFixed(3)}</strong></span><span>پوشش<strong className="block">{Math.round((zonal.valid_fraction ?? 0) * 100)}٪</strong></span></div>}</section>}
          {selectedJob?.status === 'ready' && selectedArtifacts.some((artifact) => findManagedLayer(selectedJob.job_id, artifact.name)) && <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5"><div className="mb-2 flex items-center gap-1 font-black text-emerald-900"><Palette size={13} />کنترل نمایش</div><label className="block">شفافیت <span className="float-left">{tileOpacity}٪</span><input type="range" min="10" max="100" value={tileOpacity} onChange={(event) => setTileOpacity(Number(event.target.value))} className="mt-1 w-full accent-emerald-700" /></label><div className="mt-1 grid grid-cols-2 gap-1"><select value={tilePalette} onChange={(event) => setTilePalette(event.target.value as SatelliteTilePalette)} className="rounded border border-line bg-white px-2 py-1"><option value="ndvi">NDVI</option><option value="water">Water</option><option value="change">Change</option><option value="viridis">Viridis</option><option value="magma">Magma</option><option value="gray">Gray</option></select><select value={rangeMode} onChange={(event) => setRangeMode(event.target.value as RangeMode)} className="rounded border border-line bg-white px-2 py-1"><option value="vegetation">دامنه کاربردی</option><option value="full">دامنه کامل</option><option value="data">دامنه داده</option></select></div><div className="mt-1 h-2 rounded" style={{ background: `linear-gradient(90deg,${PALETTE_COLORS[tilePalette].join(',')})` }} /></section>}
        </>}

        {tab === 'timeline' && <>
          <section className="rounded-xl border border-line bg-paper p-2.5"><div className="flex items-end gap-2"><label className="flex-1">Artifact<select value={timelineArtifact} onChange={(event) => setTimelineArtifact(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5"><option value="ndvi">NDVI</option><option value="ndwi">NDWI</option><option value="mndwi">MNDWI</option><option value="ndbi">NDBI</option><option value="nbr">NBR</option><option value="vv">VV</option><option value="vh">VH</option></select></label><button onClick={() => void refreshTimeline()} className="rounded-lg border border-line bg-surface p-2"><RefreshCw size={13} /></button></div>{timeline?.temporal && <div className={`mt-2 rounded-lg border p-2 text-[9px] ${timeline.temporal.anomaly.status === 'anomaly' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>وضعیت ناهنجاری: {timeline.temporal.anomaly.status} · {timeline.temporal.anomaly.observations} مشاهده</div>}</section>
          <section className="rounded-xl border border-line bg-surface p-2.5"><div className="mb-2 font-black">انتخاب دو تاریخ</div><div className="grid grid-cols-2 gap-1"><select value={beforeJobId} onChange={(event) => setBeforeJobId(event.target.value)} className="rounded border border-line bg-paper px-1 py-1.5"><option value="">قبل…</option>{timelineJobs.map((job) => <option key={job.job_id} value={job.job_id}>{formatDate(job.completed_at ?? job.updated_at)}</option>)}</select><select value={afterJobId} onChange={(event) => setAfterJobId(event.target.value)} className="rounded border border-line bg-paper px-1 py-1.5"><option value="">بعد…</option>{timelineJobs.map((job) => <option key={job.job_id} value={job.job_id}>{formatDate(job.completed_at ?? job.updated_at)}</option>)}</select></div><div className="mt-2 grid grid-cols-2 gap-1"><button onClick={startComparison} className="rounded-lg bg-brand-800 py-1.5 font-black text-signal-400"><Columns2 size={12} className="ml-1 inline" />Swipe</button><button onClick={() => void runChange()} disabled={busy === 'change'} className="rounded-lg bg-emerald-700 py-1.5 font-black text-white">Change COG</button></div>{compareLayers.current.after && <label className="mt-2 block">مرز مقایسه <span className="float-left">{swipe}٪</span><input type="range" min="0" max="100" value={swipe} onChange={(event) => setSwipe(Number(event.target.value))} className="w-full accent-brand-800" /></label>}</section>
          <section className="rounded-xl border border-line bg-paper p-2.5"><div className="mb-1 font-black">ترکیب زمانی median</div><div className="max-h-36 space-y-1 overflow-y-auto">{timelineJobs.map((job) => <label key={job.job_id} className="flex items-center gap-2 rounded border border-line bg-surface px-2 py-1"><input type="checkbox" checked={compositeIds.includes(job.job_id)} onChange={(event) => setCompositeIds((current) => event.target.checked ? [...current, job.job_id] : current.filter((id) => id !== job.job_id))} /><span className="flex-1">{formatDate(job.completed_at ?? job.updated_at)}</span><span className="text-[9px] text-ink-400">{job.collection}</span></label>)}</div><button onClick={() => void runComposite()} disabled={compositeIds.length < 2 || busy === 'composite'} className="mt-2 w-full rounded-lg border border-brand-300 bg-brand-50 py-1.5 font-black text-brand-800 disabled:opacity-40"><Layers3 size={12} className="ml-1 inline" />ساخت composite</button></section>
        </>}

        {tab === 'status' && <>
          {summary && <section className="grid grid-cols-2 gap-1.5">{[
            ['آخرین تصویر', formatDate(summary.latest_usable_image?.datetime), Image], ['تأخیر میانگین', `${summary.catalog.average_latency_minutes?.toFixed(0) ?? '—'} دقیقه`, Activity], ['COG/Feature', `${summary.catalog.features}`, Database], ['شکست job', `${summary.catalog.failed_jobs}`, AlertTriangle], ['cache tile', `${summary.cache.files} / ${bytesLabel(summary.cache.bytes)}`, Layers3], ['SLA تازگی', `${summary.freshness_sla_hours} ساعت`, Gauge],
          ].map(([label, value, Icon]) => { const C = Icon as typeof Activity; return <div key={String(label)} className="rounded-xl border border-line bg-paper p-2"><C size={13} className="mb-1 text-brand-700" /><span className="block text-[9px] text-ink-400">{String(label)}</span><strong>{String(value)}</strong></div>; })}</section>}
          <section className="rounded-xl border border-line bg-paper p-2.5"><div className="mb-2 font-black">سلامت providerها</div><div className="space-y-1">{(health?.providers ?? []).map((item) => <div key={item.provider} className="flex items-center justify-between rounded border border-line bg-surface px-2 py-1.5"><span>{item.provider}</span><span className={item.status === 'online' ? 'text-emerald-700' : item.status === 'degraded' ? 'text-amber-700' : 'text-red-700'}>{item.status} · {item.last_latency_ms ?? '—'}ms · penalty {item.quota_penalty}</span></div>)}</div></section>
          <section className="rounded-xl border border-line bg-surface p-2.5"><div className="mb-2 font-black">وضعیت صف</div><div className="grid grid-cols-5 gap-1 text-center text-[9px]">{summary && Object.entries(summary.jobs).map(([key, value]) => <div key={key} className="rounded border border-line bg-paper p-1"><strong className="block text-sm">{value}</strong>{key}</div>)}</div>{summary && <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]"><span>فعال<strong className="block">{summary.queue.active}</strong></span><span>منتظر<strong className="block">{summary.queue.pending}</strong></span><span>موفق<strong className="block">{summary.queue.completed}</strong></span><span>خطا<strong className="block">{summary.queue.failed}</strong></span></div>}</section>
          {summary && <section className="rounded-xl border border-line bg-paper p-2.5"><div className="mb-2 flex items-center justify-between"><span className="font-black">زیرساخت serving</span><button onClick={() => void cleanupCache()} disabled={busy === 'cache'} className="rounded border border-line bg-surface px-2 py-1 text-[9px] font-bold">پاک‌سازی cache</button></div><div className="grid grid-cols-2 gap-1"><div className="rounded border border-line bg-surface p-2"><span className="block text-[9px] text-ink-400">Object storage</span><strong>{summary.infrastructure.object_storage.driver}</strong><span className="mr-1 text-[9px] text-emerald-700">{summary.infrastructure.object_storage.status}</span></div><div className="rounded border border-line bg-surface p-2"><span className="block text-[9px] text-ink-400">Tile cache</span><strong>{summary.infrastructure.tile_cache.driver}</strong><span className="mr-1 text-[9px] text-emerald-700">{summary.infrastructure.tile_cache.status}</span></div></div></section>}
          <section className="rounded-xl border border-line bg-paper p-2.5"><div className="mb-2 flex items-center justify-between"><span className="font-black">هشدارهای عملیاتی</span><span className="text-[9px] text-ink-400">{alerts.filter((item) => !item.acknowledged_at).length} باز</span></div><div className="max-h-40 space-y-1 overflow-y-auto">{alerts.length === 0 ? <p className="text-center text-[9px] text-ink-400">هشداری ثبت نشده است.</p> : alerts.map((alert) => <div key={alert.alert_id} className={`rounded border p-2 ${alert.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'} ${alert.acknowledged_at ? 'opacity-50' : ''}`}><div className="flex justify-between gap-2"><strong>{alert.title}</strong>{!alert.acknowledged_at && <button onClick={() => void acknowledgeAlert(alert)} className="text-[9px] font-black text-brand-800">تأیید</button>}</div><p className="mt-1 text-[9px] leading-4">{alert.message}</p></div>)}</div></section>
          <section className="rounded-xl border border-line bg-surface p-2.5"><div className="mb-2 font-black">آخرین رویدادهای audit</div><div className="max-h-36 space-y-1 overflow-y-auto">{auditEvents.slice(0, 12).map((event) => <div key={event.event_id} className="flex items-center justify-between gap-2 rounded border border-line bg-paper px-2 py-1 text-[9px]"><span className="truncate">{event.action} · {event.actor}</span><span className="shrink-0 text-ink-400">{formatDate(event.at)}</span></div>)}</div></section>
        </>}

        <div className="flex items-center justify-between border-t border-line px-1 pt-2 text-[9px] text-ink-400"><span className="flex items-center gap-1"><SlidersHorizontal size={11} /> COG · STAC · provenance</span><span>{health?.catalog?.items ?? health?.metadata?.records ?? 0} item</span></div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[10px] text-emerald-700">{notice}</div>}
      </div>
    </aside>
  );
}
