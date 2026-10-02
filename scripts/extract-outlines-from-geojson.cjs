/**
 * استخراج کانتور مرز استان‌ها از GeoJSON واقعی (WGS84) و تولید فایل TypeScript
 * منبع: hosseinhabibi2004/iran-geojson (استان‌های ایران از OpenStreetMap)
 * خروجی: src/data/provinceOutlines.ts  →  PROVINCE_OUTLINES: Record<id, [lng,lat][][]>
 */
const fs = require('fs');
const path = require('path');

const GEO_FILE = process.argv[2]; // مسیر فایل geojson (مسیر ویندوز)
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'provinceOutlines.ts');

if (!GEO_FILE) { console.error('Usage: node extract-outlines-from-geojson.cjs <geojson-path>'); process.exit(1); }

// ---------- 1) بارگذاری GeoJSON ----------
const geojson = JSON.parse(fs.readFileSync(GEO_FILE, 'utf8'));

// ---------- 2) نگاشت نام فارسی → id پروژه از PROVINCES_DATA ----------
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'iranProvincePaths.ts'), 'utf8');
const m = src.match(/export const PROVINCES_DATA: MapirProvince\[\] = (\[[\s\S]*?\]);/);
if (!m) { console.error('PROVINCES_DATA not found'); process.exit(1); }
const nameToId = {};
const re = /id: '([A-Z]+)',\s*name: '([^']+)'/g;
let r;
while ((r = re.exec(m[1])) !== null) nameToId[r[2]] = r[1];

// ---------- 3) Douglas–Peucker (فاصلهٔ نقطهای به پاره‌خط) ----------
function perpendicularDistance(pt, lineStart, lineEnd) {
  const [x1, y1] = lineStart, [x2, y2] = lineEnd, [x0, y0] = pt;
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(x0 - x1, y0 - y1);
  const t = Math.max(0, Math.min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / lenSq));
  return Math.hypot(x0 - (x1 + t * dx), y0 - (y1 + t * dy));
}
function simplify(pts, tolerance) {
  if (pts.length < 3) return pts;
  let maxDist = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist > tolerance) {
    const left = simplify(pts.slice(0, idx + 1), tolerance);
    const right = simplify(pts.slice(idx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}

// ---------- 4) استخراج رینگ‌ها ----------
const TOLERANCE = 0.006; // ~۶۶۰ متر – جزئیات خوب در زوم ۸
const outlines = {};
let matched = 0, totalRings = 0;

for (const feat of geojson.features) {
  const faName = feat.properties['name:fa'];
  const id = nameToId[faName];
  if (!id) { console.warn('⚠️ بدون id:', faName); continue; }
  matched++;
  const rings = [];
  const coords = feat.geometry.coordinates; // MultiPolygon: [polygon[ring[pt]]]
  for (const poly of coords) {
    for (const rawRing of poly) {
      // حذف بُعد سوم، بستن حلقه، ساده‌سازی
      const ring2d = rawRing.map(p => [Number(p[0]), Number(p[1])]);
      if (ring2d.length < 4) continue;
      if (ring2d[0][0] !== ring2d[ring2d.length - 1][0] || ring2d[0][1] !== ring2d[ring2d.length - 1][1]) {
        ring2d.push([ring2d[0][0], ring2d[0][1]]);
      }
      const simplified = simplify(ring2d, TOLERANCE);
      if (simplified.length >= 4) { rings.push(simplified); totalRings++; }
    }
  }
  outlines[id] = rings;
}

// ---------- 5) نوشتن فایل خروجی ----------
const fmt = (v) => Number(v.toFixed(5));
const lines = [];
for (const [id, polys] of Object.entries(outlines)) {
  lines.push(`  '${id}': [`);
  for (const ring of polys) {
    lines.push('    [' + ring.map(p => `[${fmt(p[0])},${fmt(p[1])}]`).join(',') + '],');
  }
  lines.push('  ],');
}

const header = `// ═══════════════════════════════════════════════════════════════
// کانتور مرز استان‌های ایران — مختصات واقعی WGS84 (EPSG:4326)
// منبع: hosseinhabibi2004/iran-geojson (مشتق از OpenStreetMap)
// ساختار: Record<کد استان, حلقه[][])  — هر حلقه: [lng, lat][]
// تولیدشده توسط scripts/extract-outlines-from-geojson.cjs
// ═══════════════════════════════════════════════════════════════

export const PROVINCE_OUTLINES: Record<string, [number, number][][]> = {
`;

fs.writeFileSync(OUT_FILE, header + lines.join('\n') + '};\n', 'utf8');
const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
console.log(`✅ ${matched}/31 استان نگاشت شد | ${totalRings} حلقه | حجم فایل: ${kb}KB`);
console.log('خروجی:', OUT_FILE);
