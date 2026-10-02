// ============================================================
// تست موتورهای جدید: اولویت مداخله، تفکیک گلوگاه، حافظه زنده،
// چرخه آزمایش، روند Q/T/R و ادغام پیمایش
// ============================================================
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateInterventionCandidates,
  buildLeverMap,
  mapDiagnosisToIntervention,
} from './interventionMapper';
import { locateBottleneck, computeChainGaps } from './bottleneckLocator';
import { diagnoseType, scoreToBand } from './statusBands';
import { computeQualityTriad } from './qualityMetrics';
import {
  createLivingMemory, addEntry, getActiveRules, supersedeRule,
} from './livingMemory';
import { createExperiment, decideOutcome, experimentToMemory } from './experimentCycle';
import { computeLearningScore, dynamicResilience, problemSolvingImbalance } from './learningEngine';
import type { ChainStageScore, CapitalKey, JusticeGap, GroupSlice, ChainGaps } from './types';

const ALL_CAPITALS: CapitalKey[] = ['H', 'S', 'E', 'P', 'N', 'C', 'G', 'R'];

function uniformChain(score: number, stageDrop = 0): ChainStageScore[] {
  // هر گذار stageDrop واحد افت دارد
  return (['CAPACITY', 'ACCESS', 'USE', 'EXPERIENCE', 'OUTCOME'] as const).map((stage, i) => ({
    stage,
    score: Math.max(0, score - i * stageDrop),
    band: scoreToBand(Math.max(0, score - i * stageDrop)),
  }));
}

// ─── تیپ‌های تشخیصی K-T-R ─────────────────────────────────────
test('diagnoseType classifies all five K-T-R types', () => {
  assert.equal(diagnoseType(20, 25, 20, 22), 'A'); // کمبود پایه
  assert.equal(diagnoseType(70, 30, 25, 75), 'B'); // سرمایه محبوس
  assert.equal(diagnoseType(75, 80, 30, 80), 'C'); // موفقیت شکننده
  assert.equal(diagnoseType(85, 85, 85, 85), 'D'); // محله مولد
  assert.equal(diagnoseType(75, 50, 80, 80), 'E'); // مشکل محدود
});

// ─── امتیاز اولویت مداخله ─────────────────────────────────────
test('intervention candidates carry real differentiated priority factors', () => {
  const capitalScores = { H: 30, S: 80, E: 60, P: 20, N: 70, C: 50, G: 90, R: 40 } as Record<CapitalKey, number>;
  const candidates = generateInterventionCandidates({
    gaps: { G_CA: 10, G_AU: 5, G_UE: 3, G_EO: 1 },
    diagnosticType: 'A',
    capitalScores,
  });
  assert.equal(candidates.length, 8);
  // شدت باید متفاوت باشد (دیگر 0.5 ثابت نیست)
  const severities = new Set(candidates.map(c => c.severity));
  assert.ok(severities.size > 3, `severities should differ, got ${[...severities].join(',')}`);
  // سرمایه G قوی → شدت صفر و فیلتر عدم‌مداخله
  const gCandidate = candidates.find(c => c.targetCapital === 'G');
  assert.ok(gCandidate);
  assert.equal(gCandidate.severity, 0);
  assert.ok(gCandidate.excluded, 'strong capital with no gap must be excluded');
  assert.equal(gCandidate.excluded?.code, 'NO_MEANINGFUL_GAP');
  // ضعیف‌ترین سرمایه‌ها نباید حذف شوند
  const pCandidate = candidates.find(c => c.targetCapital === 'P');
  assert.ok(pCandidate);
  assert.equal(pCandidate.excluded, null);
  // اولویت تعدیل‌شده = اولویت × عدالت
  for (const c of candidates) {
    assert.ok(Math.abs(c.priorityEquityAdjusted! - c.priorityScore! * c.equity) < 0.01);
  }
  // سالم + بحرانی دیگر → جابه‌جایی مسئله
  const candidates2 = generateInterventionCandidates({
    gaps: { G_CA: 0, G_AU: 0, G_UE: 0, G_EO: 0 },
    diagnosticType: 'B',
    capitalScores: { H: 85, S: 80, E: 82, P: 88, N: 78, C: 80, G: 90, R: 15 } as Record<CapitalKey, number>,
  });
  const hCandidate = candidates2.find(c => c.targetCapital === 'H');
  assert.ok(hCandidate?.excluded);
  assert.equal(hCandidate.excluded.code, 'EQUITY_HARM_RISK');
});

