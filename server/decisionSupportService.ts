// ============================================================
// سرویس تصمیم‌یار جامع — اجرای کامل الگوریتم گام‌به‌گام
// (بخش ۱۱ الگوریتم) — نسخه یکپارچه با پیمایش ادراکی، عدالت گروهی،
// نقشه اهرم، روند Q/T/R، دروازه یادگیری و شناسه اجرا
// ============================================================
import type {
  CapitalKey, CapitalScore, ChainStageScore, ChainGaps,
  DiagnosticType, CausalHypothesis, JusticeGap, EvaluationPlan,
  FourSourceEvidence, DecisionCard, ChainStage,
  SatelliteEvidenceBundle, GroupSlice, SurveyEvidenceSummary,
} from '../src/algorithm/types';
import { CAPITALS } from '../src/algorithm/types';
import { ALGORITHM_INDICATORS } from '../src/algorithm/algorithmIndicators';
import { computeAllCapitalScores } from '../src/algorithm/capitalScoring';
import { computeAllChainScores, averageChainStage } from '../src/algorithm/chainScoring';
import { computeQualityTriad } from '../src/algorithm/qualityMetrics';
import { diagnoseType } from '../src/algorithm/statusBands';
import { computeChainGaps, locateBottleneck } from '../src/algorithm/bottleneckLocator';
import { computeEquityGaps } from '../src/algorithm/equityMapper';
import { diagnoseCauses } from '../src/algorithm/causalDiagnosis';
import { generateInterventionCandidates, buildLeverMap } from '../src/algorithm/interventionMapper';
import { generateDecisionCard } from '../src/algorithm/decisionCard';
import { processSurvey, checkSkipTriggers, type SurveyResponse } from '../src/algorithm/perceptualSurvey';
import { getDecisionRunStore } from './decisionRunStore';

export interface SurveyInput {
  responses: SurveyResponse[];
  /** گروه پاسخگو برای تفکیک عدالت ادراکی، مثلاً «زنان» یا «سرپرست خانوار» */
  respondentGroup?: string;
}

export interface DecisionSupportRequest {
  neighborhoodName: string;
  cityOrCounty: string;
  province: string;
  purpose: 'baseline' | 'monitoring' | 'intervention_priority';
  indicatorValues: Record<string, number>;
  /** تفکیک گروهی: کد شاخص → گروه → امتیاز ۰..۱۰۰ */
  groupValues?: Record<string, Record<string, number>>;
  /** برش‌های گروهی کامل برای مکان‌یابی گلوگاه گروهی */
  groupSlices?: GroupSlice[];
  /** امتیاز زیرمکان‌ها برای تفکیک مکانی گلوگاه */
  subLocationScores?: Record<string, Record<string, number>>;
  /** امتیاز دوره قبل برای تفکیک زمانی */
  previousPeriodIndicatorValues?: Record<string, number>;
  /** پیمایش ادراکی — جریان شواهد ادراکی/رفتاری */
  survey?: SurveyInput;
  aoi?: { bbox: [number, number, number, number]; geometry?: unknown };
  satelliteEvidence?: SatelliteEvidenceBundle;
  /** جمعیت محله برای فاکتور جمعیت اولویت */
  population?: number;
}

export interface DecisionSupportResult {
  runId: string;
  card: DecisionCard;
}

export class DecisionSupportService {
  /**
   * تحلیل کامل یک محله — اجرای الگوریتم گام‌به‌گام (۱۵ مرحله)
   */
  analyze(request: DecisionSupportRequest): DecisionSupportResult {
    const store = getDecisionRunStore();
    const suppliedValues = Object.entries(request.indicatorValues).filter(([, value]) => typeof value === 'number' && Number.isFinite(value));
    if (suppliedValues.length === 0) {
      throw new Error('At least one measured indicator is required; synthetic defaults are disabled.');
    }
    const suppliedCodes = new Set(suppliedValues.map(([code]) => code));
    const coveredCapitals = new Set(ALGORITHM_INDICATORS.filter((indicator) => suppliedCodes.has(indicator.code)).map((indicator) => indicator.capitalKey));
    const missingCapitals = CAPITALS.filter((capital) => !coveredCapitals.has(capital));
    if (missingCapitals.length > 0) {
      throw new Error(`Insufficient measured coverage for capitals: ${missingCapitals.join(', ')}`);
    }

    const runId = store.createRun(
      request.neighborhoodName,
      request.purpose,
      [...suppliedCodes],
      Boolean(request.groupValues && Object.keys(request.groupValues).length > 0),
      Boolean(request.survey?.responses?.length),
    );

    try {
      const card = this.executePipeline(request, runId);
      store.completeRun(runId, card);
      return { runId, card };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decision analysis failed';
      store.failRun(runId, message);
      throw error;
    }
  }

