// ============================================================
// سرویس کالیبراسیون — مدیریت وزن‌ها و آستانه‌ها
// ============================================================

export interface CalibrationConfig {
  version: string;
  weights: Record<string, number>;
  thresholds: { min: number; max: number }[];
  bandRanges: Record<string, { min: number; max: number }>;
  createdAt: string;
  lastCalibratedAt?: string;
}

const DEFAULT_CONFIG: CalibrationConfig = {
  version: 'v1.0-initial',
  weights: {}, // وزن برابر در نسخه اول
  thresholds: [
    { min: 0, max: 39 },
    { min: 40, max: 59 },
    { min: 60, max: 74 },
    { min: 75, max: 89 },
    { min: 90, max: 100 },
  ],
  bandRanges: {
    CRITICAL: { min: 0, max: 39 },
    WEAK: { min: 40, max: 59 },
    MODERATE: { min: 60, max: 74 },
    GOOD: { min: 75, max: 89 },
    EXCELLENT: { min: 90, max: 100 },
  },
  createdAt: new Date().toISOString(),
};

export class CalibrationService {
  private config: CalibrationConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  getConfig(): CalibrationConfig {
    return { ...this.config };
  }

  updateWeights(weights: Record<string, number>): void {
    this.config.weights = { ...this.config.weights, ...weights };
  }

  sensitivityAnalysis(
    baseScores: Record<string, number>,
    weightVariation: number = 0.1,
  ): Array<{ scenario: string; scores: Record<string, number>; change: number }> {
    const results: Array<{ scenario: string; scores: Record<string, number>; change: number }> = [];
    const keys = Object.keys(baseScores);

    for (const key of keys) {
      // افزایش وزن
      const upScores = { ...baseScores };
      upScores[key] = Math.min(100, baseScores[key] * (1 + weightVariation));
      // کاهش وزن
      const downScores = { ...baseScores };
      downScores[key] = Math.max(0, baseScores[key] * (1 - weightVariation));

      const baseAvg = keys.reduce((s, k) => s + baseScores[k], 0) / keys.length;
      const upAvg = keys.reduce((s, k) => s + upScores[k], 0) / keys.length;

      results.push({
        scenario: `افزایش ${key} به ${weightVariation * 100}%`,
        scores: upScores,
        change: upAvg - baseAvg,
      });
    }

    return results;
  }
}
