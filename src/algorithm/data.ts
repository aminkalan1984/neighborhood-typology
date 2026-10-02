// ============================================================
// دادهٔ پهنه‌های ۴۰۰ خانواری + تولید قطعی دادهٔ خام
// مبنای استانی: PROVINCES_DATA (تنش آبی، رشد GDP، رضایت، ...)
// مبنای خوشه‌ای: پروفایل پهنه (پیشران/میان‌حال/محروم/سرمایهٔ نهفته)
// ============================================================
import { PROVINCES_DATA } from '../data/iranProvincePaths';
import type { ZoneMeta, ZoneRaw } from './types';

// ─── PRNG قطعی (mulberry32) برای بازتولیدپذیری کامل ──────────
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── مشخصات پایهٔ استان‌ها (از دادهٔ موجود داشبورد) ──────────
interface ProvinceSeed {
  waterStress: number;
  gdpGrowth: number;
  satisfaction: number;
  elevation: number;
  population: number;
  lat: number;
  lng: number;
}

const provinceSeeds = new Map<string, ProvinceSeed>(
  PROVINCES_DATA.map((p) => [
    p.id,
    {
      waterStress: p.waterStress,     // 0..100
      gdpGrowth: p.gdpGrowth,         // ٪
      satisfaction: p.satisfaction,   // 0..100
      elevation: p.elevation,         // m
      population: p.population,       // میلیون
      lat: p.lat,
      lng: p.lng,
    },
  ]),
);

