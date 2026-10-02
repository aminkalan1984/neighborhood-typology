import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileClock,
  FileSearch,
  Gauge,
  MapPinned,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  DomainKey,
  DomainResult,
  EvidenceRow,
  IndicatorResultRow,
  MissingDataRow,
  TypologyExplanation,
  TypologyReport as TypologyReportModel,
} from './types';

interface TypologyReportProps {
  report: TypologyReportModel;
  refreshing: boolean;
  explaining: boolean;
  explanation: TypologyExplanation | null;
  onRefresh: () => void;
  onExplain: () => void;
  onDismissExplanation: () => void;
  onOpenGeoportal?: (provinceId: string) => void;
}

const numberFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const integerFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

const domainMeta: Record<DomainKey, { title: string; short: string; accent: string; fill: string }> = {
  physical: { title: 'ساحت کالبدی', short: 'P', accent: '#0D9488', fill: 'bg-teal-50 text-teal-800' },
  behavioral: { title: 'ساحت رفتاری', short: 'B', accent: '#2563EB', fill: 'bg-blue-50 text-blue-800' },
  normative: { title: 'ساحت هنجاری', short: 'N', accent: '#C77B0A', fill: 'bg-amber-50 text-amber-800' },
};

const statusFa: Record<string, string> = {
  PLANNED: 'برنامه‌ریزی‌شده',
  DOWNLOADING_PUBLIC_DATA: 'دریافت داده عمومی',
  WAITING_FOR_ORGANIZATIONAL_DATA: 'در انتظار داده سازمانی',
  WAITING_FOR_RESTRICTED_DATA: 'در انتظار داده محدود',
  WAITING_FOR_SURVEY: 'در انتظار پیمایش',
  WAITING_FOR_FIELD_AUDIT: 'در انتظار ممیزی میدانی',
  COMPUTABLE: 'آماده محاسبه',
  COMPUTED: 'محاسبه‌شده',
  FAILED_QA: 'رد کنترل کیفیت',
  NOT_AVAILABLE: 'ناموجود',
  APPROVED: 'تأییدشده',
  EXPLORATORY: 'آزمایشی',
  PROVISIONAL: 'موقت',
  VERIFIED: 'تأییدشده',
  REJECTED: 'ردشده',
};

function percent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

function formatPercent(value: number | null | undefined): string {
  const normalized = percent(value);
  return normalized == null ? '—' : `${integerFa.format(normalized)}٪`;
}

function formatScore(value: number | null | undefined): string {
  return value == null ? '—' : numberFa.format(value);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusTone(status: string): string {
  if (status === 'VERIFIED' || status === 'APPROVED' || status === 'COMPUTED') return 'bg-ok-soft text-ok-700 border-ok/30';
  if (status === 'REJECTED' || status === 'FAILED_QA') return 'bg-danger-soft text-danger-700 border-danger/30';
  if (status.includes('WAITING') || status === 'PROVISIONAL') return 'bg-warn-soft text-warn-700 border-warn/30';
  return 'bg-info-soft text-info-700 border-info/30';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black ${statusTone(status)}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {statusFa[status] ?? status}
    </span>
  );
}

function CoverageBar({ value, accent = 'bg-brand-700' }: { value: number | null | undefined; accent?: string }) {
  const normalized = percent(value) ?? 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${accent}`} style={{ width: `${normalized}%` }} />
    </div>
  );
}

function DomainScoreCard({ domain }: { domain: DomainResult }) {
  const meta = domainMeta[domain.key];
  return (
    <article className="min-h-32 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex size-7 items-center justify-center rounded-md text-xs font-black ${meta.fill}`}>{meta.short}</span>
            <h3 className="text-[11px] font-black text-ink-800">{meta.title}</h3>
          </div>
          <p className="mt-2 text-[10px] font-bold text-ink-500">{domain.label}</p>
        </div>
        <span className="text-2xl font-black tabular-nums text-ink-900">{formatScore(domain.score)}</span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold text-ink-500">
          <span>پوشش وزنی</span>
          <span>{formatPercent(domain.coverage)}</span>
        </div>
        <CoverageBar value={domain.coverage} />
      </div>
    </article>
  );
}

