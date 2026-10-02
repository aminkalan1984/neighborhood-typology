import { useMemo, useState } from 'react';
import { Download, Filter, FolderSearch, RefreshCw, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { TypologyDataCatalogSummary, TypologyReport } from './types';

interface TypologyDataAuditDashboardProps {
  report: TypologyReport;
  catalog: TypologyDataCatalogSummary | null;
  catalogLoading?: boolean;
  onRefreshCatalog?: () => void;
}

type AuditFilter = 'all' | 'computed' | 'missing' | 'local' | 'proxy' | 'unmatched';

const integerFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const numberFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

function pct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

function pctText(value: number | null | undefined): string {
  return `${numberFa.format(pct(value))}٪`;
}

function domainLabel(domain: string): string {
  return domain === 'physical' ? 'کالبدی' : domain === 'behavioral' ? 'رفتاری' : domain === 'normative' ? 'هنجاری' : domain;
}

function availabilityLabel(value: string): string {
  if (value === 'direct_local_or_boundary_extract') return 'منبع محلی قابل استخراج';
  if (value === 'province_or_auxiliary_proxy') return 'پروکسی استانی / کمکی';
  if (value === 'candidate_source_requires_formula_owner') return 'نیازمند فرمول و مالک داده';
  return 'بدون تطبیق خودکار';
}

function availabilityTone(value: string): string {
  if (value === 'direct_local_or_boundary_extract') return 'bg-ok-soft text-ok-700 border-ok/30';
  if (value === 'province_or_auxiliary_proxy') return 'bg-warn-soft text-warn-700 border-warn/30';
  return 'bg-ink-50 text-ink-500 border-line';
}

function auditRows(report: TypologyReport, catalog: TypologyDataCatalogSummary | null) {
  return report.indicators.map((indicator) => {
    const link = catalog?.indicator_links[indicator.code];
    const computed = ['COMPUTED', 'APPROVED'].includes(indicator.status);
    const evidence = indicator.evidence_ids?.length ?? 0;
    const confidence = indicator.confidence ?? 0;
    const sourceQuality = confidence >= 0.75 ? 'بالا' : confidence >= 0.45 ? 'متوسط' : confidence > 0 ? 'پایین' : 'ثبت نشده';
    return { indicator, link, computed, evidence, confidence, sourceQuality };
  });
}

function downloadCsv(rows: ReturnType<typeof auditRows>) {
  const header = ['code', 'indicator', 'domain', 'status', 'computed', 'raw_value', 'unit', 'reference_date', 'coverage', 'confidence', 'quality', 'evidence_count', 'availability', 'source_tags', 'candidate_paths', 'flags'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = rows.map(({ indicator, link, computed, evidence, confidence, sourceQuality }) => [
    indicator.code, indicator.indicator, indicator.domain, indicator.status, computed ? 'true' : 'false', indicator.raw_value ?? '', indicator.unit ?? '', indicator.reference_date ?? '', pct(indicator.coverage), pct(confidence), sourceQuality,
    evidence, link?.availability ?? 'no_automatic_local_match', link?.source_tags.join('|') ?? '', link?.candidate_paths.join('|') ?? '', indicator.flags?.join('|') ?? '',
  ].map(escape).join(','));
  const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `typology-data-audit-${reportId(rows)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reportId(rows: ReturnType<typeof auditRows>): string {
  return rows[0]?.indicator.code.split('-')[0]?.toLowerCase() ?? 'run';
}

export default function TypologyDataAuditDashboard({ report, catalog, catalogLoading = false, onRefreshCatalog }: TypologyDataAuditDashboardProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [domain, setDomain] = useState('all');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const rows = useMemo(() => auditRows(report, catalog), [catalog, report]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa');
    return rows.filter(({ indicator, link, computed }) => {
      const text = `${indicator.code} ${indicator.indicator} ${indicator.status} ${link?.source_tags.join(' ') ?? ''}`.toLocaleLowerCase('fa');
      const matchesQuery = !normalized || text.includes(normalized);
      const matchesDomain = domain === 'all' || indicator.domain === domain;
      const availability = link?.availability ?? 'no_automatic_local_match';
      const matchesFilter = filter === 'all'
        || (filter === 'computed' && computed)
        || (filter === 'missing' && !computed)
        || (filter === 'local' && availability === 'direct_local_or_boundary_extract')
        || (filter === 'proxy' && availability === 'province_or_auxiliary_proxy')
        || (filter === 'unmatched' && availability === 'no_automatic_local_match');
      return matchesQuery && matchesDomain && matchesFilter;
    });
  }, [domain, filter, query, rows]);
  const stats = useMemo(() => {
    const computed = rows.filter((row) => row.computed).length;
    const evidence = rows.filter((row) => row.evidence > 0).length;
    const local = rows.filter((row) => row.link?.availability === 'direct_local_or_boundary_extract').length;
    const proxy = rows.filter((row) => row.link?.availability === 'province_or_auxiliary_proxy').length;
    const qualityValues = rows.map((row) => row.confidence).filter((value) => value > 0);
    const quality = qualityValues.length ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length : 0;
    return { total: rows.length, computed, missing: rows.length - computed, evidence, local, proxy, quality };
  }, [rows]);
  const selected = selectedCode ? rows.find((row) => row.indicator.code === selectedCode) : null;

  return (
    <section className="border-y border-line bg-paper py-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-800"><ShieldCheck size={17} /><h2 className="text-sm font-black text-ink-900">داشبورد ممیزی داده ۴۱۹ شاخص</h2></div>
          <p className="mt-1 text-[10px] font-medium leading-5 text-ink-500">پوشش محاسباتی، کیفیت شواهد، سطح جغرافیایی و مسیر منبع هر شاخص در یک دفتر قابل فیلتر.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefreshCatalog && <button type="button" onClick={onRefreshCatalog} disabled={catalogLoading} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[10px] font-black text-ink-700 hover:border-brand-300 disabled:opacity-50"><RefreshCw size={13} className={catalogLoading ? 'animate-spin' : ''} /> به‌روزرسانی کاتالوگ</button>}
          <button type="button" onClick={() => downloadCsv(rows)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 text-[10px] font-black text-brand-800 hover:bg-brand-100"><Download size={13} /> خروجی CSV</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {[
          ['کل شاخص‌ها', stats.total, 'text-ink-900'], ['محاسبه‌شده', stats.computed, 'text-ok-700'], ['در صف تکمیل', stats.missing, 'text-warn-700'], ['دارای شاهد', stats.evidence, 'text-brand-800'], ['منبع محلی', stats.local, 'text-ok-700'], ['پروکسی استانی', stats.proxy, 'text-warn-700'], ['کیفیت میانگین', pctText(stats.quality), 'text-ink-900'],
        ].map(([label, value, tone]) => <article key={String(label)} className="rounded-lg border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">{label}</span><strong className={`mt-1 block text-xl font-black ${tone}`}>{typeof value === 'number' ? integerFa.format(value) : value}</strong></article>)}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)]">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2"><Filter size={14} className="text-brand-700" /><span className="text-[10px] font-black text-ink-700">فیلتر ممیزی</span><label className="relative min-w-48 flex-1"><Search size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-300" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="کد، عنوان یا برچسب منبع" className="h-8 w-full rounded-md border border-line bg-paper pr-7 pl-2 text-[10px] font-bold outline-none focus:border-brand-500" /></label><SlidersHorizontal size={14} className="text-ink-400" /></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{([['all', 'همه'], ['computed', 'محاسبه‌شده'], ['missing', 'در انتظار'], ['local', 'منبع محلی'], ['proxy', 'پروکسی'], ['unmatched', 'بدون تطبیق']] as [AuditFilter, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${filter === key ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-paper text-ink-500 hover:border-brand-300'}`}>{label}</button>)}<select value={domain} onChange={(event) => setDomain(event.target.value)} className="h-7 rounded-md border border-line bg-paper px-2 text-[9px] font-black text-ink-600"><option value="all">همه ساحت‌ها</option><option value="physical">کالبدی</option><option value="behavioral">رفتاری</option><option value="normative">هنجاری</option></select></div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3"><div className="flex items-center justify-between text-[9px] font-black text-ink-500"><span>پوشش محاسباتی</span><span>{pctText(stats.total ? stats.computed / stats.total : 0)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-ok-600" style={{ width: `${stats.total ? stats.computed / stats.total * 100 : 0}%` }} /></div><div className="mt-3 flex items-center justify-between text-[9px] font-bold text-ink-400"><span>کیفیت میانگین شواهد</span><span>{pctText(stats.quality)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${pct(stats.quality)}%` }} /></div></div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-right text-[10px]"><thead className="bg-paper text-ink-500"><tr>{['کد / شاخص', 'ساحت', 'وضعیت اجرا', 'پوشش مکانی', 'کیفیت', 'شاهد', 'قابلیت منبع', 'برچسب‌ها'].map((title) => <th key={title} className="border-b border-line px-3 py-2.5 font-black">{title}</th>)}</tr></thead><tbody>{filtered.map(({ indicator, link, computed, evidence, confidence, sourceQuality }) => <tr key={indicator.code} onClick={() => setSelectedCode(indicator.code)} className={`cursor-pointer hover:bg-brand-50/50 ${selectedCode === indicator.code ? 'bg-brand-50' : ''}`}><td className="max-w-80 border-b border-line/70 px-3 py-2.5"><span className="font-mono font-black text-brand-800" dir="ltr">{indicator.code}</span><p className="mt-1 font-bold text-ink-800">{indicator.indicator}</p></td><td className="border-b border-line/70 px-3 py-2.5 text-ink-600">{domainLabel(indicator.domain)}</td><td className="border-b border-line/70 px-3 py-2.5"><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${computed ? 'border-ok/30 bg-ok-soft text-ok-700' : 'border-warn/30 bg-warn-soft text-warn-700'}`}>{computed ? 'محاسبه‌شده' : indicator.status}</span></td><td className="border-b border-line/70 px-3 py-2.5 font-black">{pctText(indicator.coverage)}</td><td className="border-b border-line/70 px-3 py-2.5">{sourceQuality}<div className="mt-1 h-1 w-16 rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${pct(confidence)}%` }} /></div></td><td className="border-b border-line/70 px-3 py-2.5">{integerFa.format(evidence)}</td><td className="border-b border-line/70 px-3 py-2.5"><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${availabilityTone(link?.availability ?? 'no_automatic_local_match')}`}>{availabilityLabel(link?.availability ?? 'no_automatic_local_match')}</span></td><td className="max-w-52 border-b border-line/70 px-3 py-2.5 text-ink-500">{link?.source_tags?.join('، ') || '—'}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="p-8 text-center text-[10px] font-bold text-ink-400">نتیجه‌ای برای فیلتر انتخاب‌شده وجود ندارد.</div>}</div>

      {selected && <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="font-mono text-[10px] font-black text-brand-800" dir="ltr">{selected.indicator.code}</span><h3 className="mt-1 text-xs font-black text-ink-900">{selected.indicator.indicator}</h3></div><button type="button" onClick={() => setSelectedCode(null)} className="text-[9px] font-black text-brand-700">بستن جزئیات</button></div><div className="mt-3 grid gap-3 text-[9px] sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-ink-400">قابلیت منبع</span><p className="mt-1 font-black text-ink-700">{availabilityLabel(selected.link?.availability ?? 'no_automatic_local_match')}</p></div><div><span className="text-ink-400">برچسب‌های موضوعی</span><p className="mt-1 font-black text-ink-700">{selected.link?.source_tags.join('، ') || 'ثبت نشده'}</p></div><div><span className="text-ink-400">تعداد شواهد</span><p className="mt-1 font-black text-ink-700">{integerFa.format(selected.evidence)}</p></div><div><span className="text-ink-400">مسیرهای کاندید</span><p className="mt-1 break-all font-mono text-[8px] text-ink-600">{selected.link?.candidate_paths.join(' ← ') || 'مسیر ثبت نشده'}</p></div></div></div>}
      {!catalog && <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-warn-700"><FolderSearch size={13} /> کاتالوگ منبع در دسترس نیست؛ جدول بر پایه گزارش اجرای جاری نمایش داده می‌شود.</div>}
    </section>
  );
}