// ─── تعریف پهنه‌ها (۲۰ محلهٔ نمونه حول محور اجتماعی) ─────────
const zoneDefs: Array<Omit<ZoneMeta, 'provinceFa'>> = [
  { id: 'Z-01', name: 'باغ فیض', city: 'تهران', provinceId: 'TEH', anchor: 'امامزاده صالح', anchorType: 'imamzadeh', households: 412, population: 1470, lat: 35.73, lng: 51.42, scale: 'urban', profile: 'mid' },
  { id: 'Z-02', name: 'شهرک امید', city: 'تهران', provinceId: 'TEH', anchor: 'مسجد جامع شهرک امید', anchorType: 'mosque', households: 398, population: 1410, lat: 35.69, lng: 51.38, scale: 'urban', profile: 'advanced' },
  { id: 'Z-03', name: 'ولنجک نو', city: 'تهران', provinceId: 'TEH', anchor: 'حسینیهٔ ولی‌عصر', anchorType: 'husseiniyeh', households: 405, population: 1495, lat: 35.79, lng: 51.4, scale: 'urban', profile: 'advanced' },
  { id: 'Z-04', name: 'هرندی', city: 'تهران', provinceId: 'TEH', anchor: 'امامزاده یحیی', anchorType: 'imamzadeh', households: 440, population: 1680, lat: 35.66, lng: 51.44, scale: 'urban', profile: 'deprived' },
  { id: 'Z-05', name: 'جی', city: 'اصفهان', provinceId: 'ISF', anchor: 'بازارچهٔ جی', anchorType: 'bazaar', households: 386, population: 1330, lat: 32.64, lng: 51.71, scale: 'urban', profile: 'mid' },
  { id: 'Z-06', name: 'کاشانی', city: 'اصفهان', provinceId: 'ISF', anchor: 'مسجد باب‌القبائل', anchorType: 'mosque', households: 421, population: 1500, lat: 32.6, lng: 51.62, scale: 'urban', profile: 'deprived' },
  { id: 'Z-07', name: 'شهرک ولیعصر', city: 'اصفهان', provinceId: 'ISF', anchor: 'مدرسهٔ امیرکبیر', anchorType: 'school', households: 394, population: 1365, lat: 32.68, lng: 51.66, scale: 'urban', profile: 'advanced' },
  { id: 'Z-08', name: 'کیان‌آباد', city: 'شیراز', provinceId: 'FAR', anchor: 'امامزاده ابوالقاسم', anchorType: 'imamzadeh', households: 408, population: 1440, lat: 29.62, lng: 52.57, scale: 'urban', profile: 'mid' },
  { id: 'Z-09', name: 'دراک', city: 'شیراز', provinceId: 'FAR', anchor: 'مسجد دراک', anchorType: 'mosque', households: 415, population: 1462, lat: 29.69, lng: 52.5, scale: 'urban', profile: 'advanced' },
  { id: 'Z-10', name: 'گود عرب‌ها', city: 'شیراز', provinceId: 'FAR', anchor: 'حسینیهٔ زنجیرها', anchorType: 'husseiniyeh', households: 447, population: 1590, lat: 29.6, lng: 52.53, scale: 'urban', profile: 'deprived' },
  { id: 'Z-11', name: 'محلهٔ شهرک صنعتی', city: 'مشهد', provinceId: 'KHR', anchor: 'مسجد صنایع', anchorType: 'mosque', households: 402, population: 1398, lat: 36.26, lng: 59.61, scale: 'urban', profile: 'mid' },
  { id: 'Z-12', name: 'چشمهٔ گل', city: 'مشهد', provinceId: 'KHR', anchor: 'امامزاده چشمهٔ گل', anchorType: 'imamzadeh', households: 396, population: 1380, lat: 36.31, lng: 59.55, scale: 'urban', profile: 'hidden-capital' },
  { id: 'Z-13', name: 'شهرک بعثت', city: 'تبریز', provinceId: 'EAZ', anchor: 'مسجد بعثت', anchorType: 'mosque', households: 410, population: 1450, lat: 38.08, lng: 46.3, scale: 'urban', profile: 'mid' },
  { id: 'Z-14', name: 'راستهٔ بازار', city: 'تبریز', provinceId: 'EAZ', anchor: 'بازار بزرگ تبریز', anchorType: 'bazaar', households: 389, population: 1320, lat: 38.08, lng: 46.29, scale: 'urban', profile: 'advanced' },
  { id: 'Z-15', name: 'عصمت‌آباد', city: 'کرمان', provinceId: 'KER', anchor: 'امامزاده اسماعیل', anchorType: 'imamzadeh', households: 424, population: 1490, lat: 30.29, lng: 57.08, scale: 'urban', profile: 'deprived' },
  { id: 'Z-16', name: 'منصورآباد', city: 'کرمان', provinceId: 'KER', anchor: 'حسینیهٔ منصورآباد', anchorType: 'husseiniyeh', households: 401, population: 1395, lat: 30.32, lng: 57.03, scale: 'urban', profile: 'hidden-capital' },
  { id: 'Z-17', name: 'چشمه‌نظر', city: 'اردبیل', provinceId: 'ARD', anchor: 'مدرسهٔ شهید رجایی', anchorType: 'school', households: 395, population: 1340, lat: 38.25, lng: 48.29, scale: 'urban', profile: 'mid' },
  { id: 'Z-18', name: 'سعادت‌شهر', city: 'یاسوج', provinceId: 'KHB', anchor: 'مسجد سعادت', anchorType: 'mosque', households: 384, population: 1290, lat: 30.67, lng: 51.59, scale: 'rural', profile: 'deprived' },
  { id: 'Z-19', name: 'چهارباغ', city: 'گرگان', provinceId: 'GOL', anchor: 'امامزاده نور', anchorType: 'imamzadeh', households: 403, population: 1370, lat: 36.84, lng: 54.43, scale: 'urban', profile: 'mid' },
  { id: 'Z-20', name: 'پیامبر اعظم', city: 'اهواز', provinceId: 'KHZ', anchor: 'مسجد پیامبر اعظم', anchorType: 'mosque', households: 431, population: 1520, lat: 31.32, lng: 48.67, scale: 'urban', profile: 'deprived' },
];

// ─── پروفایل‌ها: جابه‌جایی پایهٔ سه لایه ─────────────────────
const PROFILE_OFFSET: Record<ZoneMeta['profile'], { p: number; b: number; n: number }> = {
  advanced: { p: 0.28, b: 0.2, n: 0.14 },
  mid: { p: 0.06, b: 0.05, n: 0.05 },
  deprived: { p: -0.3, b: -0.24, n: -0.18 },
  'hidden-capital': { p: -0.16, b: -0.08, n: 0.34 },
};

export function buildZones(): ZoneMeta[] {
  return zoneDefs.map((z) => ({ ...z, provinceFa: provinceFaOf(z.provinceId) }));
}

// نام فارسی استان از روی کد
export function provinceFaOf(code: string): string {
  return PROVINCES_DATA.find((p) => p.id === code)?.name ?? code;
}