test('equity gaps boost the equity factor for affected capitals', () => {
  const equityGaps: JusticeGap[] = [
    { indicatorCode: 'P4', bestGroup: 'متمکن', worstGroup: 'محروم', gap: 30, verdict: 'critical' },
  ];
  const capitalIndicatorCodes = new Map<CapitalKey, string[]>([['P', ['P1', 'P2', 'P3', 'P4', 'P5']]]);
  const candidates = generateInterventionCandidates({
    gaps: { G_CA: 12, G_AU: 4, G_UE: 2, G_EO: 0 },
    diagnosticType: 'A',
    capitalScores: { H: 50, S: 50, E: 50, P: 45, N: 50, C: 50, G: 50, R: 50 } as Record<CapitalKey, number>,
    equityGaps,
    capitalIndicatorCodes,
  });
  const p = candidates.find(c => c.targetCapital === 'P');
  const h = candidates.find(c => c.targetCapital === 'H');
  assert.equal(p?.equity, 1.0);
  assert.equal(h?.equity, 0.8);
});

// ─── نقشه اهرم ────────────────────────────────────────────────
test('lever map ranks governance and network as strongest multipliers', () => {
  const capitalScores = { H: 50, S: 50, E: 50, P: 50, N: 50, C: 50, G: 85, R: 55 } as Record<CapitalKey, number>;
  const chainScores = Object.fromEntries(
    ALL_CAPITALS.map(cap => [cap, uniformChain(capitalScores[cap])]),
  ) as Record<CapitalKey, ChainStageScore[]>;
  const levers = buildLeverMap(capitalScores, chainScores);
  assert.equal(levers.length, 8);
  assert.equal(levers[0].capitalKey, 'G'); // بیشترین اثر منتشرشده
  assert.ok(levers[0].affectedCapitals.length >= 5);
});

test('intervention mapping returns family for type B (trapped capital)', () => {
  const families = mapDiagnosisToIntervention(
    { G_CA: 0, G_AU: 0, G_UE: 0, G_EO: 0 },
    'B',
    { H: 50, S: 50, E: 50, P: 50, N: 50, C: 50, G: 50, R: 50 },
  );
  assert.ok(families.some(f => f.includes('شبکه‌سازی')));
});

// ─── گلوگاه با تفکیک ۵ بعدی ───────────────────────────────────
test('bottleneck uses group disaggregation when provided', () => {
  const chainScores = Object.fromEntries(
    ALL_CAPITALS.map(cap => [cap, uniformChain(60, 12)]),
  ) as Record<CapitalKey, ChainStageScore[]>;
  const groupSlices: GroupSlice[] = [
    { group: 'متمکن', scores: { H1: 80, P4: 85, S1: 75 } },
    { group: 'محروم', scores: { H1: 40, P4: 38, S1: 50 } },
  ];
  const { bottleneck, diagnosis } = locateBottleneck({
    allChainScores: chainScores,
    equityData: [],
    groupSlices,
  });
  assert.equal(bottleneck.group, 'محروم');
  assert.equal(bottleneck.disaggregation, 'measured');
  assert.ok(diagnosis.includes('محروم'));
});

test('bottleneck detects spatial concentration in a sub-location', () => {
  const chainScores = Object.fromEntries(
    ALL_CAPITALS.map(cap => [cap, uniformChain(60, 12)]),
  ) as Record<CapitalKey, ChainStageScore[]>;
  const { bottleneck } = locateBottleneck({
    allChainScores: chainScores,
    equityData: [],
    subLocationScores: {
      'بلوک شمالی': { P4: 75, N1: 70, P5: 80 },
      'بلوک جنوبی': { P4: 40, N1: 35, P5: 42 },
    },
  });
  assert.equal(bottleneck.location, 'بلوک جنوبی');
});

test('bottleneck reports worsening temporal trend', () => {
  const chainScores = Object.fromEntries(
    ALL_CAPITALS.map(cap => [cap, uniformChain(60, 12)]),
  ) as Record<CapitalKey, ChainStageScore[]>;
  const current = { H1: 55, S1: 50, P4: 45 };
  const previous = { H1: 65, S1: 62, P4: 58 };
  const { bottleneck } = locateBottleneck({
    allChainScores: chainScores,
    equityData: [],
    previousPeriodScores: previous,
    currentPeriodScores: current,
  });
  assert.equal(bottleneck.time, 'در حال تشدید نسبت به دوره قبل');
});

