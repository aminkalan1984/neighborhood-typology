// ============================================================
// موتور پایپلاین گونه‌بندی محلات (بخش ۱۱ سند فنی)
// مراحل: ورودی‌گیری برخط → محاسبهٔ خام → نرمال‌سازی هم‌مقیاس →
//        وزن‌دهی (آنتروپی+AHP+ترکیبی) → نمرهٔ لایه → SI میانگین هندسی →
//        گونه‌بندی + ماتریس ۹ حالته → رادار → کنترل کیفیت → اولویت بودجه
// ============================================================
import type {
  LayerKey,
  PipelineResult,
  Provenance,
  Weights,
  ZoneMeta,
  ZoneRaw,
  ZoneResult,
} from './types';
import { LAYERS } from './types';
import { buildZones, deriveZoneRaw } from './data';
import { computeAllRaw, INDICATOR_CATALOG, INDICATORS_BY_LAYER, indicatorByCode } from './indicators';
import { ingestLiveData, sourceInfo } from './sources';
import { groupKey, minmaxNormalize, normalizeSeries, toScale1to5 } from './normalize';
import { combineWeights, layerAhp, LAYER_PAIRWISE, shannonEntropyWeights } from './weighting';
import { geometricMeanSi, layerScore } from './sustainability';
import { classifyLayer, matrix9State, siColor, SPECIES_FA } from './classification';
import { radarMetrics } from './radar';
import { runQualityChecks } from './quality';
import { rankByBudgetPriority } from './intervention';

