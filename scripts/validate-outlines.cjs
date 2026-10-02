// اعتبارسنجی فایل provinceOutlines.ts — ارزیابی واقعی آبجکت (همان کاری که مرورگر می‌کند)
const fs = require('fs');

const src = fs.readFileSync('src/data/provinceOutlines.ts', 'utf8');
const dataSrc = fs.readFileSync('src/data/iranProvincePaths.ts', 'utf8');

// استخراج بدنهٔ آبجکت و ارزیابی
const objMatch = src.match(/export const PROVINCE_OUTLINES: Record<string, \[number, number\]\[\]\[\]> = (\{[\s\S]*?\});/);
if (!objMatch) { console.error('❌ آبجکت خروجی یافت نشد'); process.exit(1); }
const outlines = new Function('return ' + objMatch[1])();

// استخراج id های PROVINCES_DATA
const dm = dataSrc.match(/export const PROVINCES_DATA: MapirProvince\[\] = (\[[\s\S]*?\]);/);
const dataIds = [...dm[1].matchAll(/id: '([A-Z]+)'/g)].map(m => m[1]);

const outlineIds = Object.keys(outlines);
console.log('تعداد استان در PROVINCES_DATA:', dataIds.length);
console.log('تعداد استان در PROVINCE_OUTLINES:', outlineIds.length);

const missing = dataIds.filter(id => !outlineIds.includes(id));
const extra = outlineIds.filter(id => !dataIds.includes(id));
console.log('گمشده:', missing.length ? missing.join(', ') : '—');
console.log('اضافی:', extra.length ? extra.join(', ') : '—');

// بررسی صحت حلقه‌ها و محدوده جغرافیایی
let rings = 0, bad = 0;
let minLng = 99, maxLng = -99, minLat = 99, maxLat = -99;
for (const id of outlineIds) {
  for (const ring of outlines[id]) {
    rings++;
    if (!Array.isArray(ring) || ring.length < 4) { bad++; console.log('⚠️ حلقه نامعتبر:', id, 'نقاط:', ring.length); continue; }
    for (const pt of ring) {
      const [lng, lat] = pt;
      if (typeof lng !== 'number' || typeof lat !== 'number' || lng < 44 || lng > 64 || lat < 24.5 || lat > 40.5) {
        bad++; console.log('⚠️ نقطه خارج محدوده:', id, lng, lat);
        break;
      }
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
  }
}
console.log('مجموع حلقه‌ها:', rings, '| نقاط نامعتبر:', bad);
console.log('پوشش جغرافیایی: lng', minLng.toFixed(2), '-', maxLng.toFixed(2), '| lat', minLat.toFixed(2), '-', maxLat.toFixed(2));
console.log(bad === 0 && missing.length === 0 && extra.length === 0 ? '✅ داده معتبر است' : '❌ مشکل یافت شد');