test('computeChainGaps computes the four transitions', () => {
  const scores = uniformChain(80, 10);
  const gaps = computeChainGaps(scores);
  assert.equal(gaps.G_CA, 10);
  assert.equal(gaps.G_AU, 10);
  assert.equal(gaps.G_UE, 10);
  assert.equal(gaps.G_EO, 10);
});

// ─── حافظه زنده ───────────────────────────────────────────────
test('living memory records, supersedes and filters rules', () => {
  const store = createLivingMemory();
  const entry = addEntry(store, {
    capitalKey: 'G',
    trigger: 'آزمایش پارک محلی',
    outcome: 'failure',
    rule: 'هیچ فضای عمومی جدیدی بدون برنامه نگهداری تصویب نشود',
    evidence: 'پارک بدون نگهداری متروکه شد',
  });
  assert.ok(entry.id);
  assert.equal(getActiveRules(store).length, 1);
  supersedeRule(store, entry.id, 'فضای عمومی فقط با بودجه نگهداری مصوب تصویب شود');
  assert.equal(getActiveRules(store).length, 1);
  assert.ok(getActiveRules(store)[0].rule.includes('بودجه نگهداری'));
  assert.ok(getActiveRules(store)[0].supersededBy === undefined);
});

// ─── چرخه آزمایش ──────────────────────────────────────────────
test('experiment cycle decides scale/stop and converts to memory', () => {
  const exp = createExperiment('پارک جدید استفاده را افزایش می‌دهد', 'N', { N1: 40 });
  assert.equal(exp.status, 'planned');
  const scaled = decideOutcome({ ...exp, status: 'completed', outcomes: { use: 25 } });
  assert.equal(scaled.decision, 'scale');
  assert.equal(experimentToMemory(scaled)?.outcome, 'success');
  const stopped = decideOutcome({ ...exp, status: 'completed', outcomes: { equity: -5 } });
  assert.equal(stopped.decision, 'stop');
  assert.equal(experimentToMemory(stopped)?.outcome, 'failure');
});

// ─── موتور یادگیری S-I-F-A-M ─────────────────────────────────
test('learning gate locks when one capability is critical', () => {
  const locked = computeLearningScore('G', {
    sensing: 0.9, interpretation: 0.8, feedback: 0.1, adaptation: 0.8, memory: 0.9,
  });
  assert.equal(locked.gate, 'locked');
  assert.equal(locked.weakestCapability, 'بازخورد');
  const disrupted = computeLearningScore('G', {
    sensing: 0.1, interpretation: 0.8, feedback: 0.1, adaptation: 0.8, memory: 0.9,
  });
  assert.equal(disrupted.gate, 'disrupted');
});

test('dynamic resilience flags slow learning', () => {
  const slow = dynamicResilience(0.5, 1);
  assert.equal(slow.healthy, false);
  assert.ok(slow.message.includes('عقب می‌ماند'));
  const balanced = dynamicResilience(1.2, 1);
  assert.equal(balanced.healthy, true);
});

test('problem solving imbalance accumulates unsolved problems', () => {
  const result = problemSolvingImbalance(10, 7);
  assert.equal(result.imbalance, 3);
  assert.ok(result.status.includes('انباشته'));
});

// ─── Q/T/R ────────────────────────────────────────────────────
test('quality triad stays within 0..100 bounds', () => {
  const capitalScores = { H: 90, S: 90, E: 90, P: 90, N: 90, C: 90, G: 90, R: 90 } as Record<CapitalKey, number>;
  const chainAvg = { CAPACITY: 90, ACCESS: 90, USE: 90, EXPERIENCE: 90, OUTCOME: 90 };
  const triad = computeQualityTriad(capitalScores, chainAvg);
  for (const v of [triad.Q, triad.T, triad.R]) {
    assert.ok(v >= 0 && v <= 100, `value ${v} out of bounds`);
  }
  assert.ok(triad.Q <= 90 + 0.1);
});

// ─── نگاشت شکاف به خانواده مداخله ────────────────────────────
test('access-use gap maps to friction family', () => {
  const gaps: ChainGaps = { G_CA: 2, G_AU: 20, G_UE: 2, G_EO: 1 };
  const families = mapDiagnosisToIntervention(gaps, 'E', { H: 50, S: 50, E: 50, P: 50, N: 50, C: 50, G: 50, R: 50 });
  assert.ok(families.some(f => f.includes('اصطکاک') || f.includes('نگهداری')));
});
