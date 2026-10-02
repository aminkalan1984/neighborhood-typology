// ============================================================
// وزن‌دهی (بخش ۶ سند): آنتروپی شانون (عینی) + AHP (قضاوت خبره)
// + وزن ترکیبی و ضریب اعتمادپذیری (بخش ۶.۴)
// ============================================================

/** ۱) وزن‌های عینی بر پایهٔ آنتروپی شانون — ورودی ماتریس نرمال‌شده m×n */
export function shannonEntropyWeights(R: number[][]): number[] {
  const m = R.length;
  const n = R[0]?.length ?? 0;
  if (m === 0 || n === 0) return [];
  const k = 1 / Math.log(m);

  const weights: number[] = [];
  for (let j = 0; j < n; j++) {
    // 1) نرمال‌سازی احتمالی
    const colSum = R.reduce((s, row) => s + (Number.isFinite(row[j]) ? row[j] : 0), 0);
    const p = R.map((row) => (Number.isFinite(row[j]) && colSum > 0 ? row[j] / colSum : 0));
    // 2) آنتروپی
    let E = 0;
    for (const pi of p) {
      if (pi > 0) E += pi * Math.log(pi); // حد p·ln p → 0 برای p=0
    }
    E = -k * E;
    // 3) درجه تنوع
    weights.push(1 - E);
  }
  // 4) نرمال‌سازی
  const sum = weights.reduce((a, b) => a + b, 0);
  return sum > 0 ? weights.map((w) => w / sum) : weights.map(() => 1 / n);
}

/** جداول RI ساعتی برای n≤10 */
const RI: number[] = [0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

/**
 * ۲) AHP — بردار ویژه نرمال‌شدهٔ متناظر با λ_max (روش توان)
 * ورودی: ماتریس مقایسه زوجی n×n (مقیاس ساعتی ۱..۹)
 * خروجی: { weights, lambdaMax, ci, cr }
 */
export function ahpWeights(pairwise: number[][]): {
  weights: number[];
  lambdaMax: number;
  ci: number;
  cr: number;
} {
  const n = pairwise.length;
  if (n === 0) return { weights: [], lambdaMax: 0, ci: 0, cr: 0 };

  // بردار ویژه غالب با تکرار توان (۵۰ تکرار)
  let v = Array.from({ length: n }, () => 1);
  for (let iter = 0; iter < 100; iter++) {
    const w = Array.from({ length: n }, (_, i) =>
      pairwise[i].reduce((s, aij, j) => s + aij * v[j], 0),
    );
    const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
    v = w.map((x) => x / norm);
  }
  const weights = v.map((x) => Math.abs(x));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const wNorm = weights.map((x) => x / wSum);

  // λ_max = میانگین (A·w)/w
  const Aw = Array.from({ length: n }, (_, i) =>
    pairwise[i].reduce((s, aij, j) => s + aij * wNorm[j], 0),
  );
  const lambdaMax = Aw.reduce((s, aw, i) => s + aw / wNorm[i], 0) / n;

  const ci = (lambdaMax - n) / (n - 1);
  const cr = n > 2 ? ci / (RI[n - 1] ?? 1) : 0;

  return { weights: wNorm, lambdaMax, ci, cr };
}

/**
 * ۳) وزن ترکیبی (بخش ۶.۳ + ۶.۴)
 * w_final_i = (α·w_entropy_i + (1−α)·w_ahp_i) × (reliability_i / 5)
 * سپس بازنرمال‌سازی.
 */
export function combineWeights(
  wEntropy: number[],
  wAhp: number[],
  reliability: number[],
  alpha = 0.5,
): number[] {
  const n = Math.min(wEntropy.length, wAhp.length, reliability.length);
  if (n === 0) return [];
  const raw = Array.from({ length: n }, (_, i) => {
    const blended = alpha * wEntropy[i] + (1 - alpha) * wAhp[i];
    return blended * (reliability[i] / 5);
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return sum > 0 ? raw.map((w) => w / sum) : raw.map(() => 1 / n);
}

/** ماتریس مقایسه زوجی پیش‌فرض بین لایه‌ها (اولویت هنجاری — بخش ۶.۳) */
export const LAYER_PAIRWISE: number[][] = [
  [1, 1 / 2, 1 / 3],
  [2, 1, 1 / 2],
  [3, 2, 1],
];

/** وزن‌های AHP لایه‌ها (برای اولویت‌بندی بودجه، نه SI) */
export function layerAhp(): { weights: number[]; lambdaMax: number; ci: number; cr: number } {
  return ahpWeights(LAYER_PAIRWISE);
}
