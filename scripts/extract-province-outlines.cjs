/**
 * استخراج کانتور مرز استان‌ها از مسیرهای SVG و تبدیل به مختصات جغرافیایی (lat/lng)
 *
 * مراحل:
 *  1) پارس کردن مسیرهای `d` (شامل منحنی‌های بزیه و قوس) به مجموعه نقاط
 *  2) محاسبهٔ مرکز (سنتروئید) مسیر هر استان
 *  3) فیت آفاین (کمترین مربعات) بین سنتروئیدهای SVG و مختصات مراکز استان (پایتخت‌ها)
 *  4) اعمال تبدیل روی همهٔ نقاط + ساده‌سازی Douglas-Peucker
 *  5) تولید فایل src/data/iranProvinceOutlines.ts
 *
 * اجرا: node scripts/extract-province-outlines.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'data', 'iranProvincePaths.ts');
const OUT = path.join(__dirname, '..', 'src', 'data', 'iranProvinceOutlines.ts');
const TOL_DEG = 0.0035; // تلورانس ساده‌سازی (~۴۰۰ متر)

const src = fs.readFileSync(SRC, 'utf8');

// ---------- ۱) استخراج IRAN_PROVINCES (دادهٔ مسیرها) ----------
const provMatch = src.match(/export const IRAN_PROVINCES: IranSVGProvince\[\] = (\[[\s\S]*?\]);\n/);
if (!provMatch) throw new Error('IRAN_PROVINCES not found');
const provinces = eval(provMatch[1]); // eslint-disable-line no-eval

// ---------- ۲) استخراج PROVINCES_DATA (مختصات مراکز استان) ----------
const dataMatch = src.match(/export const PROVINCES_DATA: MapirProvince\[\] = (\[[\s\S]*?\]);/);
if (!dataMatch) throw new Error('PROVINCES_DATA not found');
const provData = eval(dataMatch[1]); // eslint-disable-line no-eval
const byKpi = new Map(provData.map((p) => [p.id, p]));

// ---------- ۳) پارس‌ر مسیر SVG ----------
const NUM = '[+-]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][+-]?\\d+)?';

function tokenize(d) {
  const re = new RegExp(`[MmLlHhVvCcSsQqTtAaZz]|${NUM}`, 'g');
  const tokens = [];
  let m;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

function parsePath(d) {
  const tokens = tokenize(d);
  const pts = [];
  let i = 0;
  let x = 0, y = 0;          // نقطهٔ جاری
  let startX = 0, startY = 0; // شروع زیرمسیر
  let lastCmd = '';
  let ctrlX = 0, ctrlY = 0;   // کنترل‌پوینت آخرین منحنی (برای S/T)

  const num = () => parseFloat(tokens[i++]);
  const isNum = () => i < tokens.length && /^[+-]?\d/.test(tokens[i]);

  // تبدیل مختصات نسبی به مطلق
  const rel = (v, base) => base + v;

  // نمونه‌گیری از منحنی بزیه مکعبی
  function cubic(p0, p1, p2, p3, n = 12) {
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const u = 1 - t;
      const px = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const py = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      pts.push([px, py]);
    }
  }

  // نمونه‌گیری از منحنی بزیه درجهٔ ۲
  function quad(p0, p1, p2, n = 10) {
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const u = 1 - t;
      const px = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      const py = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      pts.push([px, py]);
    }
  }

  // نمونه‌گیری از قوس بیضوی (الگوریتم استاندارد SVG)
  function arc(cx, cy, rx, ry, phi, largeArc, sweep, x2, y2) {
    // تبدیل به پارامتر مرکزی
    const cos = Math.cos(phi), sin = Math.sin(phi);
    const dx = (x - cx) / 2, dy = (y - cy) / 2;
    const x1p = cos * dx + sin * dy;
    const y1p = -sin * dx + cos * dy;
    // اصلاح شعاع‌ها
    let rx2 = Math.abs(rx), ry2 = Math.abs(ry);
    const L = (x1p * x1p) / (rx2 * rx2) + (y1p * y1p) / (ry2 * ry2);
    if (L > 1) {
      const s = Math.sqrt(L);
      rx2 *= s; ry2 *= s;
    }
    const sign = largeArc === sweep ? -1 : 1;
    const num2 = Math.max(0, rx2 * rx2 * ry2 * ry2 - rx2 * rx2 * y1p * y1p - ry2 * ry2 * x1p * x1p);
    const den = rx2 * rx2 * y1p * y1p + ry2 * ry2 * x1p * x1p;
    const coef = sign * Math.sqrt(num2 / den);
    const cxp = coef * ((rx2 * y1p) / ry2);
    const cyp = coef * (-(ry2 * x1p) / rx2);
    const cxx = cos * cxp - sin * cyp;
    const cyy = sin * cxp + cos * cyp;
    const cx0 = cxx + (x + x2) / 2;
    const cy0 = cyy + (y + y2) / 2;

    const ang1 = Math.atan2((y1p - cyp) / ry2, (x1p - cxp) / rx2);
    const ang2 = Math.atan2((-y1p - cyp) / ry2, (-x1p - cxp) / rx2);
    let delta = ang2 - ang1;
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;

    const n = Math.max(6, Math.ceil(Math.abs(delta) / (Math.PI / 24)));
    for (let s = 1; s <= n; s++) {
      const a = ang1 + (delta * s) / n;
      const px = cx0 + rx2 * Math.cos(phi) * Math.cos(a) - ry2 * Math.sin(phi) * Math.sin(a);
      const py = cy0 + rx2 * Math.sin(phi) * Math.cos(a) + ry2 * Math.cos(phi) * Math.sin(a);
      pts.push([px, py]);
    }
  }

  let cmd = '';
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[A-Za-z]$/.test(tok)) {
      cmd = tok;
      i++;
    } else {
      if (cmd === '') break;
      // تکرار ضمنی: دستور قبلی تکرار می‌شود (M→L, m→l)
      if (cmd === 'M') cmd = 'L';
      else if (cmd === 'm') cmd = 'l';
    }
    const abs = cmd === cmd.toUpperCase();

    switch (cmd.toUpperCase()) {
      case 'M': {
        x = abs ? num() : rel(num(), x);
        y = abs ? num() : rel(num(), y);
        startX = x; startY = y;
        pts.push([x, y]);
        break;
      }
      case 'L': {
        x = abs ? num() : rel(num(), x);
        y = abs ? num() : rel(num(), y);
        pts.push([x, y]);
        break;
      }
      case 'H': {
        x = abs ? num() : rel(num(), x);
        pts.push([x, y]);
        break;
      }
      case 'V': {
        y = abs ? num() : rel(num(), y);
        pts.push([x, y]);
        break;
      }
      case 'C': {
        const x1 = abs ? num() : rel(num(), x);
        const y1 = abs ? num() : rel(num(), y);
        const x2 = abs ? num() : rel(num(), x);
        const y2 = abs ? num() : rel(num(), y);
        const x3 = abs ? num() : rel(num(), x);
        const y3 = abs ? num() : rel(num(), y);
        cubic([x, y], [x1, y1], [x2, y2], [x3, y3]);
        ctrlX = x2; ctrlY = y2;
        x = x3; y = y3;
        break;
      }
      case 'S': {
        const x1 = abs ? num() : rel(num(), x);
        const y1 = abs ? num() : rel(num(), y);
        const x2 = abs ? num() : rel(num(), x);
        const y2 = abs ? num() : rel(num(), y);
        const x3 = abs ? num() : rel(num(), x);
        const y3 = abs ? num() : rel(num(), y);
        // بازتاب آخرین کنترل‌پوینت
        const rx1 = 2 * x - ctrlX;
        const ry1 = 2 * y - ctrlY;
        cubic([x, y], [rx1, ry1], [x1, y1], [x2, y2]);
        ctrlX = x1; ctrlY = y1;
        x = x2; y = y2;
        break;
      }
      case 'Q': {
        const x1 = abs ? num() : rel(num(), x);
        const y1 = abs ? num() : rel(num(), y);
        const x2 = abs ? num() : rel(num(), x);
        const y2 = abs ? num() : rel(num(), y);
        quad([x, y], [x1, y1], [x2, y2]);
        ctrlX = x1; ctrlY = y1;
        x = x2; y = y2;
        break;
      }
      case 'T': {
        const x2 = abs ? num() : rel(num(), x);
        const y2 = abs ? num() : rel(num(), y);
        const x1 = 2 * x - ctrlX;
        const y1 = 2 * y - ctrlY;
        quad([x, y], [x1, y1], [x2, y2]);
        ctrlX = x1; ctrlY = y1;
        x = x2; y = y2;
        break;
      }
      case 'A': {
        const rx = abs ? num() : num();
        const ry = abs ? num() : num();
        const phi = (num() * Math.PI) / 180;
        const largeArc = num() !== 0;
        const sweep = num() !== 0;
        const x2 = abs ? num() : rel(num(), x);
        const y2 = abs ? num() : rel(num(), y);
        arc(x, y, rx, ry, phi, largeArc, sweep, x2, y2);
        x = x2; y = y2;
        break;
      }
      case 'Z': {
        pts.push([startX, startY]);
        x = startX; y = startY;
        break;
      }
      default:
        break;
    }
  }
  return pts;
}

// ---------- ۴) سنتروئید (میانگین نقاط) ----------
function centroid(pts) {
  let sx = 0, sy = 0;
  for (const [px, py] of pts) { sx += px; sy += py; }
  return [sx / pts.length, sy / pts.length];
}

// ---------- ۵) فیت آفاین با کمترین مربعات ----------
// lng = a*x + b*y + c ; lat = d*x + e*y + f
function solveAffine(pairs) {
  // A^T A و A^T b برای دو خروجی
  let a11 = 0, a12 = 0, a13 = 0, a22 = 0, a23 = 0, a33 = 0;
  let b1l = 0, b2l = 0, b3l = 0;
  let b1t = 0, b2t = 0, b3t = 0;
  for (const { x, y, lng, lat } of pairs) {
    a11 += x * x; a12 += x * y; a13 += x;
    a22 += y * y; a23 += y; a33 += 1;
    b1l += x * lng; b2l += y * lng; b3l += lng;
    b1t += x * lat; b2t += y * lat; b3t += lat;
  }
  const A = [
    [a11, a12, a13],
    [a12, a22, a23],
    [a13, a23, a33],
  ];
  function inv3(m) {
    const det =
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    if (Math.abs(det) < 1e-12) return null;
    const inv = [
      [(m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det],
      [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det, (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det],
      [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det, (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det, (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det],
    ];
    return inv;
  }
  const inv = inv3(A);
  if (!inv) throw new Error('Matrix singular');
  const mul = (M, v) => [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
  const [a, b, c] = mul(inv, [b1l, b2l, b3l]);
  const [d, e, f] = mul(inv, [b1t, b2t, b3t]);
  return (x, y) => [d * x + e * y + f, a * x + b * y + c]; // [lat, lng]
}

// ---------- ۶) ساده‌سازی Douglas-Peucker ----------
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sq = (p, q) => {
    const dx = p[0] - q[0], dy = p[1] - q[1];
    return dx * dx + dy * dy;
  };
  const distToSeg = (p, a, b) => {
    const ab2 = sq(a, b);
    if (ab2 === 0) return Math.sqrt(sq(p, a));
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ab2;
    t = Math.max(0, Math.min(1, t));
    const q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    return Math.sqrt(sq(p, q));
  };
  const stack = [[0, pts.length - 1]];
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  while (stack.length) {
    const [i0, i1] = stack.pop();
    if (i1 - i0 < 2) continue;
    let maxD = -1, idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = distToSeg(pts[i], pts[i0], pts[i1]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) {
      keep[idx] = true;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// ---------- ۷) اجرای اصلی ----------
const parsed = [];
const pairs = [];
for (const p of provinces) {
  const pts = parsePath(p.d);
  if (pts.length < 3) continue;
  const c = centroid(pts);
  const meta = byKpi.get(p.kpi);
  if (!meta) {
    console.warn(`[warn] no KPI data for ${p.kpi} (${p.fa})`);
    continue;
  }
  parsed.push({ id: p.kpi, name: p.fa, fa: p.fa, pts });
  pairs.push({ x: c[0], y: c[1], lng: meta.lng, lat: meta.lat });
}

console.log(`parsed ${parsed.length} provinces, fit on ${pairs.length} centroids`);
const project = solveAffine(pairs);

// گزارش خطای فیت
let maxErr = 0, sumErr = 0;
for (const p of parsed) {
  const c = centroid(p.pts);
  const [lat, lng] = project(c[0], c[1]);
  const meta = byKpi.get(p.id);
  const err = Math.sqrt((lat - meta.lat) ** 2 + (lng - meta.lng) ** 2);
  maxErr = Math.max(maxErr, err);
  sumErr += err;
}
console.log(`fit error: avg=${(sumErr / parsed.length).toFixed(4)}° max=${maxErr.toFixed(4)}°`);

// تبدیل + ساده‌سازی
const outlines = parsed.map((p) => ({
  id: p.id,
  name: p.name,
  points: simplify(p.pts.map(([x, y]) => project(x, y)), TOL_DEG),
}));

const total = outlines.reduce((s, o) => s + o.points.length, 0);
console.log(`total points after simplify: ${total} (avg ${Math.round(total / outlines.length)}/province)`);

// ---------- ۸) نوشتن فایل خروجی ----------
const lines = [];
lines.push('// تولیدشده توسط scripts/extract-province-outlines.cjs — کانتور مرز استان‌ها (lat/lng)');
lines.push('// مبدأ: مسیرهای SVG از مخزن nastoohir/iran-map-svg + پروژکشن آفاین روی مراکز استان‌ها');
lines.push('');
lines.push('export interface ProvinceOutline {');
lines.push('  id: string; // کد KPI استان (مثل TEH)');
lines.push('  name: string; // نام فارسی');
lines.push('  points: [number, number][]; // [[lat, lng], ...]');
lines.push('}');
lines.push('');
lines.push('export const PROVINCE_OUTLINES: ProvinceOutline[] = [');
for (const o of outlines) {
  const pts = o.points.map(([la, lg]) => `[${la.toFixed(4)}, ${lg.toFixed(4)}]`).join(', ');
  lines.push(`  { id: '${o.id}', name: '${o.name}', points: [${pts}] },`);
}
lines.push('];');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`written ${OUT} (${outlines.length} provinces)`);