export interface PipelineOptions {
  /** ضریب تلفیق عینی/خبره (پیش‌فرض ۰٫۵) */
  alpha?: number;
  /** انجام ورودی‌گیری برخط یا صرفاً دادهٔ شبیه‌سازی‌شدهٔ قطعی */
  live?: boolean;
  /** پهنه‌های اضافی (مثلاً نقطهٔ انتخابی کاربر) که به هم‌گروه ۲۰ پهنه می‌پیوندند */
  extraZones?: ZoneMeta[];
  /** دادهٔ خام واقعی پهنه‌های اضافی (کلید = zone.id) — روی پایهٔ استانی سوار می‌شود */
  extraRaw?: Record<string, Partial<ZoneRaw>>;
  /** منشأ دادهٔ اضافی (مشاهدات برخط نقطه) برای پنل اعتماد */
  extraProvenance?: Provenance[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** منشأ پایه: همهٔ منابع کاتالوگ در حالت آفلاین شبیه‌سازی‌شده‌اند */
function buildBaseProvenance(liveKeys: Set<string>): Provenance[] {
  const keys = [...new Set(INDICATOR_CATALOG.map((i) => i.sourceKey))];
  return keys
    .filter((k) => !liveKeys.has(k))
    .map((k) => {
      const s = sourceInfo(k);
      return {
        sourceKey: k,
        sourceFa: s.name,
        status: 'simulated' as const,
        detail: 'دادهٔ شبیه‌سازی‌شدهٔ قطعی (تولید خوشه‌ای از مبنای استانی داشبورد — حالت آفلاین)',
      };
    });
}

/**
 * اجرای کامل پایپلاین و تولید خروجی ساخت‌یافته برای رابط کاربری.
 * ورودی‌گیری برخط با بازگشت نرم (فقط provenance را تغییر می‌دهد).
 */
export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const alpha = options.alpha ?? 0.5;
  const warnings: string[] = [];
  // جمعیت مرجع برای کالیبراسیون = پایهٔ استان‌ها؛ پهنهٔ اضافی (نقطهٔ کاربر) فقط اعمال می‌شود
  const refZones: ZoneMeta[] = buildZones();
  const extraZones: ZoneMeta[] = options.extraZones ?? [];
  const zones: ZoneMeta[] = [...refZones, ...extraZones];
  const refIndexes = refZones.map((_, i) => i); // ایندکس پهنه‌های مرجع در آرایهٔ ترکیبی

  // ── ۱) ورودی‌گیری برخط (در صورت فعال بودن) ─────────────────
  let overrides: Record<string, Partial<ZoneRaw>> = {};
  let liveProvenance: Provenance[] = [];
  let liveKeys = new Set<string>();
  if (options.live !== false) {
    try {
      const live = await ingestLiveData(zones);
      overrides = live.overrides;
      liveProvenance = live.provenance;
      liveKeys = new Set(live.provenance.map((p) => p.sourceKey));
      warnings.push(...live.warnings);
    } catch {
      warnings.push('ورودی‌گیری برخط ناموفق بود؛ از دادهٔ شبیه‌سازی‌شدهٔ قطعی استفاده شد.');
    }
  }

  // ── ۲) دادهٔ خام هر پهنه (پایهٔ استانی + پروفایل + override برخط) ──
  const rawZones: ZoneRaw[] = zones.map((z) => ({
    ...deriveZoneRaw(z),
    ...(overrides[z.id] ?? {}),
    ...(options.extraRaw?.[z.id] ?? {}),
  }));

  // ── ۳) مقادیر خام همهٔ زیرشاخص‌ها برای هر پهنه ──────────────
  const computedRaw = rawZones.map((r) => computeAllRaw(r));

  // ── ۴) کالیبراسیون: نرمال‌سازی در گروه هم‌مقیاس (شهری/روستایی)
  // ──── فقط روی جمعیت مرجع (refZones)؛ بازه‌های winsorize/Min–Max منجمد می‌شوند
  // ──── و برای پهنهٔ نقطه فقط اعمال می‌شوند (پیوست فنی، بخش ۱.۱ و ۲.۱) ──
  const urbanIdx = refIndexes.filter((i) => zones[i].scale !== 'rural');
  const ruralIdx = refIndexes.filter((i) => zones[i].scale === 'rural');
  const extraUrbanIdx = extraZones.map((_, j) => refZones.length + j).filter((i) => zones[i].scale !== 'rural');
  const extraRuralIdx = extraZones.map((_, j) => refZones.length + j).filter((i) => zones[i].scale === 'rural');

  // normMap[code] = آرایه‌های هم‌راستا با ایندکس پهنه
  const normMap: Record<string, { values: number[]; scaled: number[]; min: number; max: number }> = {};
  const rawWinsorized: Record<string, (number | null)[]> = {};

  for (const ind of INDICATOR_CATALOG) {
    const rawUrban = urbanIdx.map((i) => computedRaw[i][ind.code] ?? null);
    const rawRural = ruralIdx.map((i) => computedRaw[i][ind.code] ?? null);
    const nu = normalizeSeries(rawUrban, ind.direction);
    const nr = normalizeSeries(rawRural, ind.direction);

    const values: number[] = new Array(zones.length).fill(NaN);
    const scaled: number[] = new Array(zones.length).fill(NaN);
    const clipped: (number | null)[] = new Array(zones.length).fill(null);

    urbanIdx.forEach((zi, j) => {
      values[zi] = nu.values[j];
      scaled[zi] = nu.scaled[j];
      clipped[zi] = computedRaw[zi][ind.code] == null ? null : clamp(computedRaw[zi][ind.code] as number, nu.min, nu.max);
    });
    ruralIdx.forEach((zi, j) => {
      values[zi] = nr.values[j];
      scaled[zi] = nr.scaled[j];
      clipped[zi] = computedRaw[zi][ind.code] == null ? null : clamp(computedRaw[zi][ind.code] as number, nr.min, nr.max);
    });
    // پهنهٔ اضافی (نقطهٔ کاربر) با بازه‌های منجمد مرجع اعمال می‌شود
    extraUrbanIdx.forEach((zi) => {
      const raw = computedRaw[zi][ind.code];
      if (raw == null) {
        values[zi] = NaN; scaled[zi] = NaN; clipped[zi] = null;
      } else {
        const clippedV = clamp(raw as number, nu.min, nu.max);
        const norm = minmaxNormalize(clippedV, nu.min, nu.max, ind.direction);
        values[zi] = norm; scaled[zi] = toScale1to5(norm); clipped[zi] = clippedV;
      }
    });
    extraRuralIdx.forEach((zi) => {
      const raw = computedRaw[zi][ind.code];
      if (raw == null) {
        values[zi] = NaN; scaled[zi] = NaN; clipped[zi] = null;
      } else {
        const clippedV = clamp(raw as number, nr.min, nr.max);
        const norm = minmaxNormalize(clippedV, nr.min, nr.max, ind.direction);
        values[zi] = norm; scaled[zi] = toScale1to5(norm); clipped[zi] = clippedV;
      }
    });

    normMap[ind.code] = { values, scaled, min: Math.min(nu.min, nr.min), max: Math.max(nu.max, nr.max) };
    rawWinsorized[ind.code] = clipped;
  }

  // ── ۵) وزن‌دهی درون‌لایه: آنتروپی شانون + AHP seed + ترکیبی ──
  const weights: Record<LayerKey, Weights> = { P: { entropy: {}, ahp: {}, final: {} }, B: { entropy: {}, ahp: {}, final: {} }, N: { entropy: {}, ahp: {}, final: {} } };

  for (const layer of LAYERS) {
    const inds = INDICATORS_BY_LAYER[layer];
    // ماتریس m×n نرمال‌شده — فقط روی جمعیت مرجع (وزن‌های آنتروپی منجمد)
    const R = refIndexes.map((zi) => inds.map((ind) => (Number.isFinite(normMap[ind.code].values[zi]) ? normMap[ind.code].values[zi] : 0)));
    const entropy = shannonEntropyWeights(R);

    const ahpSeed = inds.map((ind) => ind.seedWeight);
    const reliability = inds.map((ind) => ind.reliability);
    const final = combineWeights(entropy, ahpSeed, reliability, alpha);

    inds.forEach((ind, j) => {
      weights[layer].entropy[ind.code] = entropy[j] ?? 0;
      weights[layer].ahp[ind.code] = ahpSeed[j];
      weights[layer].final[ind.code] = final[j] ?? 0;
    });
  }

  // ── ۶) نمرهٔ لایه + SI + گونه‌بندی + ماتریس + رادار + QC ─────
  const layerScoresPerZone = zones.map(() => ({} as Record<LayerKey, number>));
  const results: ZoneResult[] = zones.map((zone, zi) => {
    const scaledAll: Record<string, number> = {};
    const rawAll: Record<string, number | null> = {};
    for (const ind of INDICATOR_CATALOG) {
      scaledAll[ind.code] = normMap[ind.code].scaled[zi];
      rawAll[ind.code] = rawWinsorized[ind.code][zi];
    }

    const scores = {} as Record<LayerKey, { score: number; coverage: number; lowConfidence: boolean }>;
    for (const layer of LAYERS) {
      const inds = INDICATORS_BY_LAYER[layer];
      const scaledArr = inds.map((ind) => scaledAll[ind.code]);
      const wArr = inds.map((ind) => weights[layer].final[ind.code] ?? 0);
      scores[layer] = layerScore(scaledArr, wArr);
    }

    const P = scores.P.score;
    const B = scores.B.score;
    const N = scores.N.score;
    layerScoresPerZone[zi] = { P, B, N };

    const { si, criticalLayer } = geometricMeanSi(P, B, N);

    // مؤلفه‌های B برای تفکیک امضای مشترک (H,L,H)
    const avgOf = (codes: string[]) => {
      const vals = codes.map((c) => scaledAll[c]).filter((v) => v != null && Number.isFinite(v)) as number[];
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 3;
    };
    const bComponents = {
      valueChain: avgOf(['B3', 'B12', 'B11']),      // تنوع مرتبط/زنجیره ارزش
      cohesion: avgOf(['N6', 'N3', 'N12', 'N13']),  // انسجام/مشارکت
    };

    const { prescription, levels } = matrix9State(P, B, N, bComponents);
    const radar = radarMetrics(P, B, N);

    const species = {
      P: classifyLayer(P),
      B: classifyLayer(B),
      N: classifyLayer(N),
    } as Record<LayerKey, 1 | 2 | 3>;

    const speciesFa = {
      P: SPECIES_FA.P[species.P],
      B: SPECIES_FA.B[species.B],
      N: SPECIES_FA.N[species.N],
    } as Record<LayerKey, string>;

    const confidence = (scores.P.coverage + scores.B.coverage + scores.N.coverage) / 3;

    return {
      zone,
      raw: rawAll,
      norm: Object.fromEntries(INDICATOR_CATALOG.map((ind) => [ind.code, normMap[ind.code].values[zi]])),
      scaled: scaledAll,
      layerScores: scores as ZoneResult['layerScores'],
      si,
      criticalLayer,
      species,
      speciesFa,
      radar,
      prescription,
      confidence,
      qcFlags: [],
      hiddenCapacities: [],
    };
  });

  // ── ۷) کنترل کیفیت + ظرفیت‌های پنهان ────────────────────────
  const qc = runQualityChecks(
    results.map((r) => ({
      zoneId: r.zone.id,
      scores: { P: r.layerScores.P.score, B: r.layerScores.B.score, N: r.layerScores.N.score },
      scaled: r.scaled,
      indicatorNames: (code: string) => indicatorByCode(code)?.name,
    })),
  );
  warnings.push(...qc.warnings);
  const qcByZone = new Map(qc.zoneReports.map((z) => [z.zoneId, z]));
  for (const r of results) {
    const q = qcByZone.get(r.zone.id);
    r.qcFlags = q?.flags ?? [];
    r.hiddenCapacities = q?.hiddenCapacities ?? [];
  }

  // ── ۸) اولویت‌بندی بودجه (بخش ۹.۲) ──────────────────────────
  const budgetRanks = rankByBudgetPriority(
    results.map((r) => ({
      zoneId: r.zone.id,
      scores: { P: r.layerScores.P.score, B: r.layerScores.B.score, N: r.layerScores.N.score },
      si: r.si,
    })),
  );

  const provenance = [...buildBaseProvenance(liveKeys), ...liveProvenance, ...(options.extraProvenance ?? [])];

  return {
    zones: results,
    weights,
    layerAhp: { ...layerAhp(), matrix: LAYER_PAIRWISE },
    alpha,
    calibration: {
      runId: `cal-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`,
      computedAt: new Date().toISOString(),
      cohortSize: refZones.length,
      extraZoneCount: extraZones.length,
      frozen: extraZones.length > 0,
    },
    provenance,
    indicatorCount: INDICATOR_CATALOG.length,
    computedAt: new Date().toISOString(),
    warnings,
    budgetRanks,
  };
}
