const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const target = path.join(ROOT, 'src/data/iranProvincePaths.ts');
let s = fs.readFileSync(target, 'utf8');

// دادهٔ تقریبی هر استان: جمعیت (میلیون نفر)، مساحت (km²)، هشدار فعال
const extra = {
  TEH: [13.3, 18814, 6], FAR: [4.9, 122608, 8], ISF: [5.1, 107017, 5],
  KHZ: [4.7, 64055, 7], EAZ: [3.9, 45481, 2], SIV: [2.8, 181785, 9],
  KHR: [6.4, 118884, 4], HOR: [1.8, 70697, 3], GIL: [2.5, 14042, 1],
  KER: [3.2, 183285, 6], MAZ: [3.3, 23833, 1], KRM: [2.0, 25009, 3],
  WAZ: [3.3, 37411, 2], YAZ: [1.1, 76469, 2], BSH: [1.2, 22743, 3],
  MRK: [1.4, 29127, 3], HAM: [1.7, 19493, 4], KRD: [1.6, 29137, 2],
  QAZ: [1.3, 15567, 2], LUR: [1.8, 28294, 3], GOL: [1.9, 20367, 2],
  ZAN: [1.1, 21773, 1], ARD: [1.3, 17953, 1], CHB: [0.97, 16332, 2],
  NKH: [0.86, 28434, 1], SKH: [0.79, 151913, 2], SEM: [0.7, 97491, 2],
  ILM: [0.58, 20133, 1], KHB: [0.72, 15504, 2], QOM: [1.4, 11526, 2],
  ALB: [2.7, 5122, 3],
};

// 1) افزودن فیلدها به interface
s = s.replace(
  '  status: \'critical\' | \'warning\' | \'optimal\';\n  elevation: number;\n}',
  '  status: \'critical\' | \'warning\' | \'optimal\';\n  elevation: number;\n  population: number; // میلیون نفر\n  area: number; // کیلومتر مربع\n  activeAlerts: number; // تعداد هشدارهای فعال\n}'
);

// 2) افزودن مقادیر به هر ردیف استان
let count = 0;
s = s.replace(/  \{ id: '(\w+)', name: '([^']+)', lat: [\d.]+(?:e[+-]?\d+)?, lng: [\d.]+(?:e[+-]?\d+)?, waterStress: [\d.]+(?:e[+-]?\d+)?, gdpGrowth: [\d.]+(?:e[+-]?\d+)?, inflation: [\d.]+(?:e[+-]?\d+)?, satisfaction: [\d.]+(?:e[+-]?\d+)?, status: '(\w+)', elevation: [\d-]+(?:e[+-]?\d+)? \},/g, (match, id, name, status) => {
  const e = extra[id];
  if (!e) {
    console.log('MISSING extra for', id);
    return match;
  }
  count++;
  return `  { id: '${id}', name: '${name}', lat: 0, lng: 0, waterStress: 0, gdpGrowth: 0, inflation: 0, satisfaction: 0, status: '${status}', elevation: 0, population: ${e[0]}, area: ${e[1]}, activeAlerts: ${e[2]} },`;
});

if (count === 0) {
  console.log('WARN: no rows matched — preserving original data; adding extras only to interface');
}

// اگر regex بالا چیزی را تغییر نداد (فرمت اعداد متفاوت)، روش جایگزینی ساده‌تر:
if (count === 0) {
  for (const [id, [pop, area, alerts]] of Object.entries(extra)) {
    const re = new RegExp(`(  \\{ id: '${id}', name: '([^']+)', lat: ([\\d.]+), lng: ([\\d.]+), waterStress: ([\\d.]+), gdpGrowth: ([\\d.]+), inflation: ([\\d.]+), satisfaction: ([\\d.]+), status: '([\\w]+)', elevation: ([\\d-]+) \\},)`, 'g');
    s = s.replace(re, (m, full, name, lat, lng, ws, gdp, inf, sat, st, elev) => {
      return `  { id: '${id}', name: '${name}', lat: ${lat}, lng: ${lng}, waterStress: ${ws}, gdpGrowth: ${gdp}, inflation: ${inf}, satisfaction: ${sat}, status: '${st}', elevation: ${elev}, population: ${pop}, area: ${area}, activeAlerts: ${alerts} },`;
    });
  }
}

fs.writeFileSync(target, s);
console.log('enriched provinces:', count, '(fallback pass if 0)');
console.log('population fields present:', (s.match(/population:/g) || []).length);
