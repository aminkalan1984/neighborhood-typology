import {
  CheckCircle2,
  History,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type {
  TypologyAuditEvent,
  TypologyReviewer,
  VerificationGates,
} from './types';

interface TypologyGovernancePanelProps {
  publicationLevel: string;
  gates: VerificationGates;
  events: TypologyAuditEvent[];
  reviewer: TypologyReviewer | null;
}

const integerFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

const statusLabels: Record<string, string> = {
  CREATED: 'ایجاد اجرا',
  LOCATION_AMBIGUOUS: 'رفع ابهام مکانی',
  BOUNDARY_CONFIRMED: 'مرز تأییدشده',
  COLLECTING: 'گردآوری داده',
  WAITING_FOR_RESTRICTED_DATA: 'در انتظار داده',
  COMPUTING: 'محاسبه',
  QA_REVIEW: 'کنترل کیفیت',
  PROVISIONAL: 'موقت',
  VERIFIED: 'تأییدشده',
  REJECTED: 'ردشده',
};

const actionLabels: Record<string, string> = {
  RUN_CREATED: 'اجرای گونه‌شناسی ایجاد شد',
  LOCATION_RESOLUTION_CREATED: 'گزینه‌های مکانی ساخته شد',
  BOUNDARY_CONFIRMED: 'مرز محله تأیید شد',
  COLLECTION_STARTED: 'برنامه تأمین داده آغاز شد',
  WAITING_FOR_REQUIRED_INPUTS: 'پرونده در انتظار ورودی‌های لازم قرار گرفت',
  EVIDENCE_ADDED: 'شواهد جدید ثبت شد',
  DETERMINISTIC_RECOMPUTE_STARTED: 'محاسبه قطعی آغاز شد',
  DETERMINISTIC_RECOMPUTE_FINISHED: 'محاسبه قطعی پایان یافت',
  RUN_VERIFIED: 'پرونده تأیید نهایی شد',
  APPROVAL_RECORDED_WITH_UNMET_GATES: 'تأیید موقت با موانع انتشار ثبت شد',
  RUN_REJECTED: 'پرونده توسط بازبین رد شد',
};

const domainLabels: Record<string, string> = {
  physical: 'ساحت کالبدی',
  behavioral: 'ساحت رفتاری',
  normative: 'ساحت هنجاری',
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || '—'
    : date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatVerificationGate(code: string): string {
  if (code === 'score_not_computed') return 'امتیاز سه‌ساحتی هنوز محاسبه نشده است.';
  if (code === 'boundary_confidence_below_0_90') return 'اطمینان مرز کمتر از ۹۰٪ است.';
  if (code === 'label_stability_not_computed') return 'پایداری برچسب هنوز محاسبه نشده است.';
  if (code === 'label_stability_below_0_80') return 'پایداری برچسب کمتر از ۸۰٪ است.';
  if (code === 'invalid_measurements_present') return 'اندازه‌گیری نامعتبر در نتیجه وجود دارد.';
  if (code === 'reviewer_rejected') return 'بازبین پرونده را رد کرده است.';

  const coverage = code.match(/^(.+)_coverage_below_0_(\d+)$/);
  if (coverage) {
    const subject = domainLabels[coverage[1]] ?? `پیشران ${coverage[1]}`;
    return `پوشش ${subject} کمتر از ${integerFa.format(Number(coverage[2]))}٪ است.`;
  }
  return code;
}

export function summarizeAuditEvent(event: TypologyAuditEvent): string | null {
  const details = event.details ?? {};
  const computed = typeof details.computed_indicators === 'number' ? details.computed_indicators : null;
  const missing = typeof details.missing_indicators === 'number' ? details.missing_indicators : null;
  const candidates = typeof details.candidates === 'number' ? details.candidates : null;
  const records = Array.isArray(details.record_ids) ? details.record_ids.length : null;
  if (computed !== null || missing !== null) {
    return `${computed === null ? '' : `${integerFa.format(computed)} محاسبه‌شده`}${computed !== null && missing !== null ? '، ' : ''}${missing === null ? '' : `${integerFa.format(missing)} در انتظار`}`;
  }
  if (candidates !== null) return `${integerFa.format(candidates)} گزینه مکانی`;
  if (records !== null) return `${integerFa.format(records)} رکورد شواهد`;
  return null;
}

export function publicationReadiness(publicationLevel: string, gates: VerificationGates): { ready: boolean; label: string } {
  if (!gates.eligible) return { ready: false, label: `${integerFa.format(gates.failures.length)} مانع فعال` };
  if (publicationLevel === 'VERIFIED') return { ready: true, label: 'انتشار تأییدشده' };
  return { ready: true, label: 'آماده تصمیم بازبین' };
}

export default function TypologyGovernancePanel({
  publicationLevel,
  gates,
  events,
  reviewer,
}: TypologyGovernancePanelProps) {
  const recentEvents = [...events]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);
  const readiness = publicationReadiness(publicationLevel, gates);

  return (
    <section className="grid gap-6 border-y border-line py-5 xl:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]" dir="rtl" aria-label="حاکمیت و ممیزی پرونده">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-black text-ink-900">
              <ShieldCheck size={16} className="text-brand-700" /> آمادگی انتشار
            </h2>
            <p className="mt-1 text-[10px] font-bold text-ink-500">دروازه‌های قطعی پیش از تأیید نهایی پرونده</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black ${readiness.ready ? 'border-ok/30 bg-ok-soft text-ok-700' : 'border-warn/30 bg-warn-soft text-warn-700'}`}>
            {readiness.ready ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />}
            {readiness.label}
          </span>
        </div>

        {gates.failures.length > 0 ? (
          <ul className="mt-4 max-h-64 space-y-2 overflow-auto border-y border-line py-2 pl-1">
            {gates.failures.map((failure) => (
              <li key={failure} className="flex items-start gap-2 px-1 py-1 text-[10px] font-bold leading-5 text-ink-600">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />
                <span>{formatVerificationGate(failure)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex items-start gap-2 border-y border-ok/20 bg-ok-soft px-3 py-3 text-[10px] font-bold leading-5 text-ok-700">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> همه شروط پوشش، مرز، کیفیت و پایداری برچسب برقرار است.
          </div>
        )}

        {reviewer && (
          <div className="mt-4 flex items-start gap-3 border-r-2 border-brand-300 pr-3">
            <UserRound size={15} className="mt-0.5 shrink-0 text-brand-700" />
            <div className="min-w-0 text-[10px] font-bold text-ink-500">
              <p className="font-black text-ink-800">{reviewer.name || reviewer.id || 'بازبین ثبت‌شده'}</p>
              <p className="mt-1">تصمیم: {reviewer.decision === 'reject' ? 'رد' : 'تأیید'}{reviewer.at ? ` · ${formatDate(reviewer.at)}` : ''}</p>
              {reviewer.reason && <p className="mt-1 leading-5 text-ink-600">{reviewer.reason}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 xl:border-r xl:border-line xl:pr-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-black text-ink-900">
              <History size={16} className="text-brand-700" /> خط زمانی ممیزی
            </h2>
            <p className="mt-1 text-[10px] font-bold text-ink-500">آخرین تغییر وضعیت‌ها و عملیات داده‌ای این اجرا</p>
          </div>
          <span className="text-[9px] font-black text-ink-400">{integerFa.format(events.length)} رویداد</span>
        </div>

        {recentEvents.length > 0 ? (
          <ol className="mt-4 max-h-80 overflow-auto border-y border-line">
            {recentEvents.map((event) => {
              const summary = summarizeAuditEvent(event);
              return (
                <li key={event.id} className="grid gap-1 border-b border-line/70 px-1 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-ink-800">{actionLabels[event.action] ?? event.action}</p>
                    <p className="mt-1 text-[9px] font-bold text-ink-400">
                      {event.actor}
                      {event.from_status && event.to_status ? ` · ${statusLabels[event.from_status] ?? event.from_status} ← ${statusLabels[event.to_status] ?? event.to_status}` : ''}
                      {summary ? ` · ${summary}` : ''}
                    </p>
                  </div>
                  <time className="whitespace-nowrap text-[8px] font-bold text-ink-400" dateTime={event.at}>{formatDate(event.at)}</time>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 border-y border-line py-5 text-center text-[10px] font-bold text-ink-400">رویداد ممیزی در پاسخ سرویس ثبت نشده است.</p>
        )}
      </div>
    </section>
  );
}
