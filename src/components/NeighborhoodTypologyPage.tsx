import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  FileJson,
  FolderOpen,
  History,
  Loader2,
  MapPinned,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import TypologyReport from './typology/TypologyReport';
import TypologyDataAuditDashboard from './typology/TypologyDataAuditDashboard';
import TypologyOperationsPanel from './typology/TypologyOperationsPanel';
import TypologyGovernancePanel from './typology/TypologyGovernancePanel';
import TypologyBoundaryPreview, { inspectBoundaryGeometry } from './typology/TypologyBoundaryPreview';
import {
  confirmBoundary,
  collectLocalTypologyEvidence,
  createTypologyRun,
  explainTypologyReport,
  getLocationCandidates,
  getTypologyRun,
  getTypologyReport,
  getTypologyDataCatalog,
  searchLocations,
  getNearbyLocations,
  getNeighborhoodBoundaries,
  getAdministrativeBoundaries,
  isTypologyAbortError,
  listTypologyRuns,
  recomputeTypologyRun,
  startTypologyRun,
  TypologyApiError,
} from './typology/api';
import type {
  CreateTypologyRunRequest,
  LocationCandidate,
  SettlementType,
  TypologyExplanation,
  TypologyPurpose,
  TypologyReport as TypologyReportModel,
  TypologyRunStatus,
  TypologyRunSummary,
  TypologyDataCatalogSummary,
  LocationSearchResult,
  NeighborhoodBoundaryFeature,
} from './typology/types';
import NeighborhoodLocationMap from './typology/NeighborhoodLocationMap';

interface NeighborhoodTypologyPageProps {
  onOpenGeoportal?: (provinceId: string) => void;
}

interface TypologyOperation {
  epoch: number;
  controller: AbortController;
}

const statusLabels: Record<string, string> = {
  CREATED: 'ایجاد اجرا',
  LOCATION_AMBIGUOUS: 'رفع ابهام مکانی',
  WAITING_FOR_LOCATION_RESOLUTION: 'انتخاب گزینه مکانی',
  BOUNDARY_CONFIRMED: 'مرز تأیید شد',
  COLLECTING: 'گردآوری داده',
  WAITING_FOR_RESTRICTED_DATA: 'در انتظار داده محدود',
  COMPUTING: 'محاسبه قطعی',
  QA_REVIEW: 'کنترل کیفیت',
  EXPLORATORY: 'گزارش آزمایشی',
  PROVISIONAL: 'گزارش موقت',
  VERIFIED: 'گزارش تأییدشده',
  REJECTED: 'ردشده',
};

const terminalStatuses = new Set(['EXPLORATORY', 'PROVISIONAL', 'VERIFIED', 'REJECTED']);

const steps = [
  { key: 'location', title: 'مکان', detail: 'نام و سلسله‌مراتب اداری' },
  { key: 'boundary', title: 'مرز', detail: 'تأیید انسانی محدوده' },
  { key: 'evidence', title: 'شواهد', detail: 'برنامه ۴۱۹ شاخص' },
  { key: 'compute', title: 'محاسبه', detail: 'موتور قطعی و کنترل کیفیت' },
  { key: 'review', title: 'گزارش', detail: 'اعتبار و بازبینی' },
] as const;

function numberFa(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits }).format(value);
}

function isAreaBoundary(value: Record<string, unknown> | null | undefined): boolean {
  const type = value?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
}

function currentPersianYear(): number {
  const year = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric' })
    .formatToParts(new Date())
    .find((part) => part.type === 'year')?.value;
  return year ? Number(year) : new Date().getFullYear() - 621;
}

function initialTypologyForm(): CreateTypologyRunRequest {
  return {
    neighborhood_name: '',
    city_or_county: '',
    province: '',
    settlement_type: 'urban',
    reference_year: currentPersianYear(),
    optional_boundary_geojson: null,
    purpose: 'baseline',
  };
}

function percent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const normalized = value <= 1 ? value * 100 : value;
  return `${numberFa(normalized)}٪`;
}

function statusIndex(status?: TypologyRunStatus): number {
  if (!status) return 0;
  if (status === 'LOCATION_AMBIGUOUS' || status === 'WAITING_FOR_LOCATION_RESOLUTION' || status === 'CREATED') return 0;
  if (status === 'BOUNDARY_CONFIRMED') return 1;
  if (status === 'COLLECTING' || status === 'WAITING_FOR_RESTRICTED_DATA') return 2;
  if (status === 'COMPUTING' || status === 'QA_REVIEW') return 3;
  if (terminalStatuses.has(status)) return 4;
  return 0;
}

function isBusyStatus(status?: TypologyRunStatus): boolean {
  return Boolean(status && ['COLLECTING', 'WAITING_FOR_RESTRICTED_DATA', 'COMPUTING', 'QA_REVIEW'].includes(status));
}

const locationStatuses = new Set(['CREATED', 'LOCATION_AMBIGUOUS', 'WAITING_FOR_LOCATION_RESOLUTION']);
const autoRefreshStatuses = new Set(['COLLECTING', 'COMPUTING']);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function centerText(center: LocationCandidate['center']): string {
  if (!center) return 'مختصات در سرویس ثبت نشده است';
  if (Array.isArray(center)) return `${center[1].toFixed(5)}، ${center[0].toFixed(5)}`;
  return `${center.lat.toFixed(5)}، ${center.lng.toFixed(5)}`;
}

