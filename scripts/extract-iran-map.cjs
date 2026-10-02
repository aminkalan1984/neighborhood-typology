const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(ROOT, 'src/data/iran-map.svg'), 'utf8');

const faNames = {
  alborz: 'البرز', ardabil: 'اردبیل', 'azerbaijan-east': 'آذربایجان شرقی',
  'azerbaijan-west': 'آذربایجان غربی', bushehr: 'بوشهر', 'chaharmahal-bakhriari': 'چهارمحال و بختیاری',
  fars: 'فارس', gilan: 'گیلان', golestan: 'گلستان', hamadan: 'همدان', hormozgan: 'هرمزگان',
  ilam: 'ایلام', isfahan: 'اصفهان', kerman: 'کرمان', kermanshah: 'کرمانشاه',
  'khorasan-north': 'خراسان شمالی', 'khorasan-razavi': 'خراسان رضوی', 'khorasan-south': 'خراسان جنوبی',
  khuzestan: 'خوزستان', 'kohgiluye-boyerahmad': 'کهگیلویه و بویراحمد', kurdistan: 'کردستان',
  lorestan: 'لرستان', markazi: 'مرکزی', mazandaran: 'مازندران', qazvin: 'قزوین', qom: 'قم',
  semnan: 'سمنان', 'sistan-baluchestan': 'سیستان و بلوچستان', tehran: 'تهران', yazd: 'یزد', zanjan: 'زنجان'
};

const kpiIds = {
  tehran: 'TEH', fars: 'FAR', isfahan: 'ISF', khuzestan: 'KHZ', 'azerbaijan-east': 'EAZ',
  'sistan-baluchestan': 'SIV', 'khorasan-razavi': 'KHR', hormozgan: 'HOR', gilan: 'GIL',
  kerman: 'KER', mazandaran: 'MAZ', kermanshah: 'KRM', 'azerbaijan-west': 'WAZ', yazd: 'YAZ',
  bushehr: 'BSH', markazi: 'MRK', hamadan: 'HAM', kurdistan: 'KRD', qazvin: 'QAZ', lorestan: 'LUR',
  golestan: 'GOL', zanjan: 'ZAN', ardabil: 'ARD', 'chaharmahal-bakhriari': 'CHB',
  'khorasan-north': 'NKH', 'khorasan-south': 'SKH', semnan: 'SEM', ilam: 'ILM',
  'kohgiluye-boyerahmad': 'KHB', qom: 'QOM', alborz: 'ALB'
};

const re = /<(path|polygon)([^>]*?)>/g;
const provinces = [];
const waters = [];
let m;
while ((m = re.exec(svg))) {
  const attrs = m[2];
  const idMatch = attrs.match(/\sid="([^"]+)"/);
  if (!idMatch) continue;
  const id = idMatch[1];
  const d = (attrs.match(/\sd="([^"]+)"/) || [])[1];
  const points = (attrs.match(/\spoints="([^"]+)"/) || [])[1];
  let pathData = (d || '').replace(/\s+/g, ' ').trim();
  if (!pathData && points) {
    // تبدیل polygon points به مسیر SVG معتبر (M…Z)
    pathData = 'M' + points.replace(/\s+/g, ' ').trim() + ' Z';
  }
  if (!pathData) continue;
  if (faNames[id]) {
    provinces.push({ id, fa: faNames[id], kpi: kpiIds[id], d: pathData });
  } else {
    waters.push({ id, d: pathData });
  }
}

const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 1200 1070.6';

const fileContent =
  '// استخراج‌شده از مخزن گیت‌هاب nastoohir/iran-map-svg — نقشهٔ کامل ایران: ۳۱ استان + دریاها + جزایر (CC-BY)\n' +
  '// لینک: https://github.com/nastoohir/iran-map-svg/blob/master/iran.svg\n' +
  "import type { IranSVGProvince, IranSVGWaters } from '../types';\n\n" +
  `export const IRAN_VIEWBOX = "${viewBox}";\n\n` +
  `export const IRAN_PROVINCES: IranSVGProvince[] = ${JSON.stringify(provinces)};\n\n` +
  `export const IRAN_WATERS: IranSVGWaters[] = ${JSON.stringify(waters)};\n`;

fs.writeFileSync(path.join(ROOT, 'src/data/iranProvincePaths.ts'), fileContent);
console.log('provinces:', provinces.length, '| waters:', waters.length, '| viewBox:', viewBox);
console.log('file size KB:', (fs.statSync(path.join(ROOT, 'src/data/iranProvincePaths.ts')).size / 1024).toFixed(1));
