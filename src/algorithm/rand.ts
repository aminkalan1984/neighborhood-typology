// ============================================================
// ابزارهای تصادفی قطعی (همان ورودی → همان خروجی)
// برای بازگشت نرم و برآوردهای پراکسی پایدار در لایهٔ استخراج داده
// ============================================================

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** rng قطعی از یک رشته — چند نمونهٔ مستقل با salt متفاوت */
export function seededRng(seed: string): () => number {
  return mulberry32(hashString(seed));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