// ─── تولید قطعی دادهٔ خام هر پهنه ────────────────────────────
export function deriveZoneRaw(zone: ZoneMeta): ZoneRaw {
  const seed = provinceSeeds.get(zone.provinceId) ?? { waterStress: 70, gdpGrowth: 4, satisfaction: 60, elevation: 1200, population: 2, lat: 33, lng: 53 };
  const rnd = mulberry32(hashString(zone.id));
  const n = () => rnd() * 2 - 1; // نویز ±۱

  const off = PROFILE_OFFSET[zone.profile];
  // پایهٔ استانی (مقیاس 0..1)
  const waterBase = clamp(1 - seed.waterStress / 100, 0, 1);
  const econBase = clamp((seed.gdpGrowth - 1) / 9, 0, 1);
  const trustBase = clamp(seed.satisfaction / 100, 0, 1);
  const ruralBase = zone.scale === 'rural' ? 0.18 : 0.72;

  // سه محور پایهٔ پهنه
  const pBase = clamp(0.42 * waterBase + 0.35 * econBase + 0.23 * ruralBase + off.p + n() * 0.08, 0.02, 0.98);
  const bBase = clamp(0.4 * econBase + 0.3 * trustBase + 0.3 * ruralBase + off.b + n() * 0.08, 0.02, 0.98);
  const nBase = clamp(0.35 * trustBase + 0.3 * econBase + 0.35 * ruralBase + off.n + n() * 0.08, 0.02, 0.98);

  // نگاشت پایه به بازهٔ واقعی هر کمیت
  const mix = (base: number, lo: number, hi: number, jitter = 0.04) =>
    clamp(lo + (hi - lo) * clamp(base + n() * jitter, 0, 1), lo, hi);

  const isHot = zone.provinceId === 'KHZ' || zone.provinceId === 'HOR' || zone.provinceId === 'BSH';
  const isDry = seed.waterStress > 80;
  const urban = zone.scale === 'urban';

  return {
    // کالبدی
    utilityPenetration: mix(pBase, 0.35, 1),
    solidHousing: mix(pBase, 0.25, 0.97),
    broadband: mix(0.5 * pBase + (urban ? 0.5 : 0), 0.2, 0.98),
    nightlight: mix(pBase * 0.7 + econBase * 0.3, 0.4, 55),
    nightlightTrend: mix(econBase, -0.15, 0.25),
    blindSpots: mix(1 - pBase, 0.08, 0.8),
    permeability: mix(pBase, 0.2, 0.95),
    serviceDistance: mix(1 - pBase, 0.3, 11),
    multiPurposeSpaces: mix(urban ? pBase : 0.4, 0.2, 9),
    hazardExposure: mix(1 - waterBase * 0.5, 0.05, 0.9),
    fineGrainShare: mix(1 - pBase, 0.05, 0.85),
    no2: mix(pBase * 0.4 + (urban ? 0.6 : 0), 10, 75),
    so2: mix(pBase * 0.4 + (urban ? 0.6 : 0), 2, 22),
    aerosol: mix(pBase * 0.5 + (isDry ? 0.5 : 0), 0.05, 0.75),
    pm25: mix(0.3 * pBase + 0.7 * (isHot || isDry ? 0.7 : 0.45), 12, 95),
    lst: mix(0.45 * pBase + 0.55 * (isHot ? 0.85 : 0.4), 24, 54),
    ndvi: mix(0.7 * (1 - pBase) + (isDry ? 0 : 0.3), 0.02, 0.5),
    builtShare: mix(pBase, 0.1, 0.95),
    settlementFootprint: mix(pBase, 0.05, 0.9),
    populationDensity: mix(urban ? pBase : 0.3, 300, 24000),
    waterSurfaceShare: mix(1 - waterBase, 0.01, 0.4),
    spei: mix(1 - waterBase, -2.8, 1.6),
    intersectionDensity: mix(urban ? pBase : 0.3, 5, 160),
    connectivity: mix(pBase, 0.2, 0.96),
    pedestrianInfra: mix(pBase, 0.05, 0.9),
    busStops: mix(urban ? pBase : 0.2, 0.5, 30),
    metroAccess: mix(1 - pBase, 0.4, 24),
    serviceAccess2sfca: mix(pBase, 0.1, 0.95),
    walkability: mix(pBase * 0.8 + 0.2, -2.4, 2.6),
    fixedBroadbandSpeed: mix(pBase, 4, 95),
    mobileSpeed: mix(pBase, 8, 140),
    cellTowers: mix(urban ? pBase : 0.25, 0.3, 14),
    lte5gShare: mix(pBase, 0.15, 0.98),
    fuelStations: mix(urban ? pBase : 0.3, 0, 6),
    hospitalDist: mix(1 - pBase, 0.5, 35),
    pharmacyDensity: mix(urban ? pBase : 0.2, 0, 8),
    clinicDensity: mix(urban ? pBase : 0.25, 0, 7),
    healthCentersPerCap: mix(pBase, 0.5, 12),
    foodShops: mix(urban ? pBase : 0.3, 0.5, 22),
    safeWater: mix(0.5 * pBase + 0.5 * waterBase, 0.4, 1),
    improvedSanitation: mix(0.6 * pBase + 0.4 * waterBase, 0.3, 1),
    handwashing: mix(pBase * 0.7 + 0.3, 0.25, 1),
    urbanizationShare: urban ? mix(pBase, 0.5, 1) : mix(pBase, 0.05, 0.4),
    // رفتاری
    selfEmployment: mix(bBase, 0.15, 0.85),
    youthShare: mix(0.5 * bBase + 0.5, 0.15, 0.5),
    relatedVariety: mix(bBase, 0.3, 2.4),
    techAdoption: mix(0.5 * bBase + 0.5 * pBase, 0.1, 0.9),
    economicDynamism: mix(0.6 * bBase + 0.4 * econBase, 0.1, 0.95),
    outMigration: mix(1 - bBase * 0.6, 0.02, 0.5),
    unemployment: mix(1 - bBase * 0.7, 0.04, 0.45),
    bankAtmDensity: mix(urban ? bBase : 0.15, 0, 9),
    marketDensity: mix(urban ? bBase : 0.2, 0, 5),
    businessDiversity: mix(bBase, 0.2, 2.2),
    durableGoods: mix(bBase, 0.2, 0.9),
    dependencyRatio: mix(0.5 * (1 - bBase) + 0.5, 0.4, 1.3),
    youth1529: mix(0.5 * bBase + 0.5, 0.1, 0.4),
    literacy: mix(0.6 * bBase + 0.4 * trustBase, 0.55, 0.99),
    meanSchooling: mix(bBase, 3.5, 12.5),
    higherEduShare: mix(bBase, 0.03, 0.5),
    secondaryCompletion: mix(bBase, 0.35, 0.95),
    dropoutRate: mix(1 - bBase * 0.7, 0.02, 0.4),
    genderParity: mix(bBase, 0.55, 1.1),
    schoolDensity: mix(urban ? bBase : 0.3, 0.3, 9),
    pupilTeacherRatio: mix(1 - bBase * 0.5, 12, 38),
    tertiaryEnrollment: mix(bBase, 0.05, 0.65),
    digitalLiteracy: mix(0.5 * bBase + 0.5 * pBase, 0.15, 0.9),
    // هنجاری
    religiousInstitutions: mix(0.6 * nBase + 0.4, 0.5, 12),
    learningCenters: mix(nBase, 0.2, 6),
    electoralParticipation: mix(0.5 * nBase + 0.5 * trustBase, 0.25, 0.85),
    socialHarmRate: mix(1 - nBase * 0.7, 0.02, 0.35),
    residentialStability: mix(nBase, 0.4, 0.95),
    ownershipShare: mix(nBase, 0.3, 0.9),
    femaleHeadShare: mix(1 - nBase * 0.5, 0.04, 0.3),
    householdSize: mix(1 - nBase * 0.3, 2.4, 5.2),
    elderlyShare: mix(0.4 * (1 - nBase) + 0.6 * (urban ? 0.4 : 0.3), 0.05, 0.35),
    multigenShare: mix(nBase, 0.1, 0.7),
    ngoDensity: mix(nBase * 0.5 + (urban ? 0.5 : 0), 0, 3.5),
    worshipDensity: mix(0.6 * nBase + 0.4, 0.4, 10),
    parkPerCap: mix(0.4 * nBase + 0.6 * pBase, 0.2, 14),
    protestEvents: mix(1 - nBase, 0, 4),
    preschoolParticipation: mix(nBase, 0.2, 0.9),
    libraryDensity: mix(urban ? nBase : 0.1, 0, 3),
    lifeExpectancy: mix(nBase, 62, 80),
    dalyBurden: mix(1 - nBase * 0.6, 220, 780),
    fieldSurvey: zone.profile !== 'deprived',  // N4 برای محروم‌ها gap (سناریوی واقعی)
  };
}
