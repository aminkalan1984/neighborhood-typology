import { AlertTriangle, CheckCircle2, CircleHelp, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import type {
  AnalyticalDomainProfile,
  AnalyticalTypologyProfile,
  DomainKey,
  DualLayerTypologySummary,
  FuzzyTypologyMembership,
  OfficialTypologyMembership,
  TypologyReport,
  TypologyUncertaintySummary,
} from './types';

export interface TypologyDualLayerSummaryProps {
  /** The new dual-layer payload. */
  summary?: DualLayerTypologySummary | null;
  /** Optional report input makes adoption easy for callers that already hold a report. */
  report?: Pick<TypologyReport, 'dual_layer_typology' | 'dualLayerTypology'> | null;
  className?: string;
  title?: string;
}

const numberFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const percentFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

const domainLabels: Record<DomainKey, string> = {
  physical: 'کالبدی-زیرساختی',
  behavioral: 'رفتاری',
  normative: 'هنجاری',
};

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Convert either a ratio (0..1), percentage (0..100), or score (0..5) to 0..100. */
export function asPercent(value: number | null | undefined, scoreScale = false): number | null {
  const numeric = finiteNumber(value);
  if (numeric === null) return null;
  if (numeric >= 0 && numeric <= 1) return numeric * 100;
  if (scoreScale && numeric <= 5) return (numeric / 5) * 100;
  return Math.max(0, Math.min(100, numeric));
}

function percentText(value: number | null | undefined, scoreScale = false): string {
  const percent = asPercent(value, scoreScale);
  return percent === null ? '—' : `${percentFa.format(percent)}٪`;
}

function scoreText(value: number | null | undefined): string {
  const numeric = finiteNumber(value);
  return numeric === null ? '—' : numberFa.format(numeric);
}

function clampMembership(value: number | null | undefined): number | null {
  const numeric = finiteNumber(value);
  if (numeric === null) return null;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function membershipText(value: number | null | undefined): string {
  const membership = clampMembership(value);
  return membership === null ? '—' : `${percentFa.format(membership * 100)}٪`;
}

function resolveSummary(
  summary?: DualLayerTypologySummary | null,
  report?: Pick<TypologyReport, 'dual_layer_typology' | 'dualLayerTypology'> | null,
): DualLayerTypologySummary | null {
  return summary ?? report?.dual_layer_typology ?? report?.dualLayerTypology ?? null;
}

function profileDomain(profile: AnalyticalTypologyProfile, key: DomainKey): AnalyticalDomainProfile | null {
  const direct = profile[key];
  if (direct && typeof direct === 'object') return direct;
  if (typeof direct === 'number') return { key, score: direct };
  return profile.domains?.[key] ?? null;
}

function domainScore(profile: AnalyticalTypologyProfile, key: DomainKey): number | null {
  const profileValue = profile[key === 'physical' ? 'P' : key === 'behavioral' ? 'B' : 'N'];
  return finiteNumber(profileValue) ?? finiteNumber(profileDomain(profile, key)?.score);
}

function coverageEntries(coverage: DualLayerTypologySummary['coverage']): Array<[string, number | null]> {
  if (coverage === null || coverage === undefined) return [];
  if (typeof coverage === 'number') return [['کل شاخص‌ها', coverage]];
  if ('coverage' in coverage || 'computed' in coverage || 'weighted' in coverage) {
    const objectCoverage = coverage as { coverage?: number | null; computed?: number | null; weighted?: number | null };
    const value = objectCoverage.coverage ?? objectCoverage.weighted ?? objectCoverage.computed ?? null;
    return [['کل شاخص‌ها', value]];
  }
  return Object.entries(coverage).map(([key, value]) => [key, finiteNumber(value)]);
}

function formatCoverageKey(key: string): string {
  if (key === 'physical' || key === 'P') return 'ساحت کالبدی';
  if (key === 'behavioral' || key === 'B') return 'ساحت رفتاری';
  if (key === 'normative' || key === 'N') return 'ساحت هنجاری';
  if (key === 'overall' || key === 'total' || key === 'all') return 'کل شاخص‌ها';
  return key;
}

function officialLabels(summary: DualLayerTypologySummary): OfficialTypologyMembership[] {
  return summary.official_labels ?? summary.officialLabels ?? [];
}

function fuzzyMemberships(summary: DualLayerTypologySummary): FuzzyTypologyMembership[] {
  return summary.fuzzy_memberships ?? summary.fuzzyMemberships ?? [];
}

function analyticalProfile(summary: DualLayerTypologySummary): AnalyticalTypologyProfile | null {
  return summary.analytical_profile ?? summary.analyticalProfile ?? null;
}

function uncertaintyText(uncertainty: TypologyUncertaintySummary | null | undefined): string | null {
  if (!uncertainty) return null;
  const low = finiteNumber(uncertainty.low);
  const high = finiteNumber(uncertainty.high);
  if (low !== null || high !== null) {
    return `${low === null ? '—' : numberFa.format(low)} تا ${high === null ? '—' : numberFa.format(high)}`;
  }
  const stability = uncertainty.label_stability ?? uncertainty.labelStability;
  return stability == null ? null : `پایداری برچسب: ${percentText(stability)}`;
}

function QualityBar({ value, tone = 'bg-brand-600', scoreScale = false }: { value: number | null | undefined; tone?: string; scoreScale?: boolean }) {
  const width = asPercent(value, scoreScale) ?? 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function OfficialLabelCard({ item, itemKey }: { item: OfficialTypologyMembership; itemKey?: string }) {
  const eligible = item.eligible !== false;
  const membership = clampMembership(item.membership ?? item.confidence ?? item.score);
  return (
    <article
      key={itemKey}
      className={`rounded-lg border p-3 ${eligible ? 'border-brand-200 bg-brand-50/50' : 'border-line bg-paper'}`}
      data-testid="official-typology"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[9px] font-black text-brand-800" dir="ltr">{item.code}</span>
            {item.overlap && <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[8px] font-black text-violet-700">هم‌پوشان</span>}
          </div>
          <h4 className="mt-1 text-[11px] font-black text-ink-900">{item.label_fa ?? item.label ?? item.code}</h4>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black ${eligible ? 'border-ok/30 bg-ok-soft text-ok-700' : 'border-line bg-surface text-ink-500'}`}>
          {eligible ? <CheckCircle2 size={11} /> : <CircleHelp size={11} />}
          {eligible ? 'واجد شرایط' : 'غیرواجد شرایط'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-ink-500">
        <span>عضویت/اطمینان</span><strong className="text-ink-800">{membershipText(membership)}</strong>
      </div>
      <QualityBar value={membership} tone={eligible ? 'bg-brand-600' : 'bg-ink-300'} />
      {item.reason && <p className="mt-2 text-[9px] font-medium leading-5 text-ink-600">{item.reason}</p>}
      {item.intervention && <p className="mt-2 border-r-2 border-brand-300 pr-2 text-[9px] font-bold leading-5 text-brand-800"><span className="text-brand-600">مداخله:</span> {item.intervention}</p>}
    </article>
  );
}

export function TypologyDualLayerSummary({ summary: inputSummary, report, className = '', title = 'خلاصه دو‌لایه گونه‌شناسی' }: TypologyDualLayerSummaryProps) {
  const summary = resolveSummary(inputSummary, report);
  if (!summary) {
    return (
      <section className={`rounded-lg border border-line bg-paper p-5 text-right ${className}`} dir="rtl" data-testid="dual-layer-empty">
        <div className="flex items-center gap-2 text-xs font-black text-ink-700"><Layers3 size={16} className="text-ink-400" />{title}</div>
        <p className="mt-3 text-[10px] font-bold leading-5 text-ink-500">خلاصه دو‌لایه برای این اجرا هنوز در پاسخ داده وجود ندارد.</p>
      </section>
    );
  }

  const profile = analyticalProfile(summary);
  const labels = officialLabels(summary);
  const fuzzy = fuzzyMemberships(summary);
  const coverage = coverageEntries(summary.coverage);
  const provisional = summary.provisional === true || ['PROVISIONAL', 'EXPLORATORY'].includes(String(summary.publication_level ?? summary.publicationLevel ?? '').toUpperCase());
  const uncertainty = uncertaintyText(summary.uncertainty);
  const quality = summary.quality ?? summary.confidence;

  return (
    <section className={`border-y border-line bg-paper py-6 ${className}`} dir="rtl" data-testid="dual-layer-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-ink-900"><Layers3 size={17} className="text-brand-700" />{title}</h2>
          <p className="mt-1 text-[10px] font-medium leading-5 text-ink-500">گونه‌های رسمیِ قابل استناد از پروفایل تحلیلی و عضویت فازی جدا نگه داشته شده‌اند.</p>
        </div>
        {provisional && (
          <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[9px] font-black text-warn-700" role="alert" data-testid="provisional-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>نتیجه موقت است؛ تا تکمیل پوشش، کیفیت و بازبینی کارشناسی برای تصمیم نهایی استفاده نشود.</span>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="official-typologies-title">
          <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-brand-700" /><h3 id="official-typologies-title" className="text-xs font-black text-ink-800">گونه‌های رسمی و چندبرچسبی</h3></div>
          <p className="mt-1 text-[9px] font-medium text-ink-400">برچسب‌ها می‌توانند هم‌زمان برقرار باشند؛ هم‌پوشانی به‌صورت حذف‌شده یا تک‌برچسبی گزارش نمی‌شود.</p>
          {labels.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{labels.map((item) => <div key={`${item.code}-${item.label_fa ?? item.label}`}><OfficialLabelCard item={item} /></div>)}</div> : <p className="mt-3 rounded-md border border-line px-3 py-4 text-center text-[10px] font-bold text-ink-400">گونه رسمی هنوز با شواهد کافی تعیین نشده است.</p>}
        </section>

        <section aria-labelledby="analytical-profile-title">
          <div className="flex items-center gap-2"><Sparkles size={15} className="text-brand-700" /><h3 id="analytical-profile-title" className="text-xs font-black text-ink-800">پروفایل تحلیلی پیوسته (P / B / N)</h3></div>
          {profile ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ['P', 'physical', domainScore(profile, 'physical')],
                  ['B', 'behavioral', domainScore(profile, 'behavioral')],
                  ['N', 'normative', domainScore(profile, 'normative')],
                  ['SI', 'si', profile.SI ?? profile.si],
                ] as const).map(([code, key, value]) => (
                  <article key={code} className="rounded-md border border-line bg-surface p-2.5" data-testid={`profile-${code}`}>
                    <span className="font-mono text-[9px] font-black text-brand-700" dir="ltr">{code}</span>
                    <strong className="mt-1 block text-lg font-black text-ink-900">{scoreText(value)}</strong>
                    <span className="text-[8px] font-bold text-ink-400">{key === 'si' ? 'شاخص ترکیبی' : domainLabels[key as DomainKey]}</span>
                    {key !== 'si' && <div className="mt-2"><QualityBar value={value} tone="bg-brand-600" scoreScale /></div>}
                  </article>
                ))}
              </div>
              {profile.dominant_domain && <p className="mt-3 text-[9px] font-bold text-ink-500">ساحت غالب: <span className="font-black text-ink-800">{domainLabels[profile.dominant_domain as DomainKey] ?? profile.dominant_domain}</span></p>}
            </>
          ) : <p className="mt-3 rounded-md border border-line px-3 py-4 text-center text-[10px] font-bold text-ink-400">پروفایل پیوسته هنوز قابل محاسبه نیست.</p>}

          <div className="mt-5 rounded-md border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-3"><h4 className="text-[10px] font-black text-ink-700">عضویت‌های فازی</h4><span className="text-[8px] font-bold text-ink-400">۰ تا ۱</span></div>
            {fuzzy.length > 0 ? <div className="mt-3 space-y-3">{fuzzy.map((item) => { const membership = clampMembership(item.membership); return <div key={`${item.code}-${item.label_fa ?? item.label ?? item.code}`} data-testid="fuzzy-membership"><div className="flex items-center justify-between gap-2 text-[9px] font-bold"><span className="truncate text-ink-700"><span className="font-mono text-brand-700" dir="ltr">{item.code}</span> · {item.label_fa ?? item.label ?? item.code}</span><strong className="text-ink-900">{membershipText(membership)}</strong></div><div className="mt-1"><QualityBar value={membership} tone="bg-violet-600" /></div>{item.description && <p className="mt-1 text-[8px] leading-4 text-ink-400">{item.description}</p>}</div>; })}</div> : <p className="mt-3 text-center text-[9px] font-bold text-ink-400">عضویت فازی ثبت نشده است.</p>}
          </div>
        </section>
      </div>

      <section className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="کیفیت و پوشش نتیجه">
        <article className="rounded-md border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">پوشش داده</span>{coverage.length > 0 ? <div className="mt-2 space-y-2">{coverage.map(([key, value]) => <div key={key}><div className="flex justify-between text-[8px] font-bold text-ink-500"><span>{formatCoverageKey(key)}</span><strong>{percentText(value)}</strong></div><div className="mt-1"><QualityBar value={value} tone="bg-ok-600" /></div></div>)}</div> : <p className="mt-2 text-[9px] font-bold text-ink-400">ثبت نشده</p>}</article>
        <article className="rounded-md border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">کیفیت منبع</span><strong className="mt-1 block text-xl font-black text-ink-900">{percentText(quality)}</strong><div className="mt-2"><QualityBar value={quality} tone="bg-brand-600" /></div></article>
        <article className="rounded-md border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">عدم‌قطعیت</span><strong className="mt-1 block text-sm font-black text-ink-900">{uncertainty ?? 'ثبت نشده'}</strong>{summary.uncertainty?.method && <p className="mt-1 text-[8px] font-bold leading-4 text-ink-400">روش: {summary.uncertainty.method}</p>}</article>
        <article className="rounded-md border border-line bg-surface p-3"><span className="text-[9px] font-black text-ink-400">هشدارهای کیفیت</span>{summary.warnings?.length ? <ul className="mt-2 space-y-1 text-[8px] font-bold leading-4 text-warn-700">{summary.warnings.slice(0, 4).map((warning) => <li key={warning}>• {warning}</li>)}</ul> : <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-ok-700"><CheckCircle2 size={12} /> هشدار ثبت نشده است.</p>}</article>
      </section>
    </section>
  );
}

export { resolveSummary };
export default TypologyDualLayerSummary;
