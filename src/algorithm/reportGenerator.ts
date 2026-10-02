// ============================================================
// تولید گزارش PDF از نتایج تحلیل محله
// ============================================================
import type { DecisionCard } from './types';
import { CAPITAL_FA, CHAIN_FA, BAND_CONFIG } from './types';
import { scoreToBand } from './statusBands';

/**
 * تولید محتوای گزارش متنی از کارت تصمیم
 */
export function generateReportText(card: DecisionCard): string {
  const lines: string[] = [];
  const sep = '═'.repeat(60);
  const thin = '─'.repeat(60);

  lines.push(sep);
  lines.push(`  گزارش تحلیل محله: ${card.neighborhoodName}`);
  lines.push(`  تاریخ: ${new Date(card.assessmentDate).toLocaleDateString('fa-IR')}`);
  lines.push(sep);
  lines.push('');

  // Q T R
  lines.push('┌─ سه‌گانه کیفیت ─────────────────────────────┐');
  const qBand = BAND_CONFIG[scoreToBand(card.qualityVerdict.Q)];
  const tBand = BAND_CONFIG[scoreToBand(card.qualityVerdict.T)];
  const rBand = BAND_CONFIG[scoreToBand(card.qualityVerdict.R)];
  lines.push(`│  Q (کیفیت محقق‌شده):  ${card.qualityVerdict.Q.toFixed(1).padStart(5)}  ${qBand.label}`);
  lines.push(`│  T (توان تبدیل):      ${card.qualityVerdict.T.toFixed(1).padStart(5)}  ${tBand.label}`);
  lines.push(`│  R (توان بازتولید):    ${card.qualityVerdict.R.toFixed(1).padStart(5)}  ${rBand.label}`);
  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');

  // Diagnostic type
  lines.push(`تیپ تشخیصی: ${card.diagnosticType}`);
  lines.push(thin);

  // Capital scores
  lines.push('');
  lines.push('┌─ امتیاز هشت سرمایه ─────────────────────────┐');
  for (const cs of card.capitalScores) {
    const band = BAND_CONFIG[cs.band];
    const bar = '█'.repeat(Math.round(cs.score / 10)) + '░'.repeat(10 - Math.round(cs.score / 10));
    lines.push(`│  ${CAPITAL_FA[cs.capitalKey].padEnd(16)} ${bar} ${cs.score.toFixed(1).padStart(5)}  ${band.label}`);
  }
  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');

  // Bottleneck
  lines.push('┌─ گلوگاه اصلی ───────────────────────────────┐');
  lines.push(`│  سرمایه: ${CAPITAL_FA[card.bottleneck.capital]}`);
  lines.push(`│  گذار: ${CHAIN_FA[card.bottleneck.transition[0]]} → ${CHAIN_FA[card.bottleneck.transition[1]]}`);
  lines.push(`│  مکان: ${card.bottleneck.location}`);
  lines.push(`│  گروه: ${card.bottleneck.group}`);
  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');

  // Hypotheses
  lines.push('┌─ فرضیه‌های علّی ─────────────────────────────┐');
  card.hypotheses.slice(0, 5).forEach((h, i) => {
    lines.push(`│  ${i + 1}. [${h.evidenceStatus}] ${h.hypothesis}`);
    if (h.causalChain.length > 0) {
      lines.push(`│     زنجیره: ${h.causalChain.join(' → ')}`);
    }
  });
  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');

  // Interventions
  lines.push('┌─ سبد مداخله ─────────────────────────────────┐');
  card.interventions.slice(0, 5).forEach((int, i) => {
    lines.push(`│  ${i + 1}. ${int.name}`);
    lines.push(`│     شدت: ${int.severity.toFixed(0)} | جمعیت: ${int.population.toFixed(0)} | اهرم: ${int.leverage.toFixed(0)}`);
  });
  lines.push('└──────────────────────────────────────────────┘');
  lines.push('');

  // Final statement
  lines.push(thin);
  lines.push('');
  lines.push('判决 نهایی:');
  lines.push(card.finalStatement.replace(/\*\*/g, ''));
  lines.push('');
  lines.push(sep);
  lines.push('  تولید شده توسط سیستم تصمیم‌یار جامع محله — آرا');
  lines.push(sep);

  return lines.join('\n');
}

/**
 * دانلود گزارش به صورت فایل متنی
 */
export function downloadReport(card: DecisionCard, filename?: string): void {
  const text = generateReportText(card);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `report-${card.neighborhoodName.replace(/[^\u0600-\u06FF\w]/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * تولید JSON کامل گزارش
 */
export function generateReportJSON(card: DecisionCard): Record<string, unknown> {
  return {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    neighborhood: card.neighborhoodName,
    assessmentDate: card.assessmentDate,
    qualityTriad: {
      Q: card.qualityVerdict.Q,
      T: card.qualityVerdict.T,
      R: card.qualityVerdict.R,
      QBand: BAND_CONFIG[scoreToBand(card.qualityVerdict.Q)].label,
      TBand: BAND_CONFIG[scoreToBand(card.qualityVerdict.T)].label,
      RBand: BAND_CONFIG[scoreToBand(card.qualityVerdict.R)].label,
    },
    diagnosticType: card.diagnosticType,
    capitalScores: card.capitalScores.map(cs => ({
      capital: CAPITAL_FA[cs.capitalKey],
      code: cs.capitalKey,
      score: cs.score,
      band: BAND_CONFIG[cs.band].label,
    })),
    bottleneck: {
      capital: CAPITAL_FA[card.bottleneck.capital],
      transition: `${CHAIN_FA[card.bottleneck.transition[0]]} → ${CHAIN_FA[card.bottleneck.transition[1]]}`,
      location: card.bottleneck.location,
      group: card.bottleneck.group,
    },
    hypotheses: card.hypotheses.map(h => ({
      hypothesis: h.hypothesis,
      type: h.frictionType,
      evidenceStatus: h.evidenceStatus,
      causalChain: h.causalChain,
    })),
    interventions: card.interventions.map(int => ({
      name: int.name,
      severity: int.severity,
      population: int.population,
      leverage: int.leverage,
      feasibility: int.feasibility,
    })),
    finalStatement: card.finalStatement.replace(/\*\*/g, ''),
  };
}

/**
 * دانلود گزارش JSON
 */
export function downloadReportJSON(card: DecisionCard, filename?: string): void {
  const data = generateReportJSON(card);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `report-${card.neighborhoodName.replace(/[^\u0600-\u06FF\w]/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
