// ---------------------------------------------------------------------------
// بافت محلی از OSM (iran.pbf) — محاسبهٔ شاخص‌های محلی برای نقطهٔ موردنظر
// ---------------------------------------------------------------------------
// این ماژول لایه‌های فشردهٔ استخراج‌شده از iran.pbf (scripts/extract_pbf_layers.py)
// را با fetch تنبل بارگیری می‌کند و برای هر نقطهٔ انتخابی، بدون نیاز به Overpass،
// شاخص‌های بافت محلی را محاسبه می‌کند: نزدیک‌ترین سکونتگاه، شمارش POI در شعاع،
// دسترسی به آب/سد/راه اصلی/ریل. منبع: OpenStreetMap (ODbL).
import { loadPbfLayer, poiCategory } from './pbfLayers';

export interface PbfNearest {
  name?: string;
  typeFa: string;
  km: number;
}

export interface PbfPointContext {
  /** نزدیک‌ترین شهر یا شهرک */
  nearestCityTown: PbfNearest | null;
  /** نزدیک‌ترین روستا/ده */
  nearestVillage: PbfNearest | null;
  /** تعداد آبادی‌ها در شعاع ۱۰ کیلومتر */
  villagesWithin10km: number;
  /** تعداد آبادی‌ها در شعاع ۵ کیلومتر */
  villagesWithin5km: number;
  /** شمارش POI به تفکیک دسته در شعاع ۵ کیلومتر */
  poisByCategory: Record<string, number>;
  /** کل POI در شعاع ۵ کیلومتر */
  poisWithin5km: number;
  /** نزدیک‌ترین بیمارستان */
  nearestHospital: PbfNearest | null;
  /** نزدیک‌ترین آبراهه (رود/کانال/قنات/جوی) */
  nearestWater: PbfNearest | null;
  /** نزدیک‌ترین سد */
  nearestDam: PbfNearest | null;
  /** نزدیک‌ترین راه اصلی (آزادراه/بزرگراه/راه اصلی) */
  nearestMainRoad: PbfNearest | null;
  /** نزدیک‌ترین خط راه‌آهن */
  nearestRailway: PbfNearest | null;
}

const EARTH_R = 6371.0088;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** تبدیل کیلومتر به درجهٔ تقریبی طول جغرافیایی در عرض مشخص (برای فیلتر bbox). */
function degPerKmAt(lat: number): number {
  return 1 / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);
}

const POI_FA: Record<string, string> = {
  health: 'سلامت', education: 'آموزش', finance: 'مالی/بانکی', fuel: 'سوخت',
  tourism: 'گردشگری', heritage: 'میراث', worship: 'مذهبی',
};
const PLACE_FA: Record<string, string> = {
  city: 'شهر', town: 'شهرک', village: 'روستا', hamlet: 'ده', suburb: 'حومه',
  neighbourhood: 'محله', district: 'منطقه', isolated_dwelling: 'خانه تنها',
  locality: 'محدوده', quarter: 'محله',
};
const MAIN_ROAD_FA: Record<string, string> = {
  motorway: 'آزادراه', trunk: 'بزرگراه', primary: 'راه اصلی',
};
const WATER_FA: Record<string, string> = {
  river: 'رودخانه', canal: 'کانال/قنات', stream: 'جوی', drain: 'زهکش',
  dam: 'سد', weir: 'آب‌بند', waterfall: 'آبشار', water: 'پهنه آبی',
  wetland: 'تالاب', lake: 'دریاچه', reservoir: 'مخزن',
};

// ─── حافظهٔ کش کوچک برای نقاط تکراری ─────────────────────────
const contextCache = new Map<string, PbfPointContext>();
const CACHE_MAX = 24;

