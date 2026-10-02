// ============================================================
// جای‌گذاری پاپ‌آپ توضیح هوش مصنوعی (حکیم)
// منطقِ خالص و بدون وابستگی تا قابل آزمون باشد:
//  - اولویت با «قابل‌مشاهده‌ترین فضای میانی صفحه» (مرکز viewport)
//  - اگر مرکز روی بخشِ موردِ توضیح بیفتد، به آزادترین سمتِ آن بخش
//    منتقل می‌شود تا منشأ توضیح همیشه در دید کاربر بماند
//  - همیشه کاملاً داخل viewport (هرگز ناقص/بریده نمایش داده نشود)
// ============================================================

export const POPUP_PAD = 12; // فاصلهٔ ایمن از لبه‌های viewport
export const TARGET_GAP = 16; // فاصلهٔ پاپ‌آپ از بخشِ در حال توضیح
export const MIN_VERTICAL_ROOM = 200; // کمترین فضای عمودی برای چیدمان زیر/بالای منشأ

export interface Placement {
  left: number;
  top: number;
  /** وقتی true یعنی هیچ گزینهٔ کامل‌اندازه‌ای نبود و مرکزِ کلَمپ‌شده استفاده شد */
  fallback: boolean;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectsIntersect(a: Rect, b: Rect, gap: number): boolean {
  return !(a.right + gap < b.left || a.left - gap > b.right || a.bottom + gap < b.top || a.top - gap > b.bottom);
}

function placementScore(left: number, top: number, w: number, h: number, vw: number, vh: number, vertical: boolean): number {
  const pcx = left + w / 2;
  const pcy = top + h / 2;
  const d = Math.hypot(pcx - vw / 2, pcy - vh / 2);
  // ترجیح ملایم چیدمان عمودی (زیر/بالای بخش مرجع): منشأ و توضیح در یک ستون می‌مانند
  return d - (vertical ? 48 : 0);
}

function clampToViewport(v: number, size: number, viewport: number, pad: number): number {
  return Math.min(Math.max(v, pad), Math.max(pad, viewport - size - pad));
}

export function computePlacement(
  target: DOMRect | null,
  w: number,
  h: number,
  vw: number,
  vh: number,
): Placement {
  const pad = POPUP_PAD;
  const centerLeft = clampToViewport((vw - w) / 2, w, vw, pad);
  const centerTop = clampToViewport((vh - h) / 2, h, vh, pad);

  const fits =
    target == null ||
    !rectsIntersect(
      { left: centerLeft, top: centerTop, right: centerLeft + w, bottom: centerTop + h },
      { left: target.left, top: target.top, right: target.right, bottom: target.bottom },
      TARGET_GAP,
    );
  if (fits) return { left: centerLeft, top: centerTop, fallback: false }; // فضای میانی آزاد است

  const cy = clampToViewport((vh - h) / 2, h, vh, pad);
  const candidates: Array<{ left: number; top: number; score: number }> = [];

  // زیرِ بخش مرجع (هم‌راستا با مرکز افقی صفحه)
  if (target.bottom + TARGET_GAP + h <= vh - pad) {
    const left = clampToViewport((vw - w) / 2, w, vw, pad);
    const top = target.bottom + TARGET_GAP;
    candidates.push({ left, top, score: placementScore(left, top, w, h, vw, vh, true) });
  }
  // بالایِ بخش مرجع
  if (target.top - TARGET_GAP - h >= pad) {
    const left = clampToViewport((vw - w) / 2, w, vw, pad);
    const top = target.top - TARGET_GAP - h;
    candidates.push({ left, top, score: placementScore(left, top, w, h, vw, vh, true) });
  }
  // سمت راستِ بخش مرجع (عمودی وسط‌چین)
  if (target.right + TARGET_GAP + w <= vw - pad) {
    const left = target.right + TARGET_GAP;
    const top = cy;
    candidates.push({ left, top, score: placementScore(left, top, w, h, vw, vh, false) });
  }
  // سمت چپِ بخش مرجع
  if (target.left - TARGET_GAP - w >= pad) {
    const left = target.left - TARGET_GAP - w;
    const top = cy;
    candidates.push({ left, top, score: placementScore(left, top, w, h, vw, vh, false) });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    return { left: candidates[0].left, top: candidates[0].top, fallback: false };
  }

  // هیچ فضای کامل‌اندازه‌ای نبود → مرکز + کلَمپ (تنها وقتی رخ می‌دهد که
  // ارتفاع پاپ‌آپ بیش از هر فضای آزاد باشد؛ لایهٔ بالاتر آن را کوچک می‌کند)
  return { left: centerLeft, top: centerTop, fallback: true };
}

/** بزرگ‌ترین فضای عمودی آزاد زیر/بالای بخش مرجع (بدون احتساب حاشیه‌ها) */
export function bestVerticalRoom(target: DOMRect, vh: number): number {
  const below = vh - POPUP_PAD - (target.bottom + TARGET_GAP);
  const above = target.top - TARGET_GAP - POPUP_PAD;
  return Math.max(below, above);
}
