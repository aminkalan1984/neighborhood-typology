// ============================================================
// انواع دامنه‌ای الگوریتم تصمیم‌یار جامع محله
// (انواع مورد نیاز برای اتصال کامل سیستم)
// ============================================================

export type LayerKey = 'P' | 'B' | 'N';
export const LAYERS: LayerKey[] = ['P', 'B', 'N'];
export const LAYER_FA: Record<LayerKey, string> = {
  P: 'کالبدی–زیرساختی',
  B: 'رفتاری–اجتماعی',
  N: 'هنجاری–ادراکی',
};
export const LAYER_SHORT_FA: Record<LayerKey, string> = {
  P: 'کالبد',
  B: 'رفتار',
  N: 'هنجار',
};
export type Direction = 'asc' | 'desc' | 'neutral';
export type Species = 1 | 2 | 3;

// ─── هشت سرمایه محله ─────────────────────────────────────────
export type CapitalKey = 'H' | 'S' | 'E' | 'P' | 'N' | 'C' | 'G' | 'R';
export const CAPITALS: CapitalKey[] = ['H', 'S', 'E', 'P', 'N', 'C', 'G', 'R'];
export const CAPITAL_FA: Record<CapitalKey, string> = {
  H: 'انسانی',
  S: 'اجتماعی',
  E: 'اقتصادی',
  P: 'کالبدی–زیرساختی',
  N: 'طبیعی–محیطی',
  C: 'فرهنگی–هویتی',
  G: 'نهادی–حکمرانی',
  R: 'شبکه‌ای–ارتباطی',
};

// ─── زنجیره کیفیت C-A-U-E-O ────────────────────────────────
export type ChainStage = 'CAPACITY' | 'ACCESS' | 'USE' | 'EXPERIENCE' | 'OUTCOME';
export const CHAIN_STAGES: ChainStage[] = ['CAPACITY', 'ACCESS', 'USE', 'EXPERIENCE', 'OUTCOME'];
export const CHAIN_FA: Record<ChainStage, string> = {
  CAPACITY: 'ظرفیت',
  ACCESS: 'دسترسی',
  USE: 'استفاده',
  EXPERIENCE: 'تجربه',
  OUTCOME: 'پیامد',
};

// ─── نقش شاخص در زنجیره ────────────────────────────────────
export type IndicatorRole = 'capacity' | 'access' | 'use' | 'experience' | 'outcome' | 'conversion' | 'equity' | 'risk' | 'reproduction';

// ─── شاخص الگوریتم ──────────────────────────────────────────
export interface AlgorithmIndicator {
  code: string;
  capitalKey: CapitalKey;
  name: string;
  operationalDefinition: string;
  formula: string;
  source: string;
  direction: 'asc' | 'desc';
  chainStage: ChainStage;
  role: IndicatorRole;
  reliability: number;
}

// ─── واحد مشاهده ────────────────────────────────────────────
export interface ObservationUnit {
  what: string;
  where: string;
  when: string;
  forWhom: string;
  method: 'census' | 'gis' | 'behavioral' | 'survey';
  reliability: 'initial' | 'convergent' | 'tested';
}

// ─── چهار جریان داده ────────────────────────────────────────
export interface FourSourceEvidence {
  objective: Record<string, number | null>;
  spatial: Record<string, number | null>;
  behavioral: Record<string, number | null>;
  perceptual: Record<string, number | null>;
}

export interface SatelliteEvidenceItem {
  featureId: string;
  feature: string;
  value: number;
  unit?: string;
  status: 'observed' | 'derived' | 'inferred' | 'synthetic' | 'estimated';
  provider: string;
  sourceItem: string;
  sourceJobId?: string;
  acquiredAt: string;
  publishedAt?: string;
  latencyMinutes?: number;
  cloudCover?: number | null;
  resolutionM?: number;
  maskFraction: number;
  method: string;
  confidence: number;
  bbox?: [number, number, number, number];
  stale: boolean;
}

export interface SatelliteEvidenceBundle {
  queriedBbox: [number, number, number, number];
  freshnessSlaHours: number;
  collectedAt: string;
  latestByFeature: SatelliteEvidenceItem[];
  observedCount: number;
  derivedCount: number;
  staleCount: number;
  decisionImpact: 'evidence_only';
}

// ─── نشانی مسئله ────────────────────────────────────────────
export interface ProblemAddress {
  capital: CapitalKey;
  transition: [ChainStage, ChainStage];
  location: string;
  group: string;
  time: string;
  /** سطح اتکای تفکیک‌ها — داده‌ی تفکیکی موجود بوده یا خیر */
  disaggregation?: 'measured' | 'partial' | 'unavailable';
}

