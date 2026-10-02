import { useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileJson,
  Loader2,
  RefreshCw,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  addTypologyEvidence,
  approveTypologyRun,
  recomputeTypologyRun,
  TypologyApiError,
} from './api';

interface TypologyOperationsPanelProps {
  runId: string;
  status: string;
  missingCount: number;
  evidenceCount: number;
  verificationEligible?: boolean;
  onChanged: () => Promise<void> | void;
}

type Operation = 'evidence' | 'review';

function readError(error: unknown): string {
  return error instanceof TypologyApiError ? error.message : 'عملیات روی پرونده انجام نشد.';
}

function parseRecords(value: unknown): Record<string, unknown>[] {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rows: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(source.records)
      ? source.records
      : [value];
  if (!rows.length || rows.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('بدنه باید یک شیء، آرایه‌ای از اشیاء، یا شیء دارای records باشد.');
  }
  return rows as Record<string, unknown>[];
}

const samplePayload = JSON.stringify({
  indicator_code: 'PHY-001',
  raw_value: 42,
  unit: 'واحد',
  score_1_5: 3,
  source: {
    organization: 'نام سازمان',
    url: 'https://example.org/dataset',
    dataset_id: 'dataset-id',
    version: '2025.1',
    retrieved_at: '2025-01-01T00:00:00Z',
    license: 'نام مجوز',
    checksum: 'sha256:...',
  },
  method: { formula_version: 'PHY-001@1.0' },
  quality: { score: 0.9, spatial_coverage: 1, temporal_coverage: 1, flags: [] },
}, null, 2);

