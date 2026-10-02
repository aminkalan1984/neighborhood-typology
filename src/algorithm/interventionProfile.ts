// ============================================================
// شناسنامه اجباری هر اقدام (بخش ۹.۵ الگوریتم)
// ============================================================
import type { CapitalKey, ChainStage, CausalHypothesis } from './types';

export interface InterventionProfile {
  id: string;
  // 1. مسئله و گلوگاه هدف
  targetProblem: string;
  // 2. سرمایه یا رابطه تبدیل هدف
  targetCapital: CapitalKey;
  targetTransition: [ChainStage, ChainStage];
  // 3. مکان و گروه هدف
  targetLocation: string;
  targetGroup: string;
  // 4. فرضیه علّی و مسیر اثر
  causalHypothesis: CausalHypothesis;
  // 5. مسئول، همکاران، اختیار و منابع
  responsible: string;
  collaborators: string[];
  authority: string;
  resources: string;
  // 6. خط پایه، هدف زمانی و شاخص‌های سنجش
  baseline: string[];
  timeTarget: string;
  successIndicators: string[];
  // 7. خروجی، پیامد و اثر بلندمدت
  expectedOutput: string;
  expectedOutcome: string;
  expectedImpact: string;
  // 8. خطرهای ناخواسته و شاخص توقف
  unintendedEffects: string[];
  stopIndicators: string[];
  // 9. قاعده توسعه، اصلاح یا خاتمه
  escalationRule: string;
  // 10. دانش برای حافظه زنده
  knowledgeForMemory: string;
}

export function createInterventionProfile(overrides: Partial<InterventionProfile>): InterventionProfile {
  return {
    id: overrides.id ?? `IP-${Date.now()}`,
    targetProblem: overrides.targetProblem ?? '',
    targetCapital: overrides.targetCapital ?? 'P',
    targetTransition: overrides.targetTransition ?? ['CAPACITY', 'ACCESS'],
    targetLocation: overrides.targetLocation ?? '',
    targetGroup: overrides.targetGroup ?? '',
    causalHypothesis: overrides.causalHypothesis ?? {
      hypothesis: '', frictionType: 'cost', evidenceStatus: 'initial', sources: [], causalChain: [],
    },
    responsible: overrides.responsible ?? '',
    collaborators: overrides.collaborators ?? [],
    authority: overrides.authority ?? '',
    resources: overrides.resources ?? '',
    baseline: overrides.baseline ?? [],
    timeTarget: overrides.timeTarget ?? '',
    successIndicators: overrides.successIndicators ?? [],
    expectedOutput: overrides.expectedOutput ?? '',
    expectedOutcome: overrides.expectedOutcome ?? '',
    expectedImpact: overrides.expectedImpact ?? '',
    unintendedEffects: overrides.unintendedEffects ?? [],
    stopIndicators: overrides.stopIndicators ?? [],
    escalationRule: overrides.escalationRule ?? 'بر اساس نتیجه ارزیابی: توسعه، اصلاح یا خاتمه',
    knowledgeForMemory: overrides.knowledgeForMemory ?? '',
  };
}

export function profileToText(p: InterventionProfile): string {
  return [
    `شناسنامه اقدام: ${p.id}`,
    `۱. مسئله: ${p.targetProblem}`,
    `۲. سرمایه هدف: ${p.targetCapital}, گذار: ${p.targetTransition[0]}→${p.targetTransition[1]}`,
    `۳. مکان: ${p.targetLocation}, گروه: ${p.targetGroup}`,
    `۴. فرضیه: ${p.causalHypothesis.hypothesis} (${p.causalHypothesis.evidenceStatus})`,
    `۵. مسئول: ${p.responsible}, منابع: ${p.resources}`,
    `۶. خط پایه: ${p.baseline.join(', ')}`,
    `۷. خروجی: ${p.expectedOutput}, پیامد: ${p.expectedOutcome}, اثر: ${p.expectedImpact}`,
    `۸. خطر ناخواسته: ${p.unintendedEffects.join(', ')}`,
    `۹. قاعده: ${p.escalationRule}`,
    `۱۰. دانش حافظه: ${p.knowledgeForMemory}`,
  ].join('\n');
}
