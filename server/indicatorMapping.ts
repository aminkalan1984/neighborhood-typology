// ============================================================
// Indicator Mapping (فاز یک — قرارداد دادهٔ مشترک)
// ------------------------------------------------------------
// نگاشت شاخص‌های TypeScript (کدهای H1..R5 در core_40) به کدهای
// kernel (registry_419/online_83) و کلاس‌بندی جریان شاهد
// (objective / gis / behavioral / perceptual) برای ورود به
// موتور محاسبات kernel. هیچ عددی اینجا ساخته نمی‌شود.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KROOT = path.resolve(__dirname, '..', 'kernel');

// ---------- registry metadata (read once, cached) ----------
interface Core40Record {
  'کد': string;
  'سرمایه': string;
  'شاخص': string;
  'تعریف/فرمول عملیاتی': string;
  'واحد': string;
  'جهت': string;
  'نقش سیستم': string;
  'منبع اصلی': string;
  'جریان شاهد': string;
}

interface Registry419Record {
  'کد': string;
  'سرمایه اصلی': string;
  'کد سرمایه': string;
  'مرحله C-A-U-E-O': string;
  'هدف K/Q/T/R': string;
  'جهت': string;
  'عنوان شاخص': string;
  'واحد اصلی': string;
  'جریان‌های شاهد': string;
  [k: string]: unknown;
}

let core40ByCode: Map<string, Core40Record> | null = null;
let registry419ByCode: Map<string, Registry419Record> | null = null;

function loadCore40(): Map<string, Core40Record> {
  if (core40ByCode) return core40ByCode;
  const raw = JSON.parse(fs.readFileSync(path.join(KROOT, 'registries', 'core_40.json'), 'utf8'));
  core40ByCode = new Map(raw.records.map((r: Core40Record) => [r['کد'], r]));
  return core40ByCode;
}

function loadRegistry419(): Map<string, Registry419Record> {
  if (registry419ByCode) return registry419ByCode;
  const raw = JSON.parse(fs.readFileSync(path.join(KROOT, 'registries', 'registry_419.json'), 'utf8'));
  registry419ByCode = new Map(raw.records.map((r: Registry419Record) => [r['کد'], r]));
  return registry419ByCode;
}

// ---------- TS ↔ kernel code translation ----------
/**
 * TS indicator codes (H1..R5 — core_40 decision layer) do not exist as codes
 * in registry_419 (PHY-xxx/BEH-xxx/NOR-xxx). This function resolves a TS code
 * to matching registry_419 candidates by capital + title/definition keyword
 * overlap. Returns [] when no defensible match exists (no silent guessing).
 */
export function resolveKernelCodes(tsCode: string): Array<{ kernel_code: string; title: string; confidence: 'exact' | 'keyword' }> {
  const core = loadCore40().get(tsCode);
  if (!core) return [];
  const r419 = loadRegistry419();

  const capitalCodeByFa: Record<string, string> = {
    'انسانی': 'H', 'اجتماعی': 'S', 'اقتصادی': 'EC', 'کالبدی–زیرساختی': 'P',
    'طبیعی–محیطی': 'N', 'فرهنگی–هویتی': 'C', 'نهادی–حکمرانی': 'G', 'شبکه‌ای–ارتباطی': 'R',
  };
  const capCode = capitalCodeByFa[core['سرمایه']];

  // Keywords from the operational definition (Persian, length>=3)
  const stop = new Set(['جمعیت', 'کل', 'درصد', 'طی', 'برای', 'های', 'دارای', 'سهم', 'تعداد', 'میانگین', 'داشته', 'شده', 'است', 'بیشتر', 'کمتر', 'بهتر', 'بتوان', 'مصوب', 'داشته‌باشند']);
  const words = core['تعریف/فرمول عملیاتی']
    .replace(/[×÷\-–—+()۱-۹0-9]/g, ' ')
    .split(/[\s،؛]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stop.has(w));

  const candidates: Array<{ kernel_code: string; title: string; score: number; kind: 'exact' | 'keyword' }> = [];
  for (const rec of r419.values()) {
    const inPrimaryCapital = rec['کد سرمایه'] === capCode;
    const inSecondaryCapital = typeof rec['سرمایه‌های ثانویه'] === 'string'
      && (rec['سرمایه‌های ثانویه'] as string).startsWith(`${capCode} `);
    if (!inPrimaryCapital && !inSecondaryCapital) continue;
    const hay = `${rec['عنوان شاخص'] ?? ''}`;
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) score += w.length;
    }
    if (score > 0) candidates.push({ kernel_code: rec['کد'], title: hay, score, kind: 'keyword' });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 3);
  if (top.length === 0) return [];
  // A single clearly-best match (score > 2× runner-up) is 'exact'; else keyword ties.
  if (top.length === 1 || top[0].score > 2 * top[1].score) {
    return [{ kernel_code: top[0].kernel_code, title: top[0].title, confidence: 'exact' }];
  }
  return top.map((c) => ({ kernel_code: c.kernel_code, title: c.title, confidence: 'keyword' as const }));
}

