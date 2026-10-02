// ============================================================
// کارت تصمیم محله — ۱۲ جزء خروجی استاندارد (بخش ۱۲ الگوریتم)
// ============================================================
import type {
  DecisionCard, QualityTriad, DiagnosticType, CapitalScore,
  ChainStageScore, ChainGaps, JusticeGap, ProblemAddress,
  CausalHypothesis, InterventionCandidate, EvaluationPlan,
  CapitalKey, ChainStage, LeverPoint, QualityTriadTrend,
  SurveyEvidenceSummary,
} from './types';
import { CAPITAL_FA, CHAIN_FA, CAPITALS, DIAGNOSTIC_TYPES, BAND_CONFIG } from './types';
import { scoreToBand } from './statusBands';

/**
 * تولید جمله نهایی سیستم
 */
export function generateFinalStatement(
  triad: QualityTriad,
  diagnosticType: DiagnosticType,
  capitalScores: CapitalScore[],
  bottleneck: ProblemAddress,
  hypotheses: CausalHypothesis[],
  interventions: InterventionCandidate[],
): string {
  const qBand = BAND_CONFIG[scoreToBand(triad.Q)];
  const tBand = BAND_CONFIG[scoreToBand(triad.T)];
  const rBand = BAND_CONFIG[scoreToBand(triad.R)];

  const topHypothesis = hypotheses[0];
  const executable = interventions.filter(item => !item.excluded);
  const topIntervention = executable[0] ?? interventions[0];

  return [
    `این محله از نظر **کیفیت محقق‌شده [Q=${triad.Q.toFixed(1)}]** در وضعیت ${qBand.color} ${qBand.label}،`,
    `از نظر **توان تبدیل [T=${triad.T.toFixed(1)}]** در وضعیت ${tBand.color} ${tBand.label} و`,
    `از نظر **بازتولید [R=${triad.R.toFixed(1)}]** در وضعیت ${rBand.color} ${rBand.label} است.`,
    ``,
    `تیپ تشخیصی: **${diagnosticType} — ${DIAGNOSTIC_TYPES[diagnosticType].interpretation}**`,
    ``,
    `گلوگاه اصلی در **${CAPITAL_FA[bottleneck.capital]}** و`,
    `گذار **${CHAIN_FA[bottleneck.transition[0]]} → ${CHAIN_FA[bottleneck.transition[1]]}**`,
    bottleneck.location !== 'کل محله' ? `در **${bottleneck.location}**` : '',
    bottleneck.group !== 'تمام ساکنان' && bottleneck.group !== 'کل جمعیت' ? `برای **${bottleneck.group}**` : '',
    bottleneck.time !== 'فعلی' ? `و روند آن **${bottleneck.time}** است` : '',
    `رخ می‌دهد.`,
    ``,
    topHypothesis ? `علت فعلی **${topHypothesis.evidenceStatus === 'convergent' ? 'دارای شواهد همگرا' : topHypothesis.evidenceStatus === 'tested' ? 'آزمون‌شده' : 'فرضیه اولیه'}** و محتمل‌ترین سازوکار: ${topHypothesis.hypothesis}.` : '',
    topIntervention ? `اقدام اولویت‌دار: **${topIntervention.name}** (اولویت ${topIntervention.priorityEquityAdjusted?.toFixed(2) ?? '—'}).` : '',
  ].filter(Boolean).join('\n');
}

export interface GenerateDecisionCardParams {
  neighborhoodName: string;
  capitalScores: CapitalScore[];
  chainScores: Record<CapitalKey, ChainStageScore[]>;
  triad: QualityTriad;
  diagnosticType: DiagnosticType;
  chainGaps: ChainGaps;
  equityGaps: JusticeGap[];
  bottleneck: ProblemAddress;
  hypotheses: CausalHypothesis[];
  interventions: InterventionCandidate[];
  levers: LeverPoint[];
  evaluationPlan: EvaluationPlan;
  learningNotebook: string[];
  trend?: QualityTriadTrend;
  surveyEvidence?: SurveyEvidenceSummary;
  runId?: string;
  learningGate?: DecisionCard['learningGate'];
}

/**
 * تولید کارت تصمیم کامل با هر ۱۲ جزء
 */
export function generateDecisionCard(params: GenerateDecisionCardParams): DecisionCard {
  const statement = generateFinalStatement(
    params.triad,
    params.diagnosticType,
    params.capitalScores,
    params.bottleneck,
    params.hypotheses,
    params.interventions,
  );

  // رتبه‌بندی: فقط اقدامات غیرحذف‌شده، مرتب بر اساس اولویت تعدیل‌شده با عدالت
  const ranked = params.interventions
    .filter(item => !item.excluded)
    .map(item => ({ id: item.id, score: item.priorityEquityAdjusted ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    neighborhoodName: params.neighborhoodName,
    assessmentDate: new Date().toISOString(),
    runId: params.runId,
    qualityVerdict: params.triad,
    diagnosticType: params.diagnosticType,
    capitalScores: params.capitalScores,
    chainProfile: params.chainScores,
    chainGaps: params.chainGaps,
    equityMap: params.equityGaps,
    bottleneck: params.bottleneck,
    hypotheses: params.hypotheses,
    interventions: params.interventions,
    priorityRanking: ranked,
    levers: params.levers,
    trend: params.trend ?? {
      direction: 'first_run',
      deltaQ: 0,
      deltaT: 0,
      deltaR: 0,
    },
    surveyEvidence: params.surveyEvidence,
    equityDataStatus: params.equityGaps.length > 0 ? 'measured' : 'missing',
    evaluationPlan: params.evaluationPlan,
    learningNotebook: params.learningNotebook,
    learningGate: params.learningGate,
    finalStatement: statement,
  };
}

/** برچسب فارسی باند وضعیت (اصلاح no-op قبلی) */
export function bandLabelFa(band: keyof typeof BAND_CONFIG): string {
  return BAND_CONFIG[band].label;
}
