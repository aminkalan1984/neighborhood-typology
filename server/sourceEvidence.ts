/**
 * پل شواهد منابع → تصمیم‌یار.
 *
 * این ماژول خروجی کانکتورهای دروازهٔ منابع (`/api/sources`) را به
 * «امتیاز شاخص ۰..۱۰۰» تبدیل می‌کند تا منابع `score_eligible` واقعاً روی
 * امتیاز محله اثر بگذارند. دو قاعدهٔ تغییرناپذیر حفظ می‌شود:
 *
 * ۱) منبع `evidence_only` هرگز وارد امتیاز نمی‌شود؛ فقط شاهد ثبت می‌شود.
 * ۲) مقدار خالی صفر نمی‌شود؛ به‌جایش «کمبود داده» گزارش می‌شود.
 *
 * نگاشت خام→امتیاز کاملاً اعلانی است و در منیفست هر منبع (`feeds[].scoring`)
 * زندگی می‌کند: `score = clamp((value - worst) / (best - worst) * 100, 0, 100)`.
 */

import type { Connector, SourceManifest, SourceProvenance, SourceResult, SourceVariable } from './sources/types';
import { getManifest, scoreEligibleSourceIds } from './sources/manifests';
import { SourceConfigError, createConnectors } from './sources/connectors';
import { SourceRuntime } from './sources/runtime';
import { ALGORITHM_INDICATORS } from '../src/algorithm/algorithmIndicators';

export type MergePolicy = 'fill_missing' | 'prefer_live';

export interface SourceEvidenceRequest {
  point?: { lat: number; lng: number };
  bbox?: [number, number, number, number];
  at?: string;
  /** محدودکردن به منابع مشخص */
  sourceIds?: string[];
  /** آیا منابع evidence_only هم واکشی شوند (فقط برای دفتر شواهد) */
  includeEvidenceOnly?: boolean;
}

export interface SourceIndicatorContribution {
  indicatorCode: string;
  sourceId: string;
  variable: string;
  rawValue: number;
  unit?: string;
  score: number;
  weight: number;
  proxy: boolean;
  observedAt?: string;
  cache: SourceProvenance['cache'];
  provider: SourceProvenance['provider'];
}

export interface IndicatorAggregate {
  indicatorCode: string;
  /** میانگین وزن‌دار امتیازهای منابع */
  score: number;
  sources: string[];
  proxyOnly: boolean;
  contributors: SourceIndicatorContribution[];
}

export interface EvidenceOnlyEntry {
  sourceId: string;
  variable: string;
  value: number | null;
  unit?: string;
  observedAt?: string;
  indicatorCode?: string;
  provider: SourceProvenance['provider'];
  cache: SourceProvenance['cache'];
  /** چرا این متغیر امتیاز نساخت (مثلاً پروکسی صفر) */
  reason?: string;
}

export interface SourceShortage {
  sourceId: string;
  kind: 'error' | 'not_configured';
  reason: string;
  envVar?: string;
}

/**
 * سطر دفتر شواهد. ساختار آگاهانه با `DecisionEvidenceObservation` هم‌شکل است،
 * اما از دروازهٔ انتشار ۱۶۴ عبور داده نمی‌شود: آن دروازه کد `M-CORE-*`،
 * وضعیت `validated` و مرز «بلوک» می‌خواهد که دادهٔ باز عمومی هرگز ندارد.
 * پس اینجا فقط ثبت و نمایش می‌شود و امتیاز نمی‌سازد مگر scoreEligible باشد.
 */
export interface SourceEvidenceLedgerEntry {
  evidenceCode: string;
  label: string;
  indicatorCode: string | null;
  rawValue: number | null;
  unit?: string;
  observedAt?: string;
  normalizedScore: number | null;
  scoreEligible: boolean;
  status: 'measured' | 'evidence_only';
  publicationLevel: SourceManifest['allowedOutput'];
  source: {
    id: string;
    name: string;
    url: string;
    license: string;
    attribution: string;
    tier: 'open_verified' | 'proxy';
    geographyLevel: string;
    retrievedAt: string;
  };
  method: { name: string; formulaVersion: string };
  quality: { score: number; flags: string[] };
}