/**
 * Best-match resolution for a TS code including secondary-capital hits.
 * Returns [] when no defensible match exists — the caller abstains.
 */
export function resolveKernelCodeBest(tsCode: string): { kernel_code: string; title: string; confidence: 'exact' | 'keyword' } | null {
  return resolveKernelCodes(tsCode)[0] ?? null;
}

// ---------- evidence-stream classification (فاز یک — بند ۳) ----------
export type EvidenceClass = 'objective' | 'gis' | 'behavioral' | 'perceptual';

const SURVEY_SOURCE_HINTS = ['پیمایش', 'ادراکی', 'نظرسنجی'];
const BEHAVIORAL_SOURCE_HINTS = ['رفتاری', 'تأمین اجتماعی', 'تراکنش'];

/**
 * هر شاخص باید objective / GIS / behavioral / perceptual طبقه‌بندی شود.
 * core_40 declares 'جریان شاهد' as «ادراکی/رفتاری» or «عینی/مکانی»;
 * the TS source field refines between perceptual (survey) and behavioral.
 */
export function classifyEvidenceStream(tsCode: string): EvidenceClass[] {
  const core = loadCore40().get(tsCode);
  if (!core) return [];
  const stream = core['جریان شاهد'];
  const src = core['منبع اصلی'];
  if (stream.includes('مکانی')) return ['gis', 'objective'];
  if (stream.includes('ادراکی') && SURVEY_SOURCE_HINTS.some((h) => src.includes(h))) return ['perceptual', 'behavioral'];
  if (stream.includes('ادراکی')) return ['perceptual'];
  if (BEHAVIORAL_SOURCE_HINTS.some((h) => src.includes(h))) return ['behavioral'];
  return ['objective'];
}

// ---------- kernel record builder ----------
export interface TsMeasurementInput {
  /** TS/core_40 indicator code, e.g. 'H1' */
  code: string;
  value: number | null;
  /** declared unit from the caller; kernel validates against registry */
  unit?: string;
  isProxy?: boolean;
  /** group label for equity disaggregation */
  group?: string;
}

export interface KernelRecordBuildResult {
  /** kernel record ready for POST /v1/calculation-runs records[] */
  record: Record<string, unknown> | null;
  /** mapping diagnostics — kept for UI transparency */
  mapping: {
    ts_code: string;
    kernel_code: string | null;
    confidence: 'exact' | 'keyword' | 'unmapped';
    evidence_streams: EvidenceClass[];
    unit: string;
    registry_unit: string;
    unit_matches: boolean;
    note: string;
  };
}

/**
 * Build a kernel record from a TS measurement. Kernel codes are resolved
 * by capital + title keywords; units are validated against the registry
 * definition; evidence streams are classified. Returns record=null (with
 * the mapping diagnostic filled) when no defensible kernel mapping exists.
 */