function Radar({ domains }: { domains: Record<DomainKey, DomainResult> }) {
  const center = { x: 120, y: 99 };
  const radius = 66;
  const axis = [
    { key: 'physical' as const, angle: -Math.PI / 2 },
    { key: 'behavioral' as const, angle: Math.PI / 6 },
    { key: 'normative' as const, angle: (5 * Math.PI) / 6 },
  ];
  const point = (score: number, angle: number, baseRadius = radius) => ({
    x: center.x + baseRadius * (Math.max(0, Math.min(5, score)) / 5) * Math.cos(angle),
    y: center.y + baseRadius * (Math.max(0, Math.min(5, score)) / 5) * Math.sin(angle),
  });
  const polygon = axis
    .map(({ key, angle }) => point(domains[key].score ?? 0, angle))
    .map(({ x, y }) => `${x},${y}`)
    .join(' ');

  return (
    <svg viewBox="0 0 240 190" className="h-48 w-full" aria-label="نمودار سه‌ساحتی P B N" role="img">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={axis.map(({ angle }) => point(5, angle, (radius * level) / 5)).map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="#DCE6E0"
          strokeWidth="1"
        />
      ))}
      {axis.map(({ key, angle }) => {
        const end = point(5, angle);
        return <line key={key} x1={center.x} y1={center.y} x2={end.x} y2={end.y} stroke="#CFDAD3" strokeWidth="1" />;
      })}
      <polygon points={polygon} fill="rgba(29, 89, 64, .16)" stroke="#1D5940" strokeWidth="2" />
      {axis.map(({ key, angle }) => {
        const p = point(domains[key].score ?? 0, angle);
        return <circle key={key} cx={p.x} cy={p.y} r="4" fill={domainMeta[key].accent} stroke="white" strokeWidth="2" />;
      })}
      <text x="120" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#34493F">کالبدی {formatScore(domains.physical.score)}</text>
      <text x="205" y="157" textAnchor="middle" fontSize="10" fontWeight="800" fill="#34493F">رفتاری {formatScore(domains.behavioral.score)}</text>
      <text x="35" y="157" textAnchor="middle" fontSize="10" fontWeight="800" fill="#34493F">هنجاری {formatScore(domains.normative.score)}</text>
    </svg>
  );
}

function EmptyTable({ icon: Icon, title, detail }: { icon: typeof FileSearch; title: string; detail: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-2 border-y border-dashed border-line py-8 text-center">
      <Icon size={22} className="text-ink-300" />
      <p className="text-xs font-black text-ink-700">{title}</p>
      <p className="max-w-lg text-[10px] font-medium leading-5 text-ink-400">{detail}</p>
    </div>
  );
}

type IndicatorFilter = 'all' | 'ready' | 'attention';