  private executePipeline(request: DecisionSupportRequest, runId: string): DecisionCard {
    const store = getDecisionRunStore();

    // ۱. ادغام شواهد پیمایش ادراکی — جریان ادراکی و ارتقای شاخص‌ها
    let indicatorValues = { ...request.indicatorValues };
    let surveyEvidence: SurveyEvidenceSummary | undefined;
    if (request.survey?.responses?.length) {
      const stageScores = processSurvey(request.survey.responses);
      surveyEvidence = {
        integrated: true,
        respondentGroups: request.survey.respondentGroup ? [request.survey.respondentGroup] : ['پاسخگویان محله'],
        questionsAnswered: request.survey.responses.length,
        stageScores,
        skipTriggers: checkSkipTriggers(request.survey.responses).map(t => t.followUp),
      };
      // نگاشت گویه به گویه (شناسه سؤال پیمایش ≠ کد شاخص):
      // E3 اعتماد → S1 | E2 تعلق → S2 | فقط اگر اندازه‌گیری ثبتی وجود ندارد
      // (جریان ادراکی جای جریان عینی را نمی‌گیرد — قاعده ۱ کفایت شواهد)
      const likertTo100 = (v: number) => Math.round(((v - 1) / 4) * 1000) / 10;
      const surveyToIndicator: Record<string, string> = {
        E3: 'S1', // اعتماد به همسایگان → اعتماد همسایگی
        E2: 'S2', // تعلق به محله → تعلق محله‌ای
      };
      for (const [questionId, indicatorCode] of Object.entries(surveyToIndicator)) {
        const resp = request.survey.responses.find(r => r.questionId === questionId);
        if (resp && indicatorValues[indicatorCode] === undefined) {
          indicatorValues[indicatorCode] = likertTo100(resp.value);
        }
      }
    }

    // ۲. اعتبارسنجی پوشش سرمایه‌ها پس از ادغام پیمایش
    const effectiveCodes = new Set(Object.keys(indicatorValues));
    const coveredCapitals = new Set(ALGORITHM_INDICATORS.filter((i) => effectiveCodes.has(i.code)).map((i) => i.capitalKey));
    const missingCapitals = CAPITALS.filter((c) => !coveredCapitals.has(c));
    if (missingCapitals.length > 0) {
      throw new Error(`Insufficient measured coverage for capitals: ${missingCapitals.join(', ')}`);
    }

    // ۳. استانداردسازی شاخص‌ها
    const normalizedValues = ALGORITHM_INDICATORS.flatMap(ind => {
      const raw = indicatorValues[ind.code];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return [];
      const normalized = ind.direction === 'desc' ? 100 - raw : raw;
      return [{
        code: ind.code,
        capitalKey: ind.capitalKey,
        chainStage: ind.chainStage,
        normalized: Math.max(0, Math.min(100, normalized)),
        reliability: ind.reliability,
      }];
    });

    // ۴. امتیاز هشت سرمایه
    const capitalScores = computeAllCapitalScores(normalizedValues);
    const capScoreMap = Object.fromEntries(
      capitalScores.map(c => [c.capitalKey, c.score]),
    ) as Record<CapitalKey, number>;

    // ۵. امتیاز زنجیره C-A-U-E-O
    const chainScores = computeAllChainScores(normalizedValues);

    // ۶. محاسبه Q, T, R
    const chainAvg = {
      CAPACITY: averageChainStage(chainScores, 'CAPACITY'),
      ACCESS: averageChainStage(chainScores, 'ACCESS'),
      USE: averageChainStage(chainScores, 'USE'),
      EXPERIENCE: averageChainStage(chainScores, 'EXPERIENCE'),
      OUTCOME: averageChainStage(chainScores, 'OUTCOME'),
    };
    const triad = computeQualityTriad(capScoreMap, chainAvg);

    // ۷. تیپ تشخیصی K-T-R
    const avgK = capitalScores.reduce((s, c) => s + c.score, 0) / capitalScores.length;
    const diagnosticType = diagnoseType(triad.Q, triad.T, triad.R, avgK);

    // ۸. شکاف‌ها
    const allChainGaps: ChainGaps = { G_CA: 0, G_AU: 0, G_UE: 0, G_EO: 0 };
    const gapCounts: Record<keyof ChainGaps, number> = { G_CA: 0, G_AU: 0, G_UE: 0, G_EO: 0 };
    const transitions = [
      ['G_CA', 'CAPACITY', 'ACCESS'], ['G_AU', 'ACCESS', 'USE'],
      ['G_UE', 'USE', 'EXPERIENCE'], ['G_EO', 'EXPERIENCE', 'OUTCOME'],
    ] as const;
    for (const cap of CAPITALS) {
      const scores = chainScores[cap] ?? [];
      const gaps = computeChainGaps(scores);
      for (const [key, from, to] of transitions) {
        if (scores.some((score) => score.stage === from) && scores.some((score) => score.stage === to)) {
          allChainGaps[key] += gaps[key];
          gapCounts[key] += 1;
        }
      }
    }
    for (const key of Object.keys(allChainGaps) as Array<keyof ChainGaps>) {
      allChainGaps[key] = gapCounts[key] > 0 ? Math.round(allChainGaps[key] / gapCounts[key] * 10) / 10 : 0;
    }

    // ۹. عدالت — داده گروهی واقعی یا پیمایش گروهی
    const groupSources: Array<Record<string, Record<string, number>>> = [];
    if (request.groupValues && Object.keys(request.groupValues).length > 0) {
      groupSources.push(request.groupValues);
    }
    const equityGaps: JusticeGap[] = [];
    const seenIndicators = new Set<string>();
    for (const source of groupSources) {
      for (const [code, groupScores] of Object.entries(source)) {
        if (seenIndicators.has(code)) continue;
        seenIndicators.add(code);
        equityGaps.push(...computeEquityGaps([{ code, groupScores }]));
      }
    }

    // ۱۰. مکان‌یابی گلوگاه با تفکیک ۵ بعدی واقعی
    const { bottleneck, diagnosis: bottleneckDiagnosis } = locateBottleneck({
      allChainScores: chainScores,
      equityData: equityGaps,
      groupSlices: this.deriveGroupSlices(request),
      subLocationScores: request.subLocationScores,
      previousPeriodScores: request.previousPeriodIndicatorValues,
      currentPeriodScores: indicatorValues,
    });

    // ۱۱. تشخیص علّی — چهار جریان شواهد
    const fourSourceEvidence: FourSourceEvidence = {
      objective: indicatorValues,
      spatial: this.deriveSpatialEvidence(request),
      behavioral: this.deriveBehavioralEvidence(request),
      perceptual: surveyEvidence
        ? (Object.fromEntries(Object.entries(surveyEvidence.stageScores).map(([stage, score]) => [`survey:${stage}`, score ?? 0])) as Record<string, number | null>)
        : {},
    };
    const hypotheses: CausalHypothesis[] = diagnoseCauses(allChainGaps, bottleneck, fourSourceEvidence);

    // ۱۲. سبد مداخله — امتیاز اولویت واقعی + فیلترهای عدم‌مداخله
    const capitalIndicatorCodes = new Map<CapitalKey, string[]>();
    for (const ind of ALGORITHM_INDICATORS) {
      capitalIndicatorCodes.set(ind.capitalKey, [...(capitalIndicatorCodes.get(ind.capitalKey) ?? []), ind.code]);
    }
    const interventions = generateInterventionCandidates({
      gaps: allChainGaps,
      diagnosticType,
      capitalScores: capScoreMap,
      chainScores,
      equityGaps,
      capitalIndicatorCodes,
      population: request.population,
    });

    // ۱۳. نقشه اهرم
    const levers = buildLeverMap(capScoreMap, chainScores);

    // ۱۴. طرح ارزیابی
    const evaluationPlan: EvaluationPlan = {
      baseline: ALGORITHM_INDICATORS.filter(i => effectiveCodes.has(i.code)).map(i => `${i.code}: ${i.name}`),
      targets: [`Q ≥ ${Math.min(100, triad.Q + 10).toFixed(0)}`, `T ≥ ${Math.min(100, triad.T + 10).toFixed(0)}`, `R ≥ ${Math.min(100, triad.R + 5).toFixed(0)}`],
      outputIndicators: ['تعداد پروژه‌های تکمیل‌شده', 'تعداد مشارکت‌کنندگان'],
      outcomeIndicators: ['تغییر در پیمایش رضایت', 'تغییر در استفاده واقعی'],
      impactIndicators: ['تغییر در Q, T, R', 'تغییر در عدالت'],
      sideEffects: ['جابه‌جایی ساکنان', 'افزایش ارزش زمین', 'تخریب سرمایه‌های دیگر'],
      stopRules: ['کاهش SI < 0.9', 'افزایش JusticeGap > 20'],
    };

    // ۱۵. روند Q/T/R نسبت به اجرای قبلی
    const trend = store.computeTrend(request.neighborhoodName, triad, runId);

    // ۱۶. کارت تصمیم با هر ۱۲ جزء
    const card = generateDecisionCard({
      neighborhoodName: request.neighborhoodName,
      capitalScores,
      chainScores,
      triad,
      diagnosticType,
      chainGaps: allChainGaps,
      equityGaps,
      bottleneck,
      hypotheses,
      interventions,
      levers,
      evaluationPlan,
      learningNotebook: [
        `خط پایه ثبت شد در ${new Date().toISOString().slice(0, 10)}`,
        bottleneckDiagnosis,
        surveyEvidence ? `پیمایش ادراکی با ${surveyEvidence.questionsAnswered} پاسخ ادغام شد` : 'پیمایش ادراکی دریافت نشد — حکم ادراکی صادر نمی‌شود',
        equityGaps.length > 0 ? `${equityGaps.length} شاخص با تفکیک گروهی تحلیل شد` : 'بدون داده گروهی — حکم قطعی عدالت ممنوع',
      ],
      trend,
      surveyEvidence,
      runId,
    });

    return request.satelliteEvidence ? { ...card, satelliteEvidence: request.satelliteEvidence } : card;
  }