export default function TypologyOperationsPanel({
  runId,
  status,
  missingCount,
  evidenceCount,
  verificationEligible = false,
  onChanged,
}: TypologyOperationsPanelProps) {
  const [operation, setOperation] = useState<Operation>('evidence');
  const [payload, setPayload] = useState('');
  const [fileName, setFileName] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const canUpload = ['COLLECTING', 'WAITING_FOR_RESTRICTED_DATA', 'QA_REVIEW', 'PROVISIONAL'].includes(status);
  const canRecompute = ['COLLECTING', 'WAITING_FOR_RESTRICTED_DATA', 'QA_REVIEW', 'PROVISIONAL'].includes(status);
  const canReview = ['QA_REVIEW', 'PROVISIONAL'].includes(status);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      setPayload(await file.text());
      setError(null);
      setNotice('فایل شواهد آماده ارسال است.');
    } catch {
      setError('فایل JSON قابل خواندن نیست.');
    }
  };

  const submitEvidence = async () => {
    setError(null);
    setNotice(null);
    if (!canUpload) {
      setError('در این وضعیت امکان ورود شواهد وجود ندارد.');
      return;
    }
    let records: Record<string, unknown>[];
    try {
      records = parseRecords(JSON.parse(payload));
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'JSON شواهد معتبر نیست.');
      return;
    }
    setBusy(true);
    try {
      if (!idempotencyKey.current) idempotencyKey.current = `evidence-${runId}-${Date.now()}`;
      const result = await addTypologyEvidence(runId, records, idempotencyKey.current);
      setNotice(`${records.length.toLocaleString('fa-IR')} رکورد شواهد پذیرفته شد. وضعیت: ${String(result.status)}`);
      idempotencyKey.current = null;
      setPayload('');
      setFileName('');
      await onChanged();
    } catch (operationError) {
      setError(readError(operationError));
    } finally {
      setBusy(false);
    }
  };

  const recompute = async () => {
    setError(null);
    setNotice(null);
    if (!canRecompute) {
      setError('در این وضعیت امکان محاسبه مجدد وجود ندارد.');
      return;
    }
    setBusy(true);
    try {
      const result = await recomputeTypologyRun(runId);
      setNotice(`محاسبه قطعی انجام شد؛ وضعیت پرونده ${String(result.status)} است.`);
      await onChanged();
    } catch (operationError) {
      setError(readError(operationError));
    } finally {
      setBusy(false);
    }
  };

  const review = async () => {
    setError(null);
    setNotice(null);
    if (!canReview) {
      setError('پرونده هنوز آماده بازبینی نیست.');
      return;
    }
    if (!reviewerId.trim()) {
      setError('شناسه بازبین را وارد کنید.');
      return;
    }
    if (decision === 'reject' && !reason.trim()) {
      setError('برای رد پرونده، علت تصمیم الزامی است.');
      return;
    }
    setBusy(true);
    try {
      const result = await approveTypologyRun(runId, {
        reviewer_id: reviewerId.trim(),
        reviewer_name: reviewerName.trim() || undefined,
        decision,
        reason: reason.trim() || undefined,
      });
      setNotice(`تصمیم بازبین ثبت شد؛ وضعیت انتشار ${String(result.status)} است.`);
      await onChanged();
    } catch (operationError) {
      setError(readError(operationError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-y border-line py-5" dir="rtl" aria-label="عملیات پرونده گونه‌بندی">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-ink-900"><ClipboardCheck size={16} className="text-brand-700" /> میز عملیات پرونده</div>
          <p className="mt-1 text-[10px] font-bold text-ink-500">ورود شواهد، محاسبه مجدد و تصمیم بازبینی در همان اجرای قابل ممیزی</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black text-ink-500">
          <span className="rounded-full border border-line bg-surface px-2 py-1">شواهد {evidenceCount.toLocaleString('fa-IR')}</span>
          <span className="rounded-full border border-warn/30 bg-warn-soft px-2 py-1 text-warn-700">مفقود {missingCount.toLocaleString('fa-IR')}</span>
        </div>
      </div>

      {(error || notice) && (
        <div className={`mt-4 flex items-start gap-2 border-r-4 px-3 py-2 text-[10px] font-bold leading-5 ${error ? 'border-danger bg-danger-soft text-danger-700' : 'border-ok bg-ok-soft text-ok-700'}`} role={error ? 'alert' : 'status'}>
          {error ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <button type="button" onClick={() => setOperation('evidence')} className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-[10px] font-black ${operation === 'evidence' ? 'bg-brand-800 text-white' : 'border border-line bg-surface text-ink-600 hover:border-brand-300'}`}><UploadCloud size={14} /> ورود شواهد</button>
        <button type="button" onClick={() => setOperation('review')} className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-[10px] font-black ${operation === 'review' ? 'bg-brand-800 text-white' : 'border border-line bg-surface text-ink-600 hover:border-brand-300'}`}><ClipboardCheck size={14} /> بازبینی و انتشار</button>
        <button type="button" onClick={() => void recompute()} disabled={busy || !canRecompute} className="mr-auto inline-flex h-9 items-center gap-2 rounded-md border border-brand-300 bg-brand-50 px-3 text-[10px] font-black text-brand-800 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50" title="اجرای موتور قطعی"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> محاسبه مجدد</button>
      </div>

      {operation === 'evidence' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] font-black text-ink-700">بدنه JSON شواهد</label>
              <button type="button" onClick={() => setPayload(samplePayload)} className="inline-flex items-center gap-1 text-[9px] font-black text-brand-700 hover:text-brand-900"><FileJson size={13} /> درج نمونه</button>
            </div>
            <textarea value={payload} onChange={(event) => setPayload(event.target.value)} dir="ltr" spellCheck={false} placeholder="یک رکورد یا آرایه records را وارد کنید" className="mt-2 min-h-48 w-full resize-y rounded-md border border-line bg-wall-950 p-3 font-mono text-[10px] leading-5 text-signal-400 outline-none focus:border-brand-400" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface px-3 text-[9px] font-black text-ink-600 hover:border-brand-400 hover:text-brand-800"><UploadCloud size={14} /><span className="max-w-56 truncate">{fileName || 'بارگذاری JSON'}</span><input type="file" accept="application/json,.json" onChange={handleFile} className="sr-only" /></label>
              <button type="button" onClick={() => void submitEvidence()} disabled={busy || !payload.trim() || !canUpload} className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-800 px-4 text-[10px] font-black text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ثبت شواهد</button>
            </div>
          </div>
          <aside className="border-r border-line pr-4 text-[10px] font-bold leading-5 text-ink-500">
            <p className="font-black text-ink-800">قواعد پذیرش</p>
            <ul className="mt-2 space-y-2">
              <li>برای مقدار محاسبه‌شده، منبع، نسخه، مجوز و checksum الزامی است.</li>
              <li>رکورد مفقود هرگز با صفر جایگزین نمی‌شود.</li>
              <li>نسخه تکراری با کلید idempotency دوباره ثبت نمی‌شود.</li>
            </ul>
          </aside>
        </div>
      ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[10px] font-black text-ink-700">شناسه بازبین<input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="h-10 rounded-md border border-line bg-surface px-3 text-[11px] font-bold outline-none focus:border-brand-500" placeholder="مثلاً reviewer-01" dir="ltr" /></label>
          <label className="flex flex-col gap-1.5 text-[10px] font-black text-ink-700">نام بازبین<input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} className="h-10 rounded-md border border-line bg-surface px-3 text-[11px] font-bold outline-none focus:border-brand-500" placeholder="اختیاری" /></label>
          <label className="flex flex-col gap-1.5 text-[10px] font-black text-ink-700">تصمیم<select value={decision} onChange={(event) => setDecision(event.target.value as 'approve' | 'reject')} className="h-10 rounded-md border border-line bg-surface px-3 text-[11px] font-bold outline-none focus:border-brand-500"><option value="approve">تأیید</option><option value="reject">رد</option></select></label>
          <label className="flex flex-col gap-1.5 text-[10px] font-black text-ink-700 md:col-span-2">یادداشت تصمیم<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-20 rounded-md border border-line bg-surface px-3 py-2 text-[11px] font-bold outline-none focus:border-brand-500" placeholder="برای رد، توضیح روشن ثبت کنید." /></label>
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <button type="button" onClick={() => void review()} disabled={busy || !canReview} className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${decision === 'approve' ? 'bg-ok-700 hover:bg-ok-800' : 'bg-danger hover:bg-danger-700'}`}>{busy ? <Loader2 size={14} className="animate-spin" /> : decision === 'approve' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} ثبت تصمیم بازبین</button>
            {!canReview && <span className="text-[9px] font-bold text-ink-400">پس از محاسبه و ورود به مرحله کنترل کیفیت فعال می‌شود.</span>}
            {canReview && decision === 'approve' && !verificationEligible && <span className="text-[9px] font-bold leading-5 text-warn-700">دروازه‌های انتشار هنوز کامل نیستند؛ تأیید اینجا به وضعیت موقت تبدیل می‌شود.</span>}
            {canReview && decision === 'approve' && verificationEligible && <span className="text-[9px] font-bold text-ok-700">همه دروازه‌های انتشار برقرار است.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