function IndicatorsTable({ rows, query, statusFilter }: { rows: IndicatorResultRow[]; query: string; statusFilter: IndicatorFilter }) {
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa');
    return rows.filter((row) => {
      const matchesQuery = !normalized || `${row.code} ${row.indicator} ${row.status}`.toLocaleLowerCase('fa').includes(normalized);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'ready' && ['COMPUTED', 'APPROVED'].includes(row.status))
        || (statusFilter === 'attention' && (row.status.includes('WAITING') || ['NOT_AVAILABLE', 'FAILED_QA', 'REJECTED'].includes(row.status)));
      return matchesQuery && matchesStatus;
    });
  }, [query, rows, statusFilter]);
  if (rows.length === 0) {
    return <EmptyTable icon={TableProperties} title="هنوز مقدار شاخصی ثبت نشده است" detail="ردیف‌ها فقط پس از تأمین داده، عبور از کنترل کیفیت و اجرای تابع قطعی نمایش داده می‌شوند." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-separate border-spacing-0 text-right text-[10px]">
        <thead className="sticky top-0 bg-paper text-ink-500">
          <tr>
            {['کد', 'شاخص', 'پیشران', 'مقدار خام', 'نمره ۱–۵', 'پوشش', 'وضعیت', 'پرچم کیفیت'].map((title) => (
              <th key={title} className="border-b border-line px-3 py-2.5 font-black">{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.code} className="hover:bg-brand-50/50">
              <td className="border-b border-line/70 px-3 py-3 font-mono font-black text-brand-800" dir="ltr">{row.code}</td>
              <td className="max-w-80 border-b border-line/70 px-3 py-3 font-bold text-ink-800">{row.indicator}</td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-500">{row.driver_id ?? '—'}</td>
              <td className="border-b border-line/70 px-3 py-3 font-bold text-ink-700">{row.raw_value == null ? '—' : `${row.raw_value} ${row.unit ?? ''}`}</td>
              <td className="border-b border-line/70 px-3 py-3 font-black text-ink-900">{formatScore(row.score)}</td>
              <td className="border-b border-line/70 px-3 py-3">{formatPercent(row.coverage)}</td>
              <td className="border-b border-line/70 px-3 py-3"><StatusBadge status={row.status} /></td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-500">{row.flags?.length ? row.flags.join('، ') : 'بدون پرچم'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="py-8 text-center text-[10px] font-bold text-ink-400">نتیجه‌ای برای عبارت جست‌وجوشده وجود ندارد.</p>}
    </div>
  );
}

function EvidenceTable({ rows, query }: { rows: EvidenceRow[]; query: string }) {
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa');
    if (!normalized) return rows;
    return rows.filter((row) => `${row.indicator_code} ${row.organization} ${row.dataset_id}`.toLocaleLowerCase('fa').includes(normalized));
  }, [query, rows]);
  if (rows.length === 0) {
    return <EmptyTable icon={Database} title="دفتر شواهد خالی است" detail="هیچ ادعایی بدون URL یا دستگاه، نسخه، مجوز، checksum و پوشش در گزارش پذیرفته نمی‌شود." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-right text-[10px]">
        <thead className="sticky top-0 bg-paper text-ink-500">
          <tr>
            {['شاخص', 'تولیدکننده', 'مجموعه‌داده / نسخه', 'دریافت', 'مجوز', 'کیفیت', 'checksum', 'منبع'].map((title) => (
              <th key={title} className="border-b border-line px-3 py-2.5 font-black">{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.evidence_id} className="hover:bg-brand-50/50">
              <td className="border-b border-line/70 px-3 py-3 font-mono font-black text-brand-800" dir="ltr">{row.indicator_code ?? '—'}</td>
              <td className="border-b border-line/70 px-3 py-3 font-bold text-ink-800">{row.organization}</td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-600">{row.dataset_id}<br /><span className="text-[9px] text-ink-400">{row.version}</span></td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-500">{formatDate(row.retrieved_at)}</td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-500">{row.license}</td>
              <td className="border-b border-line/70 px-3 py-3 font-black text-ink-700">{formatPercent(row.quality_score)}</td>
              <td className="max-w-44 truncate border-b border-line/70 px-3 py-3 font-mono text-[9px] text-ink-400" dir="ltr" title={row.checksum}>{row.checksum}</td>
              <td className="border-b border-line/70 px-3 py-3">
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex size-7 items-center justify-center rounded-md text-brand-700 hover:bg-brand-50" title="بازکردن منبع">
                    <ExternalLink size={14} />
                  </a>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ rows, query }: { rows: MissingDataRow[]; query: string }) {
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa');
    if (!normalized) return rows;
    return rows.filter((row) => `${row.indicator_code} ${row.indicator} ${row.reason} ${row.next_action}`.toLocaleLowerCase('fa').includes(normalized));
  }, [query, rows]);
  if (rows.length === 0) {
    return <EmptyTable icon={CheckCircle2} title="مورد مفقودی ثبت نشده است" detail="این وضعیت فقط زمانی معتبر است که هر ۴۱۹ شاخص تعیین‌تکلیف و پوشش آن‌ها کنترل شده باشد." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-right text-[10px]">
        <thead className="sticky top-0 bg-paper text-ink-500">
          <tr>
            {['کد', 'شاخص', 'وضعیت', 'مسیر تأمین', 'علت', 'اقدام بعدی', 'مسئول'].map((title) => (
              <th key={title} className="border-b border-line px-3 py-2.5 font-black">{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, index) => (
            <tr key={`${row.indicator_code}-${index}`} className="hover:bg-warn-soft/40">
              <td className="border-b border-line/70 px-3 py-3 font-mono font-black text-brand-800" dir="ltr">{row.indicator_code}</td>
              <td className="max-w-60 border-b border-line/70 px-3 py-3 font-bold text-ink-800">{row.indicator ?? '—'}</td>
              <td className="border-b border-line/70 px-3 py-3"><StatusBadge status={row.status} /></td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-500">{row.access_mode ?? '—'}</td>
              <td className="max-w-64 border-b border-line/70 px-3 py-3 text-ink-500">{row.reason}</td>
              <td className="max-w-72 border-b border-line/70 px-3 py-3 font-bold text-ink-700">{row.next_action}</td>
              <td className="border-b border-line/70 px-3 py-3 text-ink-500">{row.owner ?? 'تعیین‌نشده'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TypologyReport({
  report,
  refreshing,
  explaining,
  explanation,
  onRefresh,
  onExplain,
  onDismissExplanation,
  onOpenGeoportal,
}: TypologyReportProps) {
  const [tab, setTab] = useState<'indicators' | 'evidence' | 'missing'>('indicators');
  const [query, setQuery] = useState('');
  const [indicatorStatusFilter, setIndicatorStatusFilter] = useState<IndicatorFilter>('all');
  const [copied, setCopied] = useState(false);
  const coverageRatio = report.coverage.total > 0 ? report.coverage.computed / report.coverage.total : 0;
  const canPublish = report.publication_level === 'VERIFIED';

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `typology-${report.run_id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const copyRunId = async () => {
    try {
      await navigator.clipboard.writeText(report.run_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black text-ink-900">{report.location.official_name}</h2>
            <StatusBadge status={report.publication_level} />
            {report.scenario.requires_review && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn-soft px-2 py-1 text-[10px] font-black text-warn-700">
                <TriangleAlert size={11} /> نیازمند بازبینی
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-ink-500">
            {report.location.province}{report.location.city_or_county ? `، ${report.location.city_or_county}` : ''}
            <span className="mx-2 text-line-strong">|</span>
            اجرای <span className="font-mono" dir="ltr">{report.run_id}</span>
          </p>
          <p className="mt-1 text-[9px] font-medium text-ink-400">
            رجیستر {report.registry_version || '—'} · سال مرجع {report.reference_year ? integerFa.format(report.reference_year) : '—'} · آخرین بروزرسانی {formatDate(report.updated_at)}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {report.location.province_id && onOpenGeoportal && (
            <button type="button" onClick={() => onOpenGeoportal(report.location.province_id!)} className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[10px] font-black text-ink-700 hover:border-brand-300 hover:text-brand-800">
              <MapPinned size={14} /> ژئوپرتال استان
            </button>
          )}
          <button type="button" onClick={copyRunId} className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 hover:border-brand-300 hover:text-brand-800" title="کپی شناسه اجرا" aria-label="کپی شناسه اجرا">
            {copied ? <Check size={15} className="text-ok-700" /> : <Copy size={15} />}
          </button>
          <button type="button" onClick={downloadReport} className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 hover:border-brand-300 hover:text-brand-800" title="دانلود گزارش JSON" aria-label="دانلود گزارش JSON">
            <Download size={15} />
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 hover:border-brand-300 hover:text-brand-800" title="چاپ گزارش" aria-label="چاپ گزارش">
            <Printer size={15} />
          </button>
          <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink-600 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50" title="به‌روزرسانی گزارش">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!canPublish && (
        <div className="flex items-start gap-3 border-r-4 border-warn bg-warn-soft px-4 py-3 text-warn-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-black">این نتیجه مجوز انتشار تأییدشده ندارد.</p>
            <p className="mt-1 text-[10px] font-medium leading-5">مقادیر ناموجود صفر تلقی نشده‌اند و گونه فقط با پوشش، اعتماد و شواهد نمایش‌داده‌شده قابل تفسیر است.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <article className="rounded-lg border border-line bg-surface p-3 shadow-sm">
          <span className="text-[9px] font-black text-ink-400">رجیستر</span>
          <strong className="mt-1 block text-xl font-black text-ink-900">{integerFa.format(report.coverage.total)}</strong>
          <span className="text-[9px] font-bold text-ink-500">شاخص یکتا</span>
        </article>
        <article className="rounded-lg border border-line bg-surface p-3 shadow-sm">
          <span className="text-[9px] font-black text-ink-400">محاسبه‌شده</span>
          <strong className="mt-1 block text-xl font-black text-ok-700">{integerFa.format(report.coverage.computed)}</strong>
          <span className="text-[9px] font-bold text-ink-500">{formatPercent(coverageRatio)} از رجیستر</span>
        </article>
        <article className="rounded-lg border border-line bg-surface p-3 shadow-sm">
          <span className="text-[9px] font-black text-ink-400">ناموجود / در انتظار</span>
          <strong className="mt-1 block text-xl font-black text-warn-700">{integerFa.format(report.coverage.missing)}</strong>
          <span className="text-[9px] font-bold text-ink-500">اقدام تکمیلی لازم</span>
        </article>
        <article className="rounded-lg border border-line bg-surface p-3 shadow-sm">
          <span className="text-[9px] font-black text-ink-400">اطمینان مرز</span>
          <strong className="mt-1 block text-xl font-black text-ink-900">{formatPercent(report.boundary?.confidence)}</strong>
          <span className="text-[9px] font-bold text-ink-500">{report.boundary?.source ?? 'مرز ثبت نشده'}</span>
        </article>
        <article className="col-span-2 rounded-lg border border-line bg-surface p-3 shadow-sm lg:col-span-1">
          <span className="text-[9px] font-black text-ink-400">پایداری برچسب</span>
          <strong className="mt-1 block text-xl font-black text-ink-900">{formatPercent(report.label_stability)}</strong>
          <span className="text-[9px] font-bold text-ink-500">bootstrap / Monte Carlo</span>
        </article>
      </div>

      <section className="grid gap-6 border-t border-line pt-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-black text-ink-800"><Gauge size={15} className="text-brand-700" /> نمره و پوشش سه ساحت</h3>
            <span className="text-[9px] font-bold text-ink-400">مقیاس پیوسته ۱ تا ۵</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(['physical', 'behavioral', 'normative'] as DomainKey[]).map((key) => (
              <div key={key}><DomainScoreCard domain={report.domains[key]} /></div>
            ))}
          </div>

          <div className="mt-5">
            <h3 className="mb-3 text-xs font-black text-ink-800">پوشش و عملکرد ۱۰ پیشران</h3>
            {report.drivers.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {report.drivers.map((driver) => (
                  <article key={driver.code} className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-[9px] font-black text-brand-700" dir="ltr">{driver.code}</span>
                        <p className="mt-0.5 truncate text-[10px] font-black text-ink-700" title={driver.title}>{driver.title}</p>
                      </div>
                      <span className="text-base font-black text-ink-900">{formatScore(driver.score)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1"><CoverageBar value={driver.coverage} /></div>
                      <span className="w-8 text-left text-[8px] font-bold text-ink-400">{formatPercent(driver.coverage)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyTable icon={Gauge} title="امتیاز پیشران‌ها هنوز آماده نیست" detail="تا رسیدن ورودی‌های معتبر، وزن شاخص‌های موجود برای پنهان‌کردن کمبود داده بازنرمال نمی‌شود." />
            )}
          </div>
        </div>

        <aside className="xl:border-r xl:border-line xl:pr-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-ink-800">توازن سه‌ساحتی</h3>
            <span className="rounded-md bg-brand-50 px-2 py-1 text-[9px] font-black text-brand-800">SI = {formatScore(report.si)}</span>
          </div>
          <Radar domains={report.domains} />
          <div className="border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-black text-ink-400">تشخیص ناترازی</span>
              {report.scenario.pattern && <span className="font-mono text-[10px] font-black text-ink-500" dir="ltr">{report.scenario.pattern}</span>}
            </div>
            <p className="mt-1.5 text-sm font-black text-ink-900">{report.scenario.label}</p>
            {report.scenario.explanation && <p className="mt-2 text-[10px] font-medium leading-5 text-ink-500">{report.scenario.explanation}</p>}
          </div>
          <button type="button" onClick={onExplain} disabled={explaining} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-800 px-4 text-[11px] font-black text-white hover:bg-brand-900 disabled:opacity-60">
            {explaining ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {explaining ? 'در حال تحلیل شواهد…' : 'توضیح هوشمند نتیجه'}
          </button>
          <p className="mt-2 text-center text-[8px] font-bold text-ink-400">عامل هوش مصنوعی فقط داده‌های محاسبه‌شده و شواهد ثبت‌شده را توضیح می‌دهد.</p>
        </aside>
      </section>

      {explanation && (
        <section className="relative border-y border-brand-200 bg-brand-50 px-4 py-4">
          <button type="button" onClick={onDismissExplanation} className="absolute left-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-surface hover:text-ink-700" title="بستن توضیح">
            <X size={14} />
          </button>
          <div className="flex items-start gap-3 pl-8">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white"><Bot size={16} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[11px] font-black text-ink-800">توضیح حکیم بر پایه شواهد همین اجرا</h3>
                <span className="rounded-full border border-brand-200 bg-surface px-2 py-0.5 text-[8px] font-black text-brand-700">{explanation.generated_by === 'ai' ? 'مدل هوش مصنوعی' : 'توضیح قطعی'}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[10.5px] font-medium leading-6 text-ink-700">{explanation.text}</p>
              {explanation.caveats?.length ? (
                <ul className="mt-3 space-y-1 border-r-2 border-warn pr-3 text-[9px] font-bold text-warn-700">
                  {explanation.caveats.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-line pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-black text-ink-800">دفتر ممیزی اجرا</h3>
            <p className="mt-1 text-[9px] font-medium text-ink-400">مقدار، منشأ و کمبود داده بدون ادغام یا عددسازی</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <label className="relative block min-w-0 flex-1 sm:flex-none">
              <Search size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی کد یا عنوان" className="h-9 w-full rounded-md border border-line bg-surface pr-8 pl-3 text-[10px] font-bold text-ink-700 outline-none focus:border-brand-500 sm:w-56" />
            </label>
            {tab === 'indicators' && (
              <select
                value={indicatorStatusFilter}
                onChange={(event) => setIndicatorStatusFilter(event.target.value as IndicatorFilter)}
                aria-label="فیلتر وضعیت شاخص"
                className="h-9 rounded-md border border-line bg-surface px-2.5 text-[10px] font-black text-ink-700 outline-none focus:border-brand-500"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="ready">محاسبه‌شده</option>
                <option value="attention">نیازمند اقدام</option>
              </select>
            )}
            <div className="inline-flex h-9 max-w-full overflow-x-auto rounded-md border border-line bg-paper p-1">
              {([
                ['indicators', 'شاخص‌ها', report.indicators.length, TableProperties],
                ['evidence', 'شواهد', report.evidence.length, ShieldCheck],
                ['missing', 'کمبود داده', report.missing_data.length, FileClock],
              ] as const).map(([id, label, count, Icon]) => (
                <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded px-2.5 text-[9px] font-black transition-colors ${tab === id ? 'bg-surface text-brand-800 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>
                  <Icon size={12} /> {label} <span className="text-[8px] opacity-60">{integerFa.format(count)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 max-h-[560px] overflow-auto border-y border-line bg-surface">
          {tab === 'indicators' && <IndicatorsTable rows={report.indicators} query={query} statusFilter={indicatorStatusFilter} />}
          {tab === 'evidence' && <EvidenceTable rows={report.evidence} query={query} />}
          {tab === 'missing' && <MissingTable rows={report.missing_data} query={query} />}
        </div>
      </section>
    </div>
  );
}
