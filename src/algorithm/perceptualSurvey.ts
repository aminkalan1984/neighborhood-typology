// ============================================================
// پیمایش ادراکی ۱۵ سؤالی با منطق پرش (بخش ۴ الگوریتم)
// ============================================================
import type { ChainStage } from './types';

export interface SurveyQuestion {
  id: string;
  chainStage: ChainStage;
  text: string;
  direction: 'asc' | 'desc';
  isCore: boolean;
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 'C1', chainStage: 'CAPACITY', text: 'محله از نظر فضای سبز و درختان غنی است', direction: 'asc', isCore: true },
  { id: 'C2', chainStage: 'CAPACITY', text: 'کیفیت هوا در بیشتر روزها قابل قبول است', direction: 'asc', isCore: true },
  { id: 'C3', chainStage: 'CAPACITY', text: 'آلودگی صوتی محله آزاردهنده است', direction: 'desc', isCore: true },
  { id: 'A1', chainStage: 'ACCESS', text: 'دسترسی به حمل‌ونقل عمومی از خانه آسان است', direction: 'asc', isCore: true },
  { id: 'A2', chainStage: 'ACCESS', text: 'دسترسی به خدمات روزمره آسان است', direction: 'asc', isCore: true },
  { id: 'A3', chainStage: 'ACCESS', text: 'مسیرهای پیاده به هم متصل و جابه‌جایی آسان است', direction: 'asc', isCore: true },
  { id: 'U1', chainStage: 'USE', text: 'پیاده‌روها هموار، پیوسته و بدون مانع‌اند', direction: 'asc', isCore: true },
  { id: 'U2', chainStage: 'USE', text: 'روشنایی معابر در شب کافی است', direction: 'asc', isCore: true },
  { id: 'U3', chainStage: 'USE', text: 'پارک‌ها و فضاهای سبز امن، تمیز، فعال و قابل استفاده‌اند', direction: 'asc', isCore: true },
  { id: 'E1', chainStage: 'EXPERIENCE', text: 'در طول روز در محله احساس امنیت می‌کنم', direction: 'asc', isCore: true },
  { id: 'E2', chainStage: 'EXPERIENCE', text: 'به محله خود تعلق دارم', direction: 'asc', isCore: true },
  { id: 'E3', chainStage: 'EXPERIENCE', text: 'به همسایگان اعتماد دارم', direction: 'asc', isCore: true },
  { id: 'O1', chainStage: 'OUTCOME', text: 'از زندگی در این محله راضی هستم', direction: 'asc', isCore: true },
  { id: 'O2', chainStage: 'OUTCOME', text: 'در یک ماه گذشته احساس تنهایی داشته‌ام', direction: 'desc', isCore: false },
  { id: 'O3', chainStage: 'OUTCOME', text: 'اگر شرایط مالی اجازه دهد، مایل به ادامه سکونت هستم', direction: 'asc', isCore: true },
];

// ─── منطق پرش تشخیصی ────────────────────────────────────────
export interface SkipTrigger {
  questionId: string;
  threshold: number;
  operator: 'le' | 'ge';
  followUp: string;
}

export const SKIP_LOGIC: SkipTrigger[] = [
  { questionId: 'E1', threshold: 2, operator: 'le', followUp: 'چه عامل یا مکانی احساس ناامنی ایجاد می‌کند؟' },
  { questionId: 'U3', threshold: 2, operator: 'le', followUp: 'مشکل اصلی نگهداری، امنیت، امکانات یا دسترسی است؟' },
  { questionId: 'U2', threshold: 2, operator: 'le', followUp: 'کدام معبر یا فضا بیشترین مشکل روشنایی را دارد؟' },
  { questionId: 'A1', threshold: 2, operator: 'le', followUp: 'کدام وسیله در دسترس نیست یا کیفیت نامناسب دارد؟' },
  { questionId: 'C3', threshold: 4, operator: 'ge', followUp: 'منبع اصلی ترافیک، ساخت‌وساز، همسایگی یا اصناف است؟' },
  { questionId: 'O3', threshold: 2, operator: 'le', followUp: 'دلیل اصلی تمایل به جابه‌جایی چیست؟' },
  { questionId: 'O2', threshold: 4, operator: 'ge', followUp: 'علت بیشتر شخصی است یا ناشی از فقدان تعاملات محله‌ای؟' },
];

export interface SurveyResponse {
  questionId: string;
  value: number; // 1-5 Likert
  triggeredFollowUp?: string;
  followUpAnswer?: string;
}

/**
 * پردازش پاسخ‌ها و تولید امتیاز زنجیره
 */
export function processSurvey(responses: SurveyResponse[]): Record<ChainStage, number> {
  const stageScores: Record<ChainStage, number[]> = {
    CAPACITY: [], ACCESS: [], USE: [], EXPERIENCE: [], OUTCOME: [],
  };

  for (const q of SURVEY_QUESTIONS) {
    const resp = responses.find(r => r.questionId === q.id);
    if (!resp) continue;

    let normalizedValue = resp.value;
    // برای سؤالات معکوس: تبدیل ۱→۵, ۲→۴, ...
    if (q.direction === 'desc') {
      normalizedValue = 6 - resp.value;
    }
    stageScores[q.chainStage].push(normalizedValue);
  }

  // تبدیل مقیاس ۱-۵ به ۰-۱۰۰
  const result: Record<ChainStage, number> = {
    CAPACITY: 0, ACCESS: 0, USE: 0, EXPERIENCE: 0, OUTCOME: 0,
  };
  for (const stage of Object.keys(stageScores) as ChainStage[]) {
    const scores = stageScores[stage];
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    result[stage] = Math.round(((avg - 1) / 4) * 100 * 10) / 10; // 1-5 → 0-100
  }
  return result;
}

/**
 * بررسی نیاز به فعال‌سازی منطق پرش
 */
export function checkSkipTriggers(responses: SurveyResponse[]): SkipTrigger[] {
  const active: SkipTrigger[] = [];
  for (const trigger of SKIP_LOGIC) {
    const resp = responses.find(r => r.questionId === trigger.questionId);
    if (!resp) continue;
    if (trigger.operator === 'le' && resp.value <= trigger.threshold) active.push(trigger);
    if (trigger.operator === 'ge' && resp.value >= trigger.threshold) active.push(trigger);
  }
  return active;
}
