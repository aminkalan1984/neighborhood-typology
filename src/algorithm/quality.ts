// ============================================================
// کنترل کیفیت ارزیابی (بخش ۵.۵): خطای هاله، مرکزگرایی،
// سوگیری تأییدی + استخراج «ظرفیت‌های پنهان» (ضد سوگیری)
// ============================================================
import type { LayerKey } from './types';

export interface QcZoneReport {
  zoneId: string;
  flags: string[];
  hiddenCapacities: string[];
}

export interface QcGlobalReport {
  zoneReports: QcZoneReport[];
  warnings: string[];
  centralTendency: boolean;
  haloRiskZones: string[];
}

/**
 * کنترل‌های کیفیت روی نتایج پهنه‌ها:
 * 1) هاله: فقر کالبدی شدید نباید نمرهٔ هنجاری را پایین بکشد —
 *    اگر P کم و N کم هم‌زمان باشند، همبستگی مشکوک گزارش می‌شود.
 * 2) مرکزگرایی: تجمع نمرهٔ ۳ (همهٔ لایه‌ها در بازهٔ باریک وسط) → هشدار.
 * 3) سوگیری تأییدی: هر پهنه باید حداقل ۳ «ظرفیت پنهان» ثبت کند.
 */
export function runQualityChecks(
  zones: Array<{
    zoneId: string;
    scores: Record<LayerKey, number>;
    scaled: Record<string, number>;
    indicatorNames: (code: string) => string | undefined;
  }>,
): QcGlobalReport {
  const zoneReports: QcZoneReport[] = [];
  const warnings: string[] = [];
  const haloRiskZones: string[] = [];
  let centralCount = 0;

  for (const z of zones) {
    const flags: string[] = [];
    const P = z.scores.P ?? NaN;
    const B = z.scores.B ?? NaN;
    const N = z.scores.N ?? NaN;

    // ۱) خطر هاله: P پایین همزمان با N پایین
    if (Number.isFinite(P) && Number.isFinite(N) && P < 2.5 && N < 2.5) {
      flags.push('halo: فقر کالبدی و هنجاری هم‌زمان — بررسی استقلال نمرات لایه‌ها الزامی است');
      haloRiskZones.push(z.zoneId);
    }

    // ۲) مرکزگرایی: همهٔ لایه‌ها در بازهٔ [2.7, 3.3]
    if (
      Number.isFinite(P) && Number.isFinite(B) && Number.isFinite(N) &&
      P >= 2.7 && P <= 3.3 && B >= 2.7 && B <= 3.3 && N >= 2.7 && N <= 3.3
    ) {
      centralCount++;
      flags.push('central-tendency: همهٔ لایه‌ها نمرهٔ میانی — ثبت شاهد برای نمرهٔ ۳ الزامی است');
    }

    // ۳) ظرفیت‌های پنهان (ضد سوگیری تأییدی): حداقل ۳ قوت مستقل از محرومیت
    const strengths = Object.entries(z.scaled)
      .filter(([, s]) => s != null && Number.isFinite(s) && s >= 4)
      .map(([code]) => z.indicatorNames(code) ?? code);

    const hiddenCapacities = [...new Set(strengths)].slice(0, 5);
    if (hiddenCapacities.length < 3) {
      flags.push('confirmation-bias: کمتر از ۳ ظرفیت پنهان ثبت شده — محرومیت پیش‌فرض نشود');
    }

    zoneReports.push({ zoneId: z.zoneId, flags, hiddenCapacities });
  }

  const centralTendency = centralCount >= Math.max(3, zones.length * 0.3);
  if (centralTendency) {
    warnings.push(`خطای مرکزگرایی: ${centralCount} پهنه همهٔ لایه‌هایشان نمرهٔ میانی دارند — نیاز به کالیبراسیون میدانی.`);
  }
  if (haloRiskZones.length > 0) {
    warnings.push(`خطر خطای هاله در ${haloRiskZones.length} پهنه — مستندسازی مجزای هر لایه الزامی است.`);
  }

  return { zoneReports, warnings, centralTendency, haloRiskZones };
}