/** محاسبهٔ بافت محلی PBF برای یک نقطه (نتیجه کش می‌شود). */
export async function pbfContextForPoint(lat: number, lng: number): Promise<PbfPointContext> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = contextCache.get(key);
  if (cached) return cached;

  const [placesFile, poisFile, waterFile, roadsFile, railwayFile] = await Promise.all([
    loadPbfLayer('places'),
    loadPbfLayer('pois'),
    loadPbfLayer('water'),
    loadPbfLayer('roads'),
    loadPbfLayer('railway'),
  ]);

  const ctx: PbfPointContext = {
    nearestCityTown: null,
    nearestVillage: null,
    villagesWithin10km: 0,
    villagesWithin5km: 0,
    poisByCategory: {},
    poisWithin5km: 0,
    nearestHospital: null,
    nearestWater: null,
    nearestDam: null,
    nearestMainRoad: null,
    nearestRailway: null,
  };

  // ── سکونتگاه‌ها ───────────────────────────────────────────
  for (const p of placesFile.points ?? []) {
    const d = haversineKm(lat, lng, p.c[1], p.c[0]);
    if (d <= 10) {
      if (p.t === 'city' || p.t === 'town') {
        if (d < 30 && (!ctx.nearestCityTown || d < ctx.nearestCityTown.km)) {
          ctx.nearestCityTown = { name: p.n, typeFa: PLACE_FA[p.t] ?? p.t, km: d };
        }
      } else {
        if (d <= 5) ctx.villagesWithin5km += 1;
        ctx.villagesWithin10km += 1;
        if (d < 20 && (!ctx.nearestVillage || d < ctx.nearestVillage.km)) {
          ctx.nearestVillage = { name: p.n, typeFa: PLACE_FA[p.t] ?? p.t, km: d };
        }
      }
    }
  }

  // ── POI در شعاع ۵ کیلومتر ─────────────────────────────────
  for (const p of poisFile.points ?? []) {
    const d = haversineKm(lat, lng, p.c[1], p.c[0]);
    if (d > 5) continue;
    ctx.poisWithin5km += 1;
    const cat = poiCategory(p.t);
    ctx.poisByCategory[cat] = (ctx.poisByCategory[cat] ?? 0) + 1;
    if (p.t === 'hospital' && (!ctx.nearestHospital || d < ctx.nearestHospital.km)) {
      ctx.nearestHospital = { name: p.n, typeFa: 'بیمارستان', km: d };
    }
  }

  // ── آبراهه‌ها و سدها (خطوط) ───────────────────────────────
  const searchDeg = degPerKmAt(lat) * 25;
  const [wMinLng, wMaxLng] = [lng - searchDeg, lng + searchDeg];
  const [wMinLat, wMaxLat] = [lat - 0.22, lat + 0.22]; // ~۲۵ کیلومتر در عرض جغرافیایی
  for (const ln of waterFile.lines ?? []) {
    let minD = Infinity;
    for (const [x, y] of ln.c) {
      if (x < wMinLng || x > wMaxLng || y < wMinLat || y > wMaxLat) continue;
      const d = haversineKm(lat, lng, y, x);
      if (d < minD) minD = d;
      if (d < 25) break;
    }
    if (minD > 25) continue;
    if (ln.t === 'dam' && (!ctx.nearestDam || minD < ctx.nearestDam.km)) {
      ctx.nearestDam = { name: ln.n, typeFa: 'سد', km: minD };
    }
    if (ln.t !== 'dam' && (!ctx.nearestWater || minD < ctx.nearestWater.km)) {
      ctx.nearestWater = { name: ln.n, typeFa: WATER_FA[ln.t] ?? ln.t, km: minD };
    }
  }

  // ── راه اصلی ──────────────────────────────────────────────
  for (const ln of roadsFile.lines ?? []) {
    const fa = MAIN_ROAD_FA[ln.t];
    if (!fa) continue;
    let minD = Infinity;
    for (const [x, y] of ln.c) {
      if (x < wMinLng || x > wMaxLng || y < wMinLat || y > wMaxLat) continue;
      const d = haversineKm(lat, lng, y, x);
      if (d < minD) minD = d;
      if (d < 20) break;
    }
    if (minD <= 20 && (!ctx.nearestMainRoad || minD < ctx.nearestMainRoad.km)) {
      ctx.nearestMainRoad = { name: ln.n, typeFa: fa, km: minD };
    }
  }

  // ── راه‌آهن ───────────────────────────────────────────────
  for (const ln of railwayFile.lines ?? []) {
    let minD = Infinity;
    for (const [x, y] of ln.c) {
      if (x < wMinLng || x > wMaxLng || y < wMinLat || y > wMaxLat) continue;
      const d = haversineKm(lat, lng, y, x);
      if (d < minD) minD = d;
      if (d < 25) break;
    }
    if (minD <= 25 && (!ctx.nearestRailway || minD < ctx.nearestRailway.km)) {
      ctx.nearestRailway = { name: ln.n, typeFa: 'راه‌آهن', km: minD };
    }
  }

  // کش
  contextCache.set(key, ctx);
  if (contextCache.size > CACHE_MAX) {
    const first = contextCache.keys().next().value;
    if (first !== undefined) contextCache.delete(first);
  }
  return ctx;
}

/** برچسب فارسی دسته‌های POI (برای نمایش). */
export function poiCategoryFa(cat: string): string {
  return POI_FA[cat] ?? cat;
}