  /** ساخت برش‌های گروهی از groupValues برای مکان‌یابی گروهی گلوگاه */
  private deriveGroupSlices(request: DecisionSupportRequest): GroupSlice[] {
    if (request.groupSlices?.length) return request.groupSlices;
    if (!request.groupValues || Object.keys(request.groupValues).length === 0) return [];
    // ساخت برش از فرمت code → group → score
    const groups = new Set<string>();
    for (const groupScores of Object.values(request.groupValues)) {
      for (const group of Object.keys(groupScores)) groups.add(group);
    }
    return [...groups].map(group => {
      const scores: Record<string, number> = {};
      for (const [code, groupScores] of Object.entries(request.groupValues!)) {
        const value = groupScores[group];
        if (typeof value === 'number' && Number.isFinite(value)) scores[code] = value;
      }
      return { group, scores };
    });
  }

  /** شواهد مکانی از AOI و شواهد ماهواره‌ای */
  private deriveSpatialEvidence(request: DecisionSupportRequest): Record<string, number | null> {
    const spatial: Record<string, number | null> = {};
    if (request.aoi?.bbox) {
      spatial['aoi:bbox'] = null; // ثبت حضور AOI بدون عددسازی
    }
    const sat = request.satelliteEvidence;
    if (sat) {
      for (const item of sat.latestByFeature) {
        spatial[`sat:${item.feature}`] = item.value;
      }
    }
    return spatial;
  }

  /** شواهد رفتاری — فعلاً از پاسخ‌های پیمایش رفتاری پر می‌شود (S4 مشارکت، U3 استفاده) */
  private deriveBehavioralEvidence(request: DecisionSupportRequest): Record<string, number | null> {
    const behavioral: Record<string, number | null> = {};
    if (request.survey?.responses?.length) {
      const s4 = request.survey.responses.find(r => r.questionId === 'S4');
      if (s4) behavioral['behavioral:S4'] = s4.value;
      const u3 = request.survey.responses.find(r => r.questionId === 'U3');
      if (u3) behavioral['behavioral:U3'] = u3.value;
    }
    return behavioral;
  }
}