export function buildKernelRecord(input: TsMeasurementInput): KernelRecordBuildResult {
  const core = loadCore40().get(input.code);
  if (!core) {
    return {
      record: null,
      mapping: {
        ts_code: input.code, kernel_code: null, confidence: 'unmapped',
        evidence_streams: [], unit: input.unit ?? '', registry_unit: '', unit_matches: false,
        note: `unknown TS indicator code: ${input.code}`,
      },
    };
  }

  const streams = classifyEvidenceStream(input.code);
  const matches = resolveKernelCodes(input.code);
  // Manual defensible links (verified in registry_419; see fullMappingTable):
  const MANUAL_LINKS: Record<string, string> = {
    H1: 'BEH-127', H4: 'BEH-178', S1: 'BEH-008', S2: 'BEH-019', S5: 'BEH-029',
    P1: 'PHY-149', P3: 'PHY-147', N5: 'PHY-149', C1: 'BEH-156', C3: 'BEH-025',
    C4: 'NOR-002', G2: 'BEH-027', R4: 'PHY-104',
  };
  const primary = matches[0]
    ?? (MANUAL_LINKS[input.code]
      ? {
          kernel_code: MANUAL_LINKS[input.code],
          confidence: 'keyword' as const,
          title: String(loadRegistry419().get(MANUAL_LINKS[input.code])?.['عنوان شاخص'] ?? ''),
        }
      : undefined);

  const regUnit = primary ? String(loadRegistry419().get(primary.kernel_code)?.['واحد اصلی'] ?? '') : '';
  const unitMatches = !input.unit || !regUnit || input.unit.trim() === regUnit.trim();

  if (!primary) {
    return {
      record: null,
      mapping: {
        ts_code: input.code, kernel_code: null, confidence: 'unmapped',
        evidence_streams: streams, unit: input.unit ?? '', registry_unit: '', unit_matches: false,
        note: 'no defensible registry_419 match (capital + keyword) — داده به kernel وارد نمی‌شود',
      },
    };
  }

  return {
    record: {
      indicator_code: primary.kernel_code,
      operationalization: `ts_mapping:${input.code}`,
      raw_unit: input.unit ?? regUnit,
      group: input.group,
      measurement: {
        indicator_code: primary.kernel_code,
        value: input.value,
        status: input.value === null ? 'MISSING' : (input.isProxy ? 'PROXY' : 'OBSERVED'),
        is_proxy: Boolean(input.isProxy),
        evidence_stream: streams,
      },
    },
    mapping: {
      ts_code: input.code,
      kernel_code: primary.kernel_code,
      confidence: primary.confidence,
      evidence_streams: streams,
      unit: input.unit ?? regUnit,
      registry_unit: regUnit,
      unit_matches: unitMatches,
      note: unitMatches
        ? `mapped ${input.code} → ${primary.kernel_code} (${primary.confidence})`
        : `unit mismatch: declared «${input.unit}» vs registry «${regUnit}» — standardization will be withheld`,
    },
  };
}

// ---------- batch builder (shared by /api/kernel/analyze and shadow mode) ----------
export interface KernelRecordBatchResult {
  /** kernel records ready for POST /v1/calculation-runs records[] */
  records: Array<Record<string, unknown>>;
  /** one mapping diagnostic per input code, in input order */
  mappings: KernelRecordBuildResult['mapping'][];
  /** codes with no defensible registry_419 match — honestly abstained */
  unmapped: string[];
  /** codes whose supplied value was not a finite number — never coerced */
  invalid: string[];
}

/**
 * Translate a decision-support style numeric payload into provenance-aware
 * kernel records. Group-disaggregated values become extra records carrying a
 * group label (equity input). No computation happens here — this is a pure
 * adapter, so the kernel stays the single computation reference.
 */
export function buildKernelRecordBatch(
  values: Record<string, unknown>,
  groupValues: Record<string, unknown> = {},
  provenance: {
    source_name?: string;
    provider?: string;
    api?: string;
    value_id_prefix?: string;
    timestamp?: string;
  } = {},
): KernelRecordBatchResult {
  const records: Array<Record<string, unknown>> = [];
  const mappings: KernelRecordBuildResult['mapping'][] = [];
  const unmapped: string[] = [];
  const invalid: string[] = [];
  const prefix = provenance.value_id_prefix ?? 'VAL-TS';
  const api = provenance.api ?? '/api/kernel/analyze';
  const stamp = provenance.timestamp ?? new Date().toISOString();

  for (const [tsCode, raw] of Object.entries(values ?? {})) {
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(numeric)) {
      invalid.push(tsCode);
      continue;
    }
    const built = buildKernelRecord({ code: tsCode, value: numeric });
    mappings.push(built.mapping);
    if (!built.record) {
      unmapped.push(tsCode);
      continue; // honest abstention — unmapped codes are reported, never guessed
    }
    const vid = `${prefix}-${tsCode}`;
    built.record.provenance_value_id = vid;
    built.record.provenance = {
      source_name: provenance.source_name ?? 'decision-support adapter',
      provider: provenance.provider ?? 'ISGP TypeScript adapter (mapped via core_40 → registry_419)',
      formula_id: built.mapping.confidence === 'exact' ? 'exact-title-match' : 'keyword-title-match',
      request_params: { ts_code: tsCode, api },
      timestamp_acquired: stamp,
      completeness: 1.0,
    };

    // group-disaggregated values → extra records with group labels (equity input)
    const groups = (groupValues ?? {})[tsCode] as Record<string, unknown> | undefined;
    if (groups && typeof groups === 'object' && !Array.isArray(groups)) {
      for (const [group, gRaw] of Object.entries(groups)) {
        const gNum = typeof gRaw === 'number' ? gRaw : Number(gRaw);
        if (!Number.isFinite(gNum)) continue;
        const gBuilt = buildKernelRecord({ code: tsCode, value: gNum, group });
        if (gBuilt.record) {
          gBuilt.record.provenance_value_id = `${vid}-G-${group}`;
          gBuilt.record.provenance = {
            ...(built.record.provenance as Record<string, unknown>),
            record_ref: `group:${group}`,
          };
          records.push(gBuilt.record);
        }
      }
    }
    records.push(built.record);
  }

  return { records, mappings, unmapped, invalid };
}