function readApiMessage(error: unknown): string {
  if (error instanceof TypologyApiError) return error.message;
  return 'ارتباط با سرویس گونه‌شناسی برقرار نشد.';
}

function Workflow({ status }: { status?: TypologyRunStatus }) {
  const active = statusIndex(status);
  return (
    <ol className="grid grid-cols-5 gap-1 border-y border-line bg-surface px-2 py-3" dir="rtl" aria-label="مراحل اجرای گونه‌شناسی">
      {steps.map((step, index) => {
        const complete = index < active;
        const current = index === active;
        return (
          <li key={step.key} className="relative min-w-0 px-1.5">
            {index < steps.length - 1 && <span className={`absolute left-0 top-4 hidden h-px w-full -translate-x-1/2 md:block ${complete ? 'bg-brand-700' : 'bg-line-strong'}`} />}
            <div className="relative flex flex-col items-center gap-1 text-center">
              <span className={`inline-flex size-8 items-center justify-center rounded-full border text-[10px] font-black ${complete ? 'border-brand-700 bg-brand-700 text-white' : current ? 'border-brand-700 bg-brand-50 text-brand-800 ring-4 ring-brand-50' : 'border-line-strong bg-paper text-ink-400'}`}>
                {complete ? <Check size={14} /> : numberFa(index + 1)}
              </span>
              <span className={`truncate text-[10px] font-black ${current || complete ? 'text-ink-800' : 'text-ink-400'}`}>{step.title}</span>
              <span className="hidden max-w-28 truncate text-[8px] font-bold text-ink-400 sm:block">{step.detail}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center justify-between text-[10px] font-black text-ink-700">
        {label}
        {hint && <span className="text-[8px] font-bold text-ink-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function FormInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-10 w-full rounded-md border border-line bg-surface px-3 text-[11px] font-bold text-ink-800 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${props.className ?? ''}`} />;
}

function FormSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 w-full rounded-md border border-line bg-surface px-3 text-[11px] font-bold text-ink-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${props.className ?? ''}`} />;
}

function EmptyStart({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <section className="grid gap-8 border-y border-line py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)]" dir="rtl">
      <div>
        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-brand-800 text-white"><MapPinned size={21} /></div>
        <h2 className="max-w-xl text-xl font-black leading-9 text-ink-900">پروندهٔ محله را با مرز و منبع قابل ممیزی شروع کنید.</h2>
        <p className="mt-3 max-w-xl text-[11px] font-medium leading-6 text-ink-500">سامانه ابتدا نام را رفع ابهام می‌کند، سپس مرز را برای تأیید شما نگه می‌دارد. هیچ نمره‌ای پیش از رسیدن دادهٔ معتبر و اجرای تابع نسخه‌دار ساخته نمی‌شود.</p>
        <button type="button" onClick={onLoadDemo} className="mt-6 inline-flex h-10 items-center gap-2 rounded-md border border-brand-300 bg-brand-50 px-4 text-[10px] font-black text-brand-800 hover:bg-brand-100">
          <FileJson size={15} /> دیدن قرارداد پاسخ نمونه
        </button>
      </div>
      <div className="border-r border-line pr-6">
        <h3 className="text-xs font-black text-ink-800">حدود اعتبار این ابزار</h3>
        <ul className="mt-3 space-y-3 text-[10px] font-bold leading-5 text-ink-500">
          <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok-700" /> پوشش، اعتماد و پایداری برچسب جداگانه گزارش می‌شود.</li>
          <li className="flex gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0 text-warn-700" /> دادهٔ مفقود با صفر جایگزین نمی‌شود و در صف اقدام می‌ماند.</li>
          <li className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-brand-700" /> هوش مصنوعی توضیح‌دهندهٔ شواهد است، نه ماشین‌حساب شاخص.</li>
        </ul>
      </div>
    </section>
  );
}

export default function NeighborhoodTypologyPage({ onOpenGeoportal }: NeighborhoodTypologyPageProps) {
  const [form, setForm] = useState<CreateTypologyRunRequest>(() => initialTypologyForm());
  const [boundaryFileName, setBoundaryFileName] = useState('');
  const [boundaryInputKey, setBoundaryInputKey] = useState(0);
  const [run, setRun] = useState<TypologyRunSummary | null>(null);
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [report, setReport] = useState<TypologyReportModel | null>(null);
  const [catalog, setCatalog] = useState<TypologyDataCatalogSummary | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [selectedSearchLocation, setSelectedSearchLocation] = useState<LocationSearchResult | null>(null);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [localBoundaries, setLocalBoundaries] = useState<NeighborhoodBoundaryFeature[]>([]);
  const [administrativeBoundaries, setAdministrativeBoundaries] = useState<NeighborhoodBoundaryFeature[]>([]);
  const [localBoundariesLoading, setLocalBoundariesLoading] = useState(false);
  const [explanation, setExplanation] = useState<TypologyExplanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [recentRuns, setRecentRuns] = useState<TypologyRunSummary[]>([]);
  const [loadingRecentRuns, setLoadingRecentRuns] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const operationRef = useRef<TypologyOperation | null>(null);
  const uploadEpochRef = useRef(0);

  const beginOperation = () => {
    operationRef.current?.controller.abort();
    const operation: TypologyOperation = {
      epoch: (operationRef.current?.epoch ?? 0) + 1,
      controller: new AbortController(),
    };
    operationRef.current = operation;
    return operation;
  };

  const isCurrentOperation = (operation: TypologyOperation) => (
    operationRef.current?.epoch === operation.epoch && !operation.controller.signal.aborted
  );

  const phase = report
    ? 'report'
    : !run
      ? 'form'
      : locationStatuses.has(run.status)
        ? 'candidates'
        : run.status === 'BOUNDARY_CONFIRMED'
          ? 'ready'
          : 'processing';
  const busyStatus = isBusyStatus(run?.status);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      setCatalog(await getTypologyDataCatalog());
    } catch {
      setCatalog(null);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (report) void loadCatalog();
  }, [loadCatalog, report?.run_id]);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationResults([]);
      setLocationSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLocationSearching(true);
      void searchLocations(query, { signal: controller.signal })
        .then(setLocationResults)
        .catch(() => { if (!controller.signal.aborted) setLocationResults([]); })
        .finally(() => { if (!controller.signal.aborted) setLocationSearching(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [locationQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLocalBoundariesLoading(true);
    void Promise.all([
      getNeighborhoodBoundaries(undefined, { signal: controller.signal }),
      getAdministrativeBoundaries('کرج', { signal: controller.signal }),
    ])
      .then(([neighborhoods, districts]) => {
        setLocalBoundaries(neighborhoods);
        setAdministrativeBoundaries(districts);
      })
      .catch(() => { if (!controller.signal.aborted) setLocalBoundaries([]); })
      .finally(() => { if (!controller.signal.aborted) setLocalBoundariesLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const operation = beginOperation();
    setLoadingRecentRuns(true);
    void listTypologyRuns(8, { signal: operation.controller.signal })
      .then((rows) => {
        if (isCurrentOperation(operation)) setRecentRuns(rows);
      })
      .catch((requestError) => {
        if (isCurrentOperation(operation) && !isTypologyAbortError(requestError)) setRecentRuns([]);
      })
      .finally(() => {
        if (isCurrentOperation(operation)) setLoadingRecentRuns(false);
      });
    return () => {
      if (operationRef.current?.epoch === operation.epoch) operation.controller.abort();
    };
  }, []);

  const updateForm = <K extends keyof CreateTypologyRunRequest>(key: K, value: CreateTypologyRunRequest[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const selectLocation = (location: LocationSearchResult) => {
    setSelectedSearchLocation(location);
    setLocationQuery(location.canonical_name);
    updateForm('neighborhood_name', location.canonical_name);
    updateForm('city_or_county', location.city_or_county);
    updateForm('province', location.province);
    updateForm('settlement_type', location.settlement_type === 'rural' ? 'rural' : 'urban');
    if (location.boundary_geojson && isAreaBoundary(location.boundary_geojson)) {
      updateForm('optional_boundary_geojson', location.boundary_geojson);
      setBoundaryFileName(location.boundary_quality === 'authoritative' ? 'مرز رسمی محله' : 'مرز محله از داده محلی');
    } else {
      updateForm('optional_boundary_geojson', null);
      setBoundaryFileName('');
    }
    // مرکز یک candidate یا شیء {lat,lng} است یا جفت [lng,lat] مطابق ترتیب GeoJSON.
    setMapPoint(
      location.center
        ? Array.isArray(location.center)
          ? { lat: location.center[1], lng: location.center[0] }
          : location.center
        : null
    );
    setNotice(`موقعیت «${location.canonical_name}» انتخاب شد؛ شهر و استان به‌صورت خودکار تکمیل شدند.`);
  };

  const handleMapPoint = async (lat: number, lng: number) => {
    setMapPoint({ lat, lng });
    try {
      const nearby = await getNearbyLocations(lat, lng);
      setLocationResults(nearby);
      const nearest = nearby[0];
      if (nearest) {
        selectLocation(nearest);
        setNotice(`نزدیک‌ترین محدوده به نقطه انتخابی «${nearest.canonical_name}» است؛ در صورت نیاز نتیجه دیگری را از نقشه انتخاب کنید.`);
      } else {
        setSelectedSearchLocation(null);
        updateForm('neighborhood_name', 'محدوده انتخابی روی نقشه');
        updateForm('city_or_county', '');
        updateForm('province', '');
        setNotice('نقطه روی نقشه ثبت شد؛ برای محاسبه دقیق، مرز Polygon را ترسیم کنید.');
      }
    } catch {
      setSelectedSearchLocation(null);
      updateForm('neighborhood_name', 'محدوده انتخابی روی نقشه');
      setNotice('نقطه روی نقشه ثبت شد؛ تکمیل زمینه اداری محلی در دسترس نبود.');
    }
  };

  const handleGeoJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBoundaryFileName(file.name);
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const geometry = parsed.type === 'Feature'
        ? parsed.geometry as Record<string, unknown>
        : parsed.type === 'FeatureCollection' && Array.isArray(parsed.features) && parsed.features.length === 1
          ? (parsed.features[0] as Record<string, unknown>).geometry as Record<string, unknown>
          : parsed;
      if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
        throw new Error('نوع GeoJSON پشتیبانی نمی‌شود');
      }
      updateForm('optional_boundary_geojson', geometry);
      setNotice('فایل مرز خوانده شد و همراه درخواست ارسال می‌شود.');
    } catch {
      updateForm('optional_boundary_geojson', null);
      setError('فایل مرز GeoJSON قابل خواندن نیست.');
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.neighborhood_name.trim()) {
      setError('نام محله را وارد کنید یا یک نقطه/نشانگر را روی نقشه انتخاب کنید.');
      return;
    }
    if (!Number.isInteger(form.reference_year) || form.reference_year < 1390 || form.reference_year > 1500) {
      setError('سال مرجع باید یک سال شمسی معتبر بین ۱۳۹۰ تا ۱۵۰۰ باشد.');
      return;
    }
    setBusy(true);
    try {
      const nextRun = await createTypologyRun({ ...form, selected_location: selectedSearchLocation, neighborhood_name: form.neighborhood_name.trim(), city_or_county: form.city_or_county.trim(), province: form.province.trim() });
      setRun(nextRun);
      setRecentRuns((previous) => [nextRun, ...previous.filter((item) => item.run_id !== nextRun.run_id)].slice(0, 8));
      const nextCandidates = await getLocationCandidates(nextRun.run_id);
      setCandidates(nextCandidates);
      setSelectedCandidate(nextCandidates.length === 1 ? nextCandidates[0].candidate_id : null);
      const automaticBoundary = isAreaBoundary(form.optional_boundary_geojson)
        ? form.optional_boundary_geojson
        : isAreaBoundary(nextCandidates[0]?.boundary_geojson)
          ? nextCandidates[0]?.boundary_geojson ?? null
          : null;
      if (automaticBoundary && nextCandidates.length === 1) {
        const selectedBoundarySource = selectedSearchLocation?.boundary_quality === 'authoritative'
          ? 'municipal'
          : selectedSearchLocation?.boundary_quality === 'confirmed_osm'
            ? 'osm_temporary'
            : form.optional_boundary_geojson
              ? 'user_supplied'
              : 'osm_temporary';
        const confirmed = await confirmBoundary(nextRun.run_id, {
          candidate_id: nextCandidates[0].candidate_id,
          boundary_geojson: automaticBoundary,
          source: selectedBoundarySource,
          version: selectedSearchLocation?.boundary_quality ? `mahalat-${selectedSearchLocation.boundary_quality}-2026-08-19` : form.optional_boundary_geojson ? `map-or-upload-${new Date().toISOString().slice(0, 10)}` : 'local-place-point-buffer-v1',
        });
        setRun(confirmed);
        setNotice(form.optional_boundary_geojson ? 'موقعیت و مرز انتخابی ثبت شد؛ مرحله تأیید تکراری حذف شد.' : 'موقعیت ثبت شد و مرز موقت محلی برای ادامه ساخته شد؛ اعتماد این مرز در گزارش با سطح پایین‌تر ثبت می‌شود.');
      } else {
        setNotice(nextCandidates.length ? `${numberFa(nextCandidates.length)} گزینه برای تأیید مرز پیدا شد.` : 'موقعیت ثبت شد؛ برای محاسبه باید مرز محله را روی نقشه ترسیم یا بارگذاری کنید.');
      }
    } catch (requestError) {
      setError(readApiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const resumeRun = async (runId: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const nextRun = await getTypologyRun(runId);
      setRun(nextRun);
      const savedRequest = nextRun.request;
      if (savedRequest) {
        setForm((previous) => ({
          ...previous,
          neighborhood_name: savedRequest.neighborhood_name ?? previous.neighborhood_name,
          city_or_county: savedRequest.city_or_county ?? previous.city_or_county,
          province: savedRequest.province ?? previous.province,
          settlement_type: savedRequest.settlement_type === 'rural' ? 'rural' : 'urban',
          reference_year: typeof savedRequest.reference_year === 'number' ? savedRequest.reference_year : previous.reference_year,
          optional_boundary_geojson: isObject(savedRequest.optional_boundary_geojson) ? savedRequest.optional_boundary_geojson : null,
          purpose: savedRequest.purpose === 'monitoring' || savedRequest.purpose === 'intervention_priority' ? savedRequest.purpose : 'baseline',
        }));
        setBoundaryFileName(isObject(savedRequest.optional_boundary_geojson) ? 'مرز ذخیره‌شده در اجرا' : '');
      }
      setCandidates([]);
      setSelectedCandidate(null);
      setReport(null);
      setExplanation(null);
      if (['CREATED', 'LOCATION_AMBIGUOUS', 'WAITING_FOR_LOCATION_RESOLUTION'].includes(nextRun.status)) {
        const nextCandidates = await getLocationCandidates(runId);
        setCandidates(nextCandidates);
        setSelectedCandidate(nextCandidates.length === 1 ? nextCandidates[0].candidate_id : null);
        setNotice('اجرای قبلی باز شد؛ پیش از ادامه، گزینه مکانی و مرز را بررسی کنید.');
      } else if (nextRun.status !== 'BOUNDARY_CONFIRMED') {
        const loaded = await loadReport(runId, true, true);
        if (loaded) setNotice('گزارش اجرای قبلی بارگذاری شد.');
      } else {
        setNotice('اجرای قبلی آماده ساخت برنامه تأمین داده است.');
      }
    } catch (requestError) {
      setError(readApiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmBoundary = async () => {
    if (!run || !selectedCandidate) return;
    setError(null);
    setNotice(null);
    const candidate = candidates.find((item) => item.candidate_id === selectedCandidate);
    const boundaryGeoJson = candidate?.boundary_geojson ?? form.optional_boundary_geojson;
    if (!boundaryGeoJson) {
      setError('برای تثبیت مرز، یک فایل Polygon/MultiPolygon GeoJSON بارگذاری کنید. بدون هندسه، سامانه اجازه محاسبه نمی‌دهد.');
      return;
    }
    setBusy(true);
    try {
      const nextRun = await confirmBoundary(run.run_id, {
        candidate_id: selectedCandidate,
        boundary_geojson: boundaryGeoJson,
        source: candidate?.boundary_available ? 'municipal' : 'user_supplied',
        version: candidate?.boundary_available ? 'candidate-boundary-v1' : `user-upload-${new Date().toISOString().slice(0, 10)}`,
      });
      setRun(nextRun);
      setNotice('مرز انتخابی ثبت شد. اکنون می‌توانید برنامه تأمین داده را آغاز کنید.');
    } catch (requestError) {
      setError(readApiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const loadReport = useCallback(async (runId: string, silent = false, surfaceError = false): Promise<boolean> => {
    if (!silent) setRefreshing(true);
    try {
      const nextReport = await getTypologyReport(runId);
      setReport(nextReport);
      setRun((previous) => previous ? { ...previous, status: nextReport.status, updated_at: nextReport.updated_at, coverage: nextReport.coverage } : previous);
      setError(null);
      return true;
    } catch (requestError) {
      if (!silent || surfaceError) setError(readApiMessage(requestError));
      return false;
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const handleStart = async () => {
    if (!run) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const started = await startTypologyRun(run.run_id);
      if ('status' in started && typeof started.status === 'string') {
        // مقدار وضعیت/پوشش را پیش از فراخوانی setState استخراج می‌کنیم؛ narrowing داخل
        // callback حفظ نمی‌شود چون عضویت شیء mutable است.
        const startedStatus = started.status;
        const startedCoverage = 'coverage' in started && started.coverage && typeof started.coverage === 'object'
          ? started.coverage as TypologyRunSummary['coverage']
          : null;
        setRun((previous) => previous ? { ...previous, status: startedStatus, coverage: startedCoverage ?? previous.coverage } : previous);
      }
      await collectLocalTypologyEvidence(run.run_id);
      const recomputed = await recomputeTypologyRun(run.run_id);
      setRun((previous) => previous ? { ...previous, ...recomputed } : previous);
      setNotice('برنامه تأمین فعال شد، داده‌های محلی Portals/geojson استخراج شدند و موتور با پوشش موجود بازمحاسبه شد.');
      await loadReport(run.run_id, true, true);
    } catch (requestError) {
      setError(readApiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!run?.run_id || !autoRefreshStatuses.has(run.status)) return undefined;
    pollingRef.current = window.setInterval(() => { void loadReport(run.run_id, true); }, 5000);
    return () => {
      if (pollingRef.current != null) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [loadReport, run?.run_id, run?.status]);

  const handleExplain = async () => {
    if (!report) return;
    setExplaining(true);
    setError(null);
    try {
      setExplanation(await explainTypologyReport(report.run_id));
    } catch (requestError) {
      setError(readApiMessage(requestError));
    } finally {
      setExplaining(false);
    }
  };

  const reset = () => {
    setRun(null);
    setCandidates([]);
    setSelectedCandidate(null);
    setReport(null);
    setCatalog(null);
    setExplanation(null);
    setError(null);
    setNotice(null);
    setBoundaryFileName('');
    setLocationQuery('');
    setLocationResults([]);
    setSelectedSearchLocation(null);
    setMapPoint(null);
  };

  const contractPreview = useMemo(() => JSON.stringify({
    neighborhood_name: form.neighborhood_name || 'نام محله',
    city_or_county: form.city_or_county || 'شهر',
    province: form.province || 'استان',
    settlement_type: form.settlement_type,
    reference_year: form.reference_year,
    optional_boundary_geojson: form.optional_boundary_geojson ? '[attached GeoJSON]' : null,
    purpose: form.purpose,
  }, null, 2), [form]);

  return (
    <main className="flex flex-col gap-5 pb-10" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-brand-800"><MapPinned size={14} /> ابزار گونه‌بندی محلات</div>
          <h1 className="mt-2 text-xl font-black tracking-normal text-ink-900">پروندهٔ سه‌ساحتی محله</h1>
          <p className="mt-1.5 text-[10px] font-bold text-ink-500">حل نام، تثبیت مرز، رجیستر ۴۱۹ شاخص و گزارش قابل ردیابی</p>
        </div>
        {run && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <span className="max-w-full truncate rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[9px] font-black text-ink-500 sm:max-w-80" dir="ltr" title={run.run_id}>{run.run_id}</span>
            <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[10px] font-black text-ink-600 hover:border-brand-300 hover:text-brand-800"><ArrowLeft size={13} /> اجرای جدید</button>
          </div>
        )}
      </header>

      {(error || notice) && (
        <div className={`flex items-start gap-3 border-r-4 px-4 py-3 text-[10px] font-bold leading-5 ${error ? 'border-danger bg-danger-soft text-danger-700' : 'border-ok bg-ok-soft text-ok-700'}`} role={error ? 'alert' : 'status'}>
          {error ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : <Check size={17} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      <Workflow status={run?.status} />

      {phase === 'form' && (
        <>
          <form onSubmit={handleCreate} className="border-y border-line bg-paper py-5" noValidate>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-ink-900">ایجاد اجرای قابل ممیزی</h2>
                <p className="mt-1 text-[10px] font-bold text-ink-500">اطلاعات مکانی برای جست‌وجوی گزینه‌های رسمی استفاده می‌شود؛ هنوز هیچ شاخصی محاسبه نشده است.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info-soft px-2.5 py-1 text-[9px] font-black text-info-700"><ShieldCheck size={12} /> بدون عددسازی</span>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
              <div className="space-y-4">
                <div className="relative">
                  <Field label="جست‌وجوی هوشمند محله" hint="فقط نام محله کافی است">
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-300" />
                      <FormInput value={locationQuery} onChange={(event) => { setLocationQuery(event.target.value); setSelectedSearchLocation(null); updateForm('neighborhood_name', event.target.value); }} placeholder="مثلاً نارمک، جلفا، کوی طلاب…" autoComplete="off" className="pr-10" />
                      {locationSearching && <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-brand-700" />}
                    </div>
                  </Field>
                  {locationQuery.trim().length >= 2 && !selectedSearchLocation && <div className="absolute z-[700] mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-pop">
                    {locationResults.map((location) => <button key={location.candidate_id} type="button" onClick={() => selectLocation(location)} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-right hover:bg-brand-50"><MapPinned size={16} className="shrink-0 text-brand-700" /><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-black text-ink-800">{location.canonical_name}</strong><span className="mt-0.5 block truncate text-[9px] font-bold text-ink-400">{location.province || 'استان نامشخص'}{location.city_or_county ? `، ${location.city_or_county}` : ''} · {location.match_reason}</span></span><span className="rounded-full bg-brand-50 px-2 py-1 text-[8px] font-black text-brand-800">{percent(location.confidence)}</span></button>)}
                    {!locationSearching && locationResults.length === 0 && <p className="px-3 py-4 text-center text-[10px] font-bold text-ink-400">نتیجه‌ای پیدا نشد؛ می‌توانید نقطه و مرز را روی نقشه انتخاب کنید.</p>}
                  </div>}
                </div>
                {selectedSearchLocation && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2.5 text-[10px] font-bold text-ok-700"><Check size={15} /><strong>{selectedSearchLocation.canonical_name}</strong><span>{selectedSearchLocation.province}{selectedSearchLocation.city_or_county ? `، ${selectedSearchLocation.city_or_county}` : ''}</span>{selectedSearchLocation.municipality_region_name && <span>{selectedSearchLocation.municipality_region_name}</span>}{selectedSearchLocation.area_km2 != null && selectedSearchLocation.boundary_available && <span>{numberFa(selectedSearchLocation.area_km2, 2)} کیلومترمربع</span>}<span className="mr-auto text-[8px]">{selectedSearchLocation.boundary_available ? (selectedSearchLocation.boundary_quality === 'authoritative' ? 'مرز رسمی' : selectedSearchLocation.boundary_quality === 'confirmed_osm' ? 'مرز تأییدشده OSM' : 'مرز محلی') : 'نقطه محله؛ مرز Polygon نیازمند ترسیم یا بارگذاری'}</span></div>}
                <div className="grid gap-4 md:grid-cols-2">
              <Field label="سال مرجع"><FormInput type="number" min={1390} max={1500} value={form.reference_year} onChange={(event) => updateForm('reference_year', Number(event.target.value))} dir="ltr" /></Field>
              <Field label="نوع سکونتگاه"><div className="grid h-10 grid-cols-2 rounded-md border border-line bg-surface p-1">
                {([['urban', 'شهری'], ['rural', 'روستایی']] as [SettlementType, string][]).map(([value, label]) => <button type="button" key={value} onClick={() => updateForm('settlement_type', value)} className={`rounded px-2 text-[10px] font-black ${form.settlement_type === value ? 'bg-brand-800 text-white' : 'text-ink-500 hover:text-ink-800'}`}>{label}</button>)}
              </div></Field>
              <Field label="هدف اجرا"><FormSelect value={form.purpose} onChange={(event) => updateForm('purpose', event.target.value as TypologyPurpose)}><option value="baseline">خط مبنا</option><option value="monitoring">پایش دوره‌ای</option><option value="intervention_priority">اولویت مداخله</option></FormSelect></Field>
              <Field label="مرز اختیاری" hint="GeoJSON"><label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface px-3 text-[10px] font-bold text-ink-500 hover:border-brand-400 hover:text-brand-800"><UploadCloud size={15} /><span className="truncate">{boundaryFileName || 'انتخاب فایل مرز'}</span><input type="file" accept="application/geo+json,application/json,.geojson,.json" onChange={handleGeoJson} className="sr-only" /></label></Field>
              <div className="flex items-end"><button type="submit" disabled={busy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-800 px-4 text-[10px] font-black text-white hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} {busy ? 'در حال ایجاد اجرا…' : 'ایجاد اجرا و جست‌وجوی محدوده'}</button></div>
                </div>
                <p className="text-[9px] font-bold leading-5 text-ink-400">شهر و استان ورودی جداگانه نیستند؛ سامانه آن‌ها را از نتیجه انتخابی یا مختصات نقشه استخراج می‌کند. برای محاسبه دقیق، مرز Polygon را ترسیم یا بارگذاری کنید.</p>
              </div>
              <div className="relative">
                <NeighborhoodLocationMap boundaries={localBoundaries} administrativeBoundaries={administrativeBoundaries} candidates={locationResults} selectedCandidate={selectedSearchLocation?.candidate_id ?? null} onSelectCandidate={(candidate) => selectLocation(candidate as LocationSearchResult)} onPickPoint={handleMapPoint} onBoundaryDraft={(geometry) => updateForm('optional_boundary_geojson', geometry)} />
                {localBoundariesLoading && <span className="absolute left-3 top-3 z-[600] rounded-md border border-line bg-surface/95 px-2 py-1 text-[8px] font-black text-ink-500">در حال بارگذاری مرزهای تهران و کرج…</span>}
              </div>
            </div>
            {form.optional_boundary_geojson && (
              <div className="mt-4 max-w-2xl">
                <TypologyBoundaryPreview geometry={form.optional_boundary_geojson} label="مرز بارگذاری‌شده" />
              </div>
            )}
          </form>
          <section className="border-y border-line py-5" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xs font-black text-ink-800"><History size={15} className="text-brand-700" /> اجراهای اخیر</h2>
                <p className="mt-1 text-[10px] font-bold text-ink-400">پرونده‌های ذخیره‌شده را بدون از دست‌دادن مسیر کار باز کنید.</p>
              </div>
              {loadingRecentRuns && <Loader2 size={15} className="animate-spin text-brand-700" />}
            </div>
            {recentRuns.length > 0 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {recentRuns.map((recent) => (
                  <button key={recent.run_id} type="button" onClick={() => void resumeRun(recent.run_id)} className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-right hover:border-brand-300 hover:bg-brand-50">
                    <FolderOpen size={14} className="shrink-0 text-brand-700" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-black text-ink-800">{recent.request?.neighborhood_name ?? recent.run_id.slice(0, 8)}</span><span className="mt-0.5 block text-[9px] font-bold text-ink-400">{statusLabels[recent.status] ?? recent.status}</span></span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[10px] font-bold text-ink-400">اجرای ذخیره‌شده‌ای برای بازگشایی وجود ندارد.</p>
            )}
          </section>
          <EmptyStart onLoadDemo={() => setShowContract(true)} />
        </>
      )}

      {phase === 'candidates' && (
        <section className="flex flex-col gap-5 border-y border-line py-5" dir="rtl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-ink-900">کدام محدوده منظور شماست؟</h2>
              <p className="mt-1 text-[10px] font-bold text-ink-500">تا انتخاب شما انجام نشود، برنامه تأمین داده و محاسبه آغاز نمی‌شود.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn-soft px-2.5 py-1 text-[9px] font-black text-warn-700"><AlertCircle size={12} /> تأیید انسانی لازم است</span>
          </div>
          {candidates.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {candidates.map((candidate) => {
                const selected = selectedCandidate === candidate.candidate_id;
                return (
                  <button key={candidate.candidate_id} type="button" onClick={() => setSelectedCandidate(candidate.candidate_id)} className={`relative flex min-h-40 flex-col items-start rounded-lg border p-4 text-right transition-all ${selected ? 'border-brand-700 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-surface hover:border-brand-300'}`}>
                    <span className={`absolute left-3 top-3 inline-flex size-6 items-center justify-center rounded-full border ${selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-line-strong text-transparent'}`}><Check size={13} /></span>
                    <span className="pr-8 text-xs font-black text-ink-900">{candidate.canonical_name}</span>
                    <span className="mt-1 text-[10px] font-bold text-ink-500">{candidate.province}، {candidate.city_or_county}</span>
                    <span className="mt-4 flex w-full items-center justify-between border-t border-line pt-3 text-[9px] font-bold text-ink-500"><span>اعتماد تطبیق</span><strong className="text-brand-800">{percent(candidate.confidence)}</strong></span>
                          <span className="mt-2 flex w-full items-center justify-between text-[9px] font-bold text-ink-400"><span>{candidate.source}</span><span>{candidate.boundary_available ? (candidate.boundary_quality === 'provisional' ? 'مرز موقت محلی' : 'مرز موجود') : 'مرز نیازمند تأیید'}</span></span>
                    <span className="mt-1 text-[8px] font-mono text-ink-300" dir="ltr">{centerText(candidate.center)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center gap-2 border-y border-dashed border-line text-center"><MapPinned size={25} className="text-ink-300" /><p className="text-xs font-black text-ink-700">گزینه‌ای از سرویس دریافت نشد</p><p className="max-w-md text-[10px] font-medium leading-5 text-ink-400">نام، شهر و استان را بازبینی کنید یا پس از فعال‌شدن سرویس حل نام، همین اجرا را دوباره بارگذاری کنید.</p></div>
          )}
          {(candidates.find((item) => item.candidate_id === selectedCandidate)?.boundary_geojson || form.optional_boundary_geojson) && (
            <div className="max-w-2xl">
              <TypologyBoundaryPreview
                geometry={candidates.find((item) => item.candidate_id === selectedCandidate)?.boundary_geojson ?? form.optional_boundary_geojson}
                label="مرز پیشنهادی برای تأیید"
                compact
              />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="min-w-0 max-w-full text-[9px] font-bold text-ink-400">شناسه اجرا: <span className="break-all font-mono" dir="ltr">{run?.run_id}</span></p>
            <button type="button" onClick={handleConfirmBoundary} disabled={!selectedCandidate || busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-800 px-5 text-[10px] font-black text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} تأیید این محدوده</button>
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <section className="border-y border-line py-6" dir="rtl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok-700"><Check size={24} /></span>
            <h2 className="mt-4 text-base font-black text-ink-900">مرز محله تثبیت شد</h2>
            <p className="mx-auto mt-2 max-w-xl text-[10px] font-medium leading-6 text-ink-500">پس از شروع، برای هر ۴۱۹ شاخص مسیر تأمین داده، وضعیت دسترسی، شواهد و اقدام بعدی ثبت می‌شود. داده ناقص به نمره تبدیل نخواهد شد.</p>
            <div className="mt-5 grid gap-3 text-right sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">شناسه مرز</span><p className="mt-1 font-mono text-[10px] font-black text-ink-800" dir="ltr">{run?.boundary?.boundary_id ?? 'پس از پاسخ سرویس'}</p></div>
              <div className="rounded-lg border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">منبع</span><p className="mt-1 text-[10px] font-black text-ink-800">{run?.boundary?.source ?? 'تطبیق رسمی'}</p></div>
              <div className="rounded-lg border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">اعتماد مرز</span><p className="mt-1 text-[10px] font-black text-ink-800">{percent(run?.boundary?.confidence)}</p></div>
            </div>
            {run?.boundary?.geojson && (
              <div className="mx-auto mt-4 max-w-2xl text-right">
                <TypologyBoundaryPreview geometry={run.boundary.geojson} label="مرز تثبیت‌شده" compact />
              </div>
            )}
            <button type="button" onClick={handleStart} disabled={busy} className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-brand-800 px-6 text-[11px] font-black text-white hover:bg-brand-900 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} ساخت برنامه تأمین داده ۴۱۹ شاخص</button>
          </div>
        </section>
      )}

      {phase === 'report' && report && (
        <>
          <TypologyReport report={report} refreshing={refreshing} explaining={explaining} explanation={explanation} onRefresh={() => void loadReport(report.run_id)} onExplain={() => void handleExplain()} onDismissExplanation={() => setExplanation(null)} onOpenGeoportal={onOpenGeoportal} />
          <TypologyDataAuditDashboard report={report} catalog={catalog} catalogLoading={catalogLoading} onRefreshCatalog={() => void loadCatalog()} />
          <TypologyGovernancePanel
            publicationLevel={report.publication_level}
            gates={report.verification_gates}
            events={report.audit_events}
            reviewer={report.reviewer ?? null}
          />
          <TypologyOperationsPanel
            runId={report.run_id}
            status={report.status}
            missingCount={report.missing_data.length}
            evidenceCount={report.evidence.length}
            verificationEligible={report.verification_gates.eligible}
            onChanged={() => void loadReport(report.run_id, true, true)}
          />
        </>
      )}

      {phase === 'processing' && run && (
        <section className="flex flex-wrap items-center justify-between gap-4 border-y border-brand-200 bg-brand-50 px-4 py-4 text-brand-800" dir="rtl">
          <div className="flex min-w-0 items-start gap-3">
            {busyStatus ? <Loader2 size={19} className="mt-0.5 shrink-0 animate-spin" /> : <History size={19} className="mt-0.5 shrink-0" />}
            <div className="min-w-0">
              <p className="text-[11px] font-black">{statusLabels[run.status] ?? run.status}</p>
              <p className="mt-1 text-[9px] font-bold leading-5">گزارش این اجرا هنوز در صفحه نمایش داده نشده است. وضعیت سمت سرور حفظ شده و می‌توانید دوباره گزارش را بارگذاری کنید.</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadReport(run.run_id)} disabled={refreshing} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-brand-300 bg-surface px-3 text-[10px] font-black text-brand-800 hover:bg-brand-100 disabled:opacity-50">
            <Loader2 size={14} className={refreshing ? 'animate-spin' : ''} /> بارگذاری گزارش
          </button>
        </section>
      )}

      {showContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" role="dialog" aria-modal="true" onClick={() => setShowContract(false)}>
          <div className="w-full max-w-xl rounded-lg border border-line bg-surface p-5 shadow-pop" onClick={(event) => event.stopPropagation()} dir="ltr">
            <div className="flex items-center justify-between gap-3" dir="rtl"><div><h2 className="text-sm font-black text-ink-900">قرارداد درخواست `/api/typology/runs`</h2><p className="mt-1 text-[9px] font-bold text-ink-400">نمونهٔ زیر فقط ساختار ورودی را نشان می‌دهد؛ مقدار شاخص نیست.</p></div><button type="button" onClick={() => setShowContract(false)} className="inline-flex size-8 items-center justify-center rounded-md text-ink-400 hover:bg-paper" title="بستن"><ChevronLeft size={15} /></button></div>
            <pre className="mt-4 max-h-[430px] overflow-auto rounded-md bg-wall-950 p-4 text-[10px] leading-6 text-signal-400">{contractPreview}</pre>
            <div className="mt-4 flex justify-end" dir="rtl"><button type="button" onClick={() => setShowContract(false)} className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-800 px-4 text-[10px] font-black text-white">متوجه شدم</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