export interface SourceEvidenceBundle {
  generatedAt: string;
  request: SourceEvidenceRequest;
  /** امتیازهای آمادهٔ ادغام در indicatorValues (فقط منابع مجاز به امتیاز) */
  indicators: Record<string, number>;
  aggregates: IndicatorAggregate[];
  evidenceOnly: EvidenceOnlyEntry[];
  ledger: SourceEvidenceLedgerEntry[];
  shortages: SourceShortage[];
  provenance: SourceProvenance[];
  coverage: {
    sourcesQueried: number;
    sourcesContributing: number;
    scoredIndicators: number;
    scoreEligibleSources: number;
  };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** نگاشت یک مقدار خام به امتیاز ۰..۱۰۰ — تنها جایی که مقیاس تعریف می‌شود */
export function scoreRawValue(raw: number, best: number, worst: number): number | null {
  if (best === worst || !Number.isFinite(raw)) return null;
  return clamp(((raw - worst) / (best - worst)) * 100, 0, 100);
}

function geographyLevelOf(manifest: SourceManifest): string {
  switch (manifest.spatial) {
    case 'point': return 'point';
    case 'bbox': return 'buffer';
    case 'national': return 'national';
    case 'polygon': return 'neighborhood';
    default: return manifest.spatial;
  }
}

function qualityScoreOf(manifest: SourceManifest, provider: SourceProvenance['provider'], proxy: boolean): number {
  const base = clamp(manifest.quality.minReliability / 5, 0, 1);
  const penalty = (provider === 'live' ? 0 : 0.1) + (proxy ? 0.05 : 0);
  return Math.round(clamp(base - penalty, 0, 1) * 100) / 100;
}

export interface MappedSourceResult {
  contributions: SourceIndicatorContribution[];
  evidenceOnly: EvidenceOnlyEntry[];
  ledger: SourceEvidenceLedgerEntry[];
}

/** تبدیل خروجی یک کانکتور به مشارکت‌های امتیازی + سطرهای دفتر شواهد */
export function mapSourceResult(manifest: SourceManifest, result: SourceResult): MappedSourceResult {
  const contributions: SourceIndicatorContribution[] = [];
  const evidenceOnly: EvidenceOnlyEntry[] = [];
  const ledger: SourceEvidenceLedgerEntry[] = [];
  const scoreEligible = manifest.role === 'score_eligible';

  for (const variable of result.variables as SourceVariable[]) {
    const feed = manifest.feeds.find(f => f.variable === variable.variable);
    const scoring = feed?.scoring;
    const baseScored = scoreEligible && Boolean(feed?.indicatorCode) && Boolean(scoring) && typeof variable.value === 'number';
    // پروکسی شمارشی صفر یعنی «در OSM نگاشت نشده»، نه «وجود ندارد».
    // صفر چنین فیدهایی هرگز به امتیاز ۰ تبدیل نمی‌شود و فقط شاهد ثبت می‌شود.
    const zeroProxy = baseScored && Boolean(feed?.proxy) && variable.value === 0;
    const scored = baseScored && !zeroProxy;

    if (scored && scoring && feed?.indicatorCode && typeof variable.value === 'number') {
      const score = scoreRawValue(variable.value, scoring.best, scoring.worst);
      if (score !== null) {
        contributions.push({
          indicatorCode: feed.indicatorCode,
          sourceId: manifest.id,
          variable: variable.variable,
          rawValue: variable.value,
          unit: variable.unit ?? feed.unit,
          score: Math.round(score * 10) / 10,
          weight: scoring.weight ?? 1,
          proxy: Boolean(feed.proxy),
          observedAt: variable.observedAt,
          cache: result.provenance.cache,
          provider: result.provenance.provider,
        });
      }
    } else {
      evidenceOnly.push({
        sourceId: manifest.id,
        variable: variable.variable,
        value: typeof variable.value === 'number' ? variable.value : null,
        unit: variable.unit ?? feed?.unit,
        observedAt: variable.observedAt,
        indicatorCode: feed?.indicatorCode,
        provider: result.provenance.provider,
        cache: result.provenance.cache,
        reason: zeroProxy
          ? 'پروکسی شمارشی صفر = پوشش ناقص منبع، نه نبود واقعی؛ وارد امتیاز نشد'
          : undefined,
      });
    }

    ledger.push({
      evidenceCode: `${manifest.id}:${variable.variable}`,
      label: `${manifest.title} — ${variable.variable}`,
      indicatorCode: feed?.indicatorCode ?? null,
      rawValue: typeof variable.value === 'number' ? variable.value : null,
      unit: variable.unit ?? feed?.unit,
      observedAt: variable.observedAt,
      normalizedScore: scored && scoring && typeof variable.value === 'number'
        ? scoreRawValue(variable.value, scoring.best, scoring.worst)
        : null,
      scoreEligible: Boolean(scored),
      status: scored ? 'measured' : 'evidence_only',
      publicationLevel: manifest.allowedOutput,
      source: {
        id: manifest.id,
        name: manifest.title,
        url: manifest.endpoint,
        license: manifest.license.name,
        attribution: manifest.license.attribution,
        tier: feed?.proxy ? 'proxy' : 'open_verified',
        geographyLevel: geographyLevelOf(manifest),
        retrievedAt: result.provenance.fetchedAt,
      },
      method: {
        name: scoring ? `linear(${scoring.worst}→0, ${scoring.best}→100)` : 'raw-variable',
        formulaVersion: 'source-gateway-p0',
      },
      quality: {
        score: qualityScoreOf(manifest, result.provenance.provider, Boolean(feed?.proxy)),
        flags: [
          ...(result.provenance.fallbackFrom ? [`fallback:${result.provenance.fallbackFrom}`] : []),
          ...(zeroProxy ? ['proxy-zero-not-scored'] : []),
        ],
      },
    });
  }

  return { contributions, evidenceOnly, ledger };
}

/** تجمیع مشارکت‌ها روی هر کد شاخص با میانگین وزن‌دار */
export function aggregateContributions(contributions: SourceIndicatorContribution[]): IndicatorAggregate[] {
  const byIndicator = new Map<string, SourceIndicatorContribution[]>();
  for (const contribution of contributions) {
    const list = byIndicator.get(contribution.indicatorCode);
    if (list) list.push(contribution);
    else byIndicator.set(contribution.indicatorCode, [contribution]);
  }

  const aggregates: IndicatorAggregate[] = [];
  for (const [indicatorCode, list] of [...byIndicator.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const totalWeight = list.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0) continue;
    const score = list.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;
    aggregates.push({
      indicatorCode,
      score: Math.round(score * 10) / 10,
      sources: [...new Set(list.map(c => c.sourceId))].sort(),
      proxyOnly: list.every(c => c.proxy),
      contributors: [...list].sort((a, b) => b.weight - a.weight),
    });
  }
  return aggregates;
}

/** ادغام امتیازهای منابع در مقادیر شاخص موجود */
export function mergeIndicatorValues(
  base: Record<string, number>,
  aggregates: IndicatorAggregate[],
  policy: MergePolicy,
): { values: Record<string, number>; applied: string[]; skipped: string[] } {
  const values = { ...base };
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const aggregate of aggregates) {
    const existing = values[aggregate.indicatorCode];
    if (existing !== undefined && policy === 'fill_missing') {
      skipped.push(aggregate.indicatorCode);
      continue;
    }
    values[aggregate.indicatorCode] = aggregate.score;
    applied.push(aggregate.indicatorCode);
  }
  return { values, applied, skipped };
}