// ─── برش گروهی برای تفکیک عدالت/گلوگاه ──────────────────────
export interface GroupSlice {
  group: string;
  /** امتیاز نرمال‌شده ۰..۱۰۰ برای هر شاخص در این گروه */
  scores: Record<string, number>;
  population?: number;
}

// ─── فرضیه علّی ─────────────────────────────────────────────
export type EvidenceStatus = 'initial' | 'convergent' | 'tested';
export type FrictionType = 'cost' | 'insecurity' | 'quality' | 'time' | 'physical_barrier' | 'information' | 'norm' | 'governance';

export interface CausalHypothesis {
  hypothesis: string;
  frictionType: FrictionType;
  evidenceStatus: EvidenceStatus;
  sources: string[];
  causalChain: string[];
}

// ─── Q, T, R ────────────────────────────────────────────────
export interface QualityTriad {
  Q: number;
  T: number;
  R: number;
}

// ─── شکاف‌های زنجیره ────────────────────────────────────────
export interface ChainGaps {
  G_CA: number;
  G_AU: number;
  G_UE: number;
  G_EO: number;
}

// ─── عدالت ──────────────────────────────────────────────────
export interface JusticeGap {
  indicatorCode: string;
  bestGroup: string;
  worstGroup: string;
  gap: number;
  verdict: 'equal' | 'unequal_but_good' | 'critical';
}

// ─── باند وضعیت ─────────────────────────────────────────────
export type StatusBand = 'CRITICAL' | 'WEAK' | 'MODERATE' | 'GOOD' | 'EXCELLENT';
export const BAND_CONFIG: Record<StatusBand, { min: number; max: number; color: string; label: string; meaning: string }> = {
  CRITICAL: { min: 0, max: 39, color: '🔴', label: 'بحرانی', meaning: 'مداخله فوری' },
  WEAK: { min: 40, max: 59, color: '🟠', label: 'ضعیف', meaning: 'مداخله اولویت‌دار' },
  MODERATE: { min: 60, max: 74, color: '🟡', label: 'متوسط', meaning: 'بهبود هدفمند' },
  GOOD: { min: 75, max: 89, color: '🟢', label: 'خوب', meaning: 'تثبیت و ارتقا' },
  EXCELLENT: { min: 90, max: 100, color: '🔵', label: 'ممتاز', meaning: 'حفاظت و انتقال تجربه' },
};

// ─── تیپ تشخیصی ─────────────────────────────────────────────
export type DiagnosticType = 'A' | 'B' | 'C' | 'D' | 'E';
export const DIAGNOSTIC_TYPES: Record<DiagnosticType, { interpretation: string; strategy: string }> = {
  A: { interpretation: 'کمبود پایه و توان حل مسئله', strategy: 'سرمایه‌گذاری پایه' },
  B: { interpretation: 'سرمایه محبوس', strategy: 'آزادسازی ظرفیت و رفع گلوگاه' },
  C: { interpretation: 'موفقیت شکننده', strategy: 'تثبیت و جلوگیری از فرسایش' },
  D: { interpretation: 'محله مولد، عادلانه و بازتولیدشونده', strategy: 'حفاظت، توسعه و انتقال تجربه' },
  E: { interpretation: 'مشکل محدود در یک حلقه', strategy: 'مداخله نقطه‌ای' },
};

// ─── امتیاز سرمایه ──────────────────────────────────────────
export interface CapitalScore {
  capitalKey: CapitalKey;
  score: number;
  band: StatusBand;
  evidenceReliability: number;
  indicatorCount: number;
}

// ─── پروفایل زنجیره ────────────────────────────────────────
export interface ChainStageScore {
  stage: ChainStage;
  score: number;
  band: StatusBand;
}

// ─── نتیجه موتور سنجش ──────────────────────────────────────
export interface AssessmentResult {
  capitalScores: CapitalScore[];
  chainScores: Record<CapitalKey, ChainStageScore[]>;
  qualityTriad: QualityTriad;
  diagnosticType: DiagnosticType;
  chainGaps: ChainGaps;
  equityGaps: JusticeGap[];
}

// ─── نتیجه موتور تشخیص ──────────────────────────────────────
export interface DiagnosisResult {
  bottleneck: ProblemAddress;
  hypotheses: CausalHypothesis[];
  equityAssessment: JusticeGap[];
  confidence: EvidenceStatus;
}

// ─── نتیجه موتور تجویز ──────────────────────────────────────
export interface PrescriptionResult {
  interventions: InterventionCandidate[];
  priorityRanking: Array<{ id: string; score: number; rank: number }>;
  evaluationPlan: EvaluationPlan;
}