/** Mapping stats for the UI */
export function mappingSummary(): { total: number; mapped: number; exact: number; keyword: number; unmapped: string[] } {
  const core = loadCore40();
  const out = { total: core.size, mapped: 0, exact: 0, keyword: 0, unmapped: [] as string[] };
  // Manual defensible links (verified title+capital alignment in registry_419;
  // rows whose wording sits in a SECONDARY capital the keyword matcher misses):
  const MANUAL_LINKS: Record<string, string> = {
    H1: 'BEH-127', // درصد جمعیت با تحصیلات عالی (EC; secondary H)
    H4: 'BEH-178', // پویایی مهارتی (EC; secondary H)
    S1: 'BEH-008', // سرمایۀ اجتماعی (S)
    S2: 'BEH-019', // حس تعلق ساکنان (S)
    S5: 'BEH-029', // وجود تشکل‌های محلی برای حل مشکلات (G; secondary S)
    P1: 'PHY-149', // تاب‌آوری کالبدی: انطباق ابنیه (N; secondary P)
    P3: 'PHY-147', // زیرساخت پلتفرمی: ضریب نفوذ اینترنت پهن‌باند (N)
    N5: 'PHY-149', // تاب‌آوری کالبدی (N)
    C1: 'BEH-156', // سرانۀ پروژه‌های فرهنگی اجتماعی هر منطقه (EC; secondary N/C)
    C3: 'BEH-025', // تمایل و علاقه به ادامۀ زندگی در محله (S; perceptual identity)
    C4: 'NOR-002', // مشارکت (N; behavioral/perceptual)
    G2: 'BEH-027', // رضایت از خدمات شهرداری در محله (G)
    R4: 'PHY-104', // استفاده از حمل و نقل عمومی و طول شبکه آن (R)
  };
  for (const code of core.keys()) {
    const best = resolveKernelCodeBest(code) ?? (MANUAL_LINKS[code] ? { kernel_code: MANUAL_LINKS[code], title: '', confidence: 'keyword' as const } : null);
    if (best) {
      out.mapped += 1;
      if (best.confidence === 'exact') out.exact += 1;
      else out.keyword += 1;
    } else {
      out.unmapped.push(code);
    }
  }
  return out;
}

// ---------- API surface for the /api/kernel/mapping route ----------
export interface MappingRow {
  ts_code: string;
  name: string;
  capital: string;
  kernel_code: string | null;
  kernel_title: string | null;
  confidence: 'exact' | 'keyword' | 'unmapped';
  evidence_streams: EvidenceClass[];
  registry_unit: string;
}

/** Full mapping table for UI transparency — one row per core_40 indicator. */
export function fullMappingTable(): MappingRow[] {
  const core = loadCore40();
  const MANUAL_LINKS: Record<string, string> = {
    H1: 'BEH-127', H4: 'BEH-178', S1: 'BEH-008', S2: 'BEH-019', S5: 'BEH-029',
    P1: 'PHY-149', P3: 'PHY-147', N5: 'PHY-149', C1: 'BEH-156', C3: 'BEH-025',
    C4: 'NOR-002', G2: 'BEH-027', R4: 'PHY-104',
  };
  const rows: MappingRow[] = [];
  for (const [code, rec] of core) {
    const matches = resolveKernelCodes(code);
    const primary = matches[0];
    const kc = primary?.kernel_code ?? MANUAL_LINKS[code] ?? null;
    const conf = primary?.confidence ?? (MANUAL_LINKS[code] ? 'keyword' as const : 'unmapped' as const);
    const rr = kc ? loadRegistry419().get(kc) : undefined;
    rows.push({
      ts_code: code,
      name: rec['شاخص'],
      capital: rec['سرمایه'],
      kernel_code: kc,
      kernel_title: rr?.['عنوان شاخص'] ?? null,
      confidence: conf,
      evidence_streams: classifyEvidenceStream(code),
      registry_unit: String(rr?.['واحد اصلی'] ?? ''),
    });
  }
  return rows;
}
