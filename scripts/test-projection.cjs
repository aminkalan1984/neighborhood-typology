/**
 * تست فرضیه‌های پروجکشن برای نگاشت SVG (x,y) → (lat,lng)
 * مقایسه: 1) مستطیلی با bbox، 2) مرکاتور با bbox، 3) آفاین کمترین مربعات
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'data', 'iranProvincePaths.ts');
const src = fs.readFileSync(SRC, 'utf8');

const provMatch = src.match(/export const IRAN_PROVINCES: IranSVGProvince\[\] = (\[[\s\S]*?\]);\n/);
const provinces = eval(provMatch[1]);
const dataMatch = src.match(/export const PROVINCES_DATA: MapirProvince\[\] = (\[[\s\S]*?\]);/);
const provData = eval(dataMatch[1]);
const byId = new Map(provData.map((p) => [p.id, p]));

// ==== پارس‌ر مسیر ساده (همان‌منطق اصلی اسکریپت) ====
const NUM = '[+-]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][+-]?\\d+)?';
function tokenize(d) {
  const re = new RegExp(`[MmLlHhVvCcSsQqTtAaZz]|${NUM}`, 'g');
  const t = [];
  let m;
  while ((m = re.exec(d)) !== null) t.push(m[0]);
  return t;
}
function parsePath(d) {
  const tokens = tokenize(d);
  const pts = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', ctrlX = 0, ctrlY = 0;
  const num = () => parseFloat(tokens[i++]);
  const rel = (v, base) => base + v;
  const cubic = (p0, p1, p2, p3, n = 12) => {
    for (let s = 1; s <= n; s++) {
      const t = s / n, u = 1 - t;
      pts.push([u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0], u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]);
    }
  };
  const quad = (p0, p1, p2, n = 10) => {
    for (let s = 1; s <= n; s++) {
      const t = s / n, u = 1 - t;
      pts.push([u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0], u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]]);
    }
  };
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[A-Za-z]$/.test(tok)) { cmd = tok; i++; }
    else if (cmd === '') break;
    if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
    const abs = cmd === cmd.toUpperCase();
    switch (cmd.toUpperCase()) {
      case 'M': x = abs ? num() : rel(num(), x); y = abs ? num() : rel(num(), y); sx = x; sy = y; pts.push([x, y]); break;
      case 'L': x = abs ? num() : rel(num(), x); y = abs ? num() : rel(num(), y); pts.push([x, y]); break;
      case 'H': x = abs ? num() : rel(num(), x); pts.push([x, y]); break;
      case 'V': y = abs ? num() : rel(num(), y); pts.push([x, y]); break;
      case 'C': {
        const x1 = abs ? num() : rel(num(), x), y1 = abs ? num() : rel(num(), y);
        const x2 = abs ? num() : rel(num(), x), y2 = abs ? num() : rel(num(), y);
        const x3 = abs ? num() : rel(num(), x), y3 = abs ? num() : rel(num(), y);
        cubic([x, y], [x1, y1], [x2, y2], [x3, y3]); ctrlX = x2; ctrlY = y2; x = x3; y = y3; break;
      }
      case 'S': {
        const x1 = abs ? num() : rel(num(), x), y1 = abs ? num() : rel(num(), y);
        const x2 = abs ? num() : rel(num(), x), y2 = abs ? num() : rel(num(), y);
        const x3 = abs ? num() : rel(num(), x), y3 = abs ? num() : rel(num(), y);
        cubic([x, y], [2*x-ctrlX, 2*y-ctrlY], [x1, y1], [x2, y2]); ctrlX = x1; ctrlY = y1; x = x2; y = y2; break;
      }
      case 'Q': {
        const x1 = abs ? num() : rel(num(), x), y1 = abs ? num() : rel(num(), y);
        const x2 = abs ? num() : rel(num(), x), y2 = abs ? num() : rel(num(), y);
        quad([x, y], [x1, y1], [x2, y2]); ctrlX = x1; ctrlY = y1; x = x2; y = y2; break;
      }
      case 'T': {
        const x2 = abs ? num() : rel(num(), x), y2 = abs ? num() : rel(num(), y);
        quad([x, y], [2*x-ctrlX, 2*y-ctrlY], [x2, y2]); ctrlX = 2*x-ctrlX; ctrlY = 2*y-ctrlY; x = x2; y = y2; break;
      }
      case 'A': {
        const rx = num(), ry = num(); num();
        const la = num() !== 0, sw = num() !== 0;
        const x2 = abs ? num() : rel(num(), x), y2 = abs ? num() : rel(num(), y);
        x = x2; y = y2; break;
      }
      case 'Z': pts.push([sx, sy]); x = sx; y = sy; break;
    }
  }
  return pts;
}

function centroid(pts) {
  let sx = 0, sy = 0;
  for (const [px, py] of pts) { sx += px; sy += py; }
  return [sx / pts.length, sy / pts.length];
}

// bbox کلی
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const data = provinces.map((p) => {
  const pts = parsePath(p.d);
  const c = centroid(pts);
  for (const [px, py] of pts) {
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
  }
  const meta = byId.get(p.kpi);
  return { kpi: p.kpi, name: meta ? meta.name : '?', x: c[0], y: c[1], lat: meta.lat, lng: meta.lng };
});
console.log('bbox: x', minX.toFixed(1), maxX.toFixed(1), ' y', minY.toFixed(1), maxY.toFixed(1));

// ایران: lng 44.03–63.33, lat 25.06–39.78
const L0 = 44.0319, L1 = 63.3333, B0 = 25.0641, B1 = 39.7821;

function errOf(proj) {
  let sum = 0, max = 0;
  for (const d of data) {
    const [lat, lng] = proj(d.x, d.y);
    const e = Math.sqrt((lat - d.lat) ** 2 + (lng - d.lng) ** 2);
    sum += e; max = Math.max(max, e);
  }
  return { avg: sum / data.length, max };
}

// 1) مستطیلی bbox
const equirect = (x, y) => [B1 - (y - minY) / (maxY - minY) * (B1 - B0), L0 + (x - minX) / (maxX - minX) * (L1 - L0)];
console.log('1) equirect bbox:', errOf(equirect));

// 2) مرکاتور
const yMerc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const y0 = yMerc(B0), y1 = yMerc(B1);
const merc = (x, y) => {
  const ym = y0 + (y - minY) / (maxY - minY) * (y1 - y0);
  const lat = (2 * Math.atan(Math.exp(ym)) - Math.PI / 2) * 180 / Math.PI;
  return [lat, L0 + (x - minX) / (maxX - minX) * (L1 - L0)];
};
console.log('2) mercator bbox:', errOf(merc));

// 3) آفاین روی bbox (مستطیل → مستطیل)
const affine = (x, y) => [
  B1 - (y - minY) / (maxY - minY) * (B1 - B0),
  L0 + (x - minX) / (maxX - minX) * (L1 - L0),
];
console.log('3) affine-ish (same as 1):', errOf(affine));