export interface InterventionCandidate {
  id: string;
  name: string;
  targetCapital: CapitalKey;
  targetTransition: [ChainStage, ChainStage];
  severity: number;
  population: number;
  leverage: number;
  feasibility: number;
  equity: number;
  family: string;
  description: string;
  /** فیلترهای عدم‌مداخله — دلیل حذف از سبد اجرایی */
  excluded?: { code: 'NO_MEASUREMENT' | 'NO_MEANINGFUL_GAP' | 'EQUITY_HARM_RISK'; reason: string } | null;
  /** اولویت خام و تعدیل‌شده با عدالت */
  priorityScore?: number;
  priorityEquityAdjusted?: number;
}

// ─── نقشه اهرم ───────────────────────────────────────────────
export interface LeverPoint {
  id: string;
  capitalKey: CapitalKey;
  stage: ChainStage;
  description: string;
  affectedCapitals: CapitalKey[];
  effectScore: number;
}

// ─── روند Q/T/R نسبت به اجرای قبلی ──────────────────────────
export interface QualityTriadTrend {
  direction: 'up' | 'down' | 'stable' | 'first_run';
  deltaQ: number;
  deltaT: number;
  deltaR: number;
  comparedToRunId?: string;
  comparedToDate?: string;
}

// ─── ادغام شواهد ادراکی پیمایش ───────────────────────────────
export interface SurveyEvidenceSummary {
  integrated: boolean;
  respondentGroups: string[];
  questionsAnswered: number;
  stageScores: Partial<Record<ChainStage, number>>;
  skipTriggers: string[];
}

export interface EvaluationPlan {
  baseline: string[];
  targets: string[];
  outputIndicators: string[];
  outcomeIndicators: string[];
  impactIndicators: string[];
  sideEffects: string[];
  stopRules: string[];
}

// ─── حافظه زنده ─────────────────────────────────────────────
export interface LivingMemoryEntry {
  id: string;
  capitalKey: CapitalKey;
  trigger: string;
  outcome: 'success' | 'partial' | 'failure';
  rule: string;
  evidence: string;
  dateRecorded: string;
  dateLastApplied?: string;
  applicationCount: number;
  supersededBy?: string;
}

// ─── سطح یادگیری ────────────────────────────────────────────
export interface LearningCapabilities {
  sensing: number;
  interpretation: number;
  feedback: number;
  adaptation: number;
  memory: number;
}

export interface LearningResult {
  capitalKey: CapitalKey;
  L: number;
  gate: 'normal' | 'warning' | 'locked' | 'disrupted';
  weakestCapability: string;
}

// ─── کارت تصمیم ─────────────────────────────────────────────
export interface DecisionCard {
  neighborhoodName: string;
  assessmentDate: string;
  runId?: string;
  qualityVerdict: QualityTriad;
  diagnosticType: DiagnosticType;
  capitalScores: CapitalScore[];
  chainProfile: Record<CapitalKey, ChainStageScore[]>;
  chainGaps: ChainGaps;
  equityMap: JusticeGap[];
  bottleneck: ProblemAddress;
  hypotheses: CausalHypothesis[];
  interventions: InterventionCandidate[];
  priorityRanking: Array<{ id: string; score: number; rank: number }>;
  levers: LeverPoint[];
  trend: QualityTriadTrend;
  surveyEvidence?: SurveyEvidenceSummary;
  equityDataStatus: 'measured' | 'missing';
  evaluationPlan: EvaluationPlan;
  learningNotebook: string[];
  learningGate?: {
    capitalKey: CapitalKey;
    L: number;
    gate: 'normal' | 'warning' | 'locked' | 'disrupted';
    weakestCapability: string;
  };
  finalStatement: string;
  satelliteEvidence?: SatelliteEvidenceBundle;
}

// ─── چرخه آزمایش و ردیابی مداخله (اتصال سرور) ───────────────
export type RunStatus = 'running' | 'completed' | 'failed';

export interface DecisionRunSummary {
  runId: string;
  neighborhoodName: string;
  createdAt: string;
  status: RunStatus;
  qualityVerdict: QualityTriad;
  diagnosticType: DiagnosticType;
  bottleneck: ProblemAddress;
  measuredIndicatorCount: number;
}

// ─── انواع عمومی ────────────────────────────────────────────
export interface Weights {
  entropy: Record<string, number>;
  ahp: Record<string, number>;
  final: Record<string, number>;
}

export interface LayerScore {
  score: number;
  coverage: number;
  lowConfidence: boolean;
}

export interface RadarMetrics {
  area: number;
  balanceGap: number;
  skew: LayerKey | null;
}

