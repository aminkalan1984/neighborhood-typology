// بازیابی مقادیر اصلی PROVINCES_DATA از باندل قبلی + حفظ فیلدهای جدید (population/area/activeAlerts)
const fs = require('fs');

const bundle = fs.readFileSync('dist/assets/index-4PuYFDDu.js', 'utf8');
const target = 'src/data/iranProvincePaths.ts';
const t = fs.readFileSync(target, 'utf8');

// ۱) استخراج آبجکت‌های استان از باندل
const objRe = /\{id:"([A-Z]{3})",name:"([^"]+)",lat:([0-9.-]+),lng:([0-9.-]+),waterStress:([0-9.]+),gdpGrowth:([0-9.]+),inflation:([0-9.]+),satisfaction:([0-9.]+),status:"([a-z]+)",elevation:([0-9.-]+)\}/g;
const recovered = [];
let m;
while ((m = objRe.exec(bundle))) {
  recovered.push({
    id: m[1], name: m[2], lat: +m[3], lng: +m[4], waterStress: +m[5], gdpGrowth: +m[6],
    inflation: +m[7], satisfaction: +m[8], status: m[9], elevation: +m[10],
  });
}
console.log('recovered provinces from bundle:', recovered.length);
if (recovered.length < 31) {
  console.error('Not enough provinces recovered!');
  process.exit(1);
}

// ۲) استخراج فیلدهای جدید از فایل فعلی (population/area/activeAlerts)
const enrichRe = /id: '([A-Z]{3})', name: '([^']+)'[^}]*?population: ([0-9.]+), area: (\d+), activeAlerts: (\d+)/g;
const enrich = new Map();
let em;
while ((em = enrichRe.exec(t))) {
  enrich.set(em[1], { population: +em[3], area: +em[4], activeAlerts: +em[5] });
}
console.log('enrichment fields found in current file:', enrich.size);

// ۳) بازسازی block
const lines = recovered.map((p) => {
  const e = enrich.get(p.id) || { population: 1, area: 10000, activeAlerts: 0 };
  return `  { id: '${p.id}', name: '${p.name}', lat: ${p.lat}, lng: ${p.lng}, waterStress: ${p.waterStress}, gdpGrowth: ${p.gdpGrowth}, inflation: ${p.inflation}, satisfaction: ${p.satisfaction}, status: '${p.status}', elevation: ${p.elevation}, population: ${e.population}, area: ${e.area}, activeAlerts: ${e.activeAlerts} },`;
});
const newBlock = lines.join('\n');

// ۴) جایگزینی در فایل
const startMarker = 'export const PROVINCES_DATA: MapirProvince[] = [';
const start = t.indexOf(startMarker);
const endMarker = '];';
const end = t.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  console.error('markers not found in target file');
  process.exit(1);
}
const rebuilt = t.slice(0, start) + startMarker + '\n' + newBlock + '\n' + endMarker + t.slice(end + 2);
fs.writeFileSync(target, rebuilt);
console.log('REBUILT OK. New block length:', newBlock.length);
// تأیید
const check = fs.readFileSync(target, 'utf8');
const v = check.match(/waterStress: 0/g);
console.log('remaining zeros:', v ? v.length : 0);