export interface CollectOptions extends SourceEvidenceRequest {
  runtime?: SourceRuntime;
  connectors?: Connector[];
}

/** واکشی موازی منابع مجاز و ساخت بستهٔ شواهد */
export async function collectSourceEvidence(options: CollectOptions = {}): Promise<SourceEvidenceBundle> {
  const runtime = options.runtime ?? new SourceRuntime();
  const connectors = options.connectors ?? createConnectors({ runtime });
  const allowed = new Set(scoreEligibleSourceIds());
  const wanted = options.sourceIds?.length ? new Set(options.sourceIds) : null;

  const selected = connectors.filter(connector => {
    if (wanted) return wanted.has(connector.manifest.id);
    return connector.manifest.role === 'score_eligible' || Boolean(options.includeEvidenceOnly);
  });

  const indicators: Record<string, number> = {};
  const contributions: SourceIndicatorContribution[] = [];
  const evidenceOnly: EvidenceOnlyEntry[] = [];
  const ledger: SourceEvidenceLedgerEntry[] = [];
  const shortages: SourceShortage[] = [];
  const provenance: SourceProvenance[] = [];
  const contributing = new Set<string>();

  const outcomes = await Promise.all(selected.map(async (connector) => {
    try {
      const result = await connector.query({
        point: options.point,
        bbox: options.bbox,
        at: options.at,
      });
      return { connector, result, error: null as unknown };
    } catch (error) {
      return { connector, result: null, error };
    }
  }));

  for (const outcome of outcomes) {
    const { connector } = outcome;
    if (!outcome.result) {
      const error = outcome.error;
      shortages.push({
        sourceId: connector.manifest.id,
        kind: error instanceof SourceConfigError ? 'not_configured' : 'error',
        reason: error instanceof Error ? error.message : 'منبع پاسخ نداد.',
        envVar: error instanceof SourceConfigError ? error.envVar : undefined,
      });
      continue;
    }
    provenance.push(outcome.result.provenance);
    const mapped = mapSourceResult(connector.manifest, outcome.result);
    ledger.push(...mapped.ledger);
    evidenceOnly.push(...mapped.evidenceOnly);
    if (mapped.contributions.length > 0) {
      contributing.add(connector.manifest.id);
      contributions.push(...mapped.contributions);
    }
  }

  // تجمیع در سطح کل بسته: یک شاخص می‌تواند از چند منبع وزن‌دار بیاید
  const finalAggregates = aggregateContributions(contributions);
  for (const aggregate of finalAggregates) indicators[aggregate.indicatorCode] = aggregate.score;

  const known = new Set(ALGORITHM_INDICATORS.map(i => i.code));
  const unknown = Object.keys(indicators).filter(code => !known.has(code));
  if (unknown.length > 0) {
    for (const code of unknown) delete indicators[code];
  }

  return {
    generatedAt: new Date(runtime.now()).toISOString(),
    request: { point: options.point, bbox: options.bbox, at: options.at, sourceIds: options.sourceIds, includeEvidenceOnly: options.includeEvidenceOnly },
    indicators,
    aggregates: finalAggregates.filter(a => known.has(a.indicatorCode)),
    evidenceOnly,
    ledger,
    shortages,
    provenance,
    coverage: {
      sourcesQueried: selected.length,
      sourcesContributing: contributing.size,
      scoredIndicators: finalAggregates.filter(a => known.has(a.indicatorCode)).length,
      scoreEligibleSources: [...allowed].length,
    },
  };
}

/** فقط برای تست/ابزار: منیفست‌های مجاز به امتیاز */
export function scoredManifestIds(): string[] {
  return scoreEligibleSourceIds();
}

export { getManifest };