export interface Prescription {
  stateId: number;
  key: string;
  diagnosis: string;
  intervention: string;
  budgetPriority: number;
  twinTrack: boolean;
  targetScores: Partial<Record<LayerKey, number>>;
  exitKpi: string;
}

export interface ZoneResult {
  zone: ZoneMeta;
  raw: Record<string, number | null>;
  norm: Record<string, number>;
  scaled: Record<string, number>;
  layerScores: Record<LayerKey, LayerScore>;
  si: number;
  criticalLayer: LayerKey | null;
  species: Record<LayerKey, Species>;
  speciesFa: Record<LayerKey, string>;
  radar: RadarMetrics;
  prescription: Prescription;
  confidence: number;
  qcFlags: string[];
  hiddenCapacities: string[];
}

export interface Provenance {
  sourceKey: string;
  sourceFa: string;
  status: 'live' | 'simulated' | 'gap';
  detail: string;
  fetchedAt?: string;
}

export interface CalibrationInfo {
  runId: string;
  computedAt: string;
  cohortSize: number;
  extraZoneCount: number;
  frozen: boolean;
}

export interface PipelineResult {
  zones: ZoneResult[];
  weights: Record<LayerKey, Weights>;
  layerAhp: { matrix: number[][]; lambdaMax: number; ci: number; cr: number; weights: number[] };
  alpha: number;
  calibration?: CalibrationInfo;
  provenance: Provenance[];
  indicatorCount: number;
  computedAt: string;
  warnings: string[];
  budgetRanks?: Array<{ zoneId: string; priorityScore: number; rank: number; reason: string }>;
}

// ─── انواع پهنه (مورد نیاز data.ts و engine.ts) ─────────────
export interface ZoneMeta {
  id: string;
  name: string;
  city: string;
  provinceId: string;
  provinceFa: string;
  anchor: string;
  anchorType: 'mosque' | 'imamzadeh' | 'husseiniyeh' | 'bazaar' | 'school';
  households: number;
  population: number;
  lat: number;
  lng: number;
  scale: 'urban' | 'rural';
  profile: 'advanced' | 'mid' | 'deprived' | 'hidden-capital';
}

export interface ZoneRaw {
  utilityPenetration: number;
  solidHousing: number;
  broadband: number;
  nightlight: number;
  nightlightTrend: number;
  blindSpots: number;
  permeability: number;
  serviceDistance: number;
  multiPurposeSpaces: number;
  hazardExposure: number;
  fineGrainShare: number;
  no2: number; so2: number; aerosol: number; pm25: number;
  lst: number;
  ndvi: number; builtShare: number; settlementFootprint: number;
  populationDensity: number;
  waterSurfaceShare: number; spei: number;
  intersectionDensity: number; connectivity: number; pedestrianInfra: number;
  busStops: number; metroAccess: number;
  serviceAccess2sfca: number; walkability: number;
  fixedBroadbandSpeed: number; mobileSpeed: number;
  cellTowers: number; lte5gShare: number;
  fuelStations: number; hospitalDist: number;
  pharmacyDensity: number; clinicDensity: number; healthCentersPerCap: number;
  foodShops: number;
  safeWater: number; improvedSanitation: number; handwashing: number;
  urbanizationShare: number;
  selfEmployment: number; youthShare: number;
  relatedVariety: number; techAdoption: number; economicDynamism: number;
  outMigration: number; unemployment: number;
  bankAtmDensity: number; marketDensity: number; businessDiversity: number;
  durableGoods: number; dependencyRatio: number; youth1529: number;
  literacy: number; meanSchooling: number; higherEduShare: number;
  secondaryCompletion: number; dropoutRate: number; genderParity: number;
  schoolDensity: number; pupilTeacherRatio: number;
  tertiaryEnrollment: number; digitalLiteracy: number;
  religiousInstitutions: number; learningCenters: number;
  electoralParticipation: number; socialHarmRate: number;
  residentialStability: number; ownershipShare: number;
  femaleHeadShare: number; householdSize: number;
  elderlyShare: number; multigenShare: number;
  ngoDensity: number; worshipDensity: number; parkPerCap: number;
  protestEvents: number; preschoolParticipation: number;
  libraryDensity: number; lifeExpectancy: number; dalyBurden: number;
  fieldSurvey: boolean;
}

export interface SubIndicator {
  code: string;
  layer: LayerKey;
  name: string;
  formula: string;
  source: string;
  sourceKey: string;
  direction: Direction;
  proxy: boolean;
  reliability: number;
  cluster: string;
  seedWeight: number;
  compute: (raw: ZoneRaw) => number | null;
}
