// ============================================================
// ساخت پهنهٔ «نقطهٔ موردنظر» از مشاهدات واقعی برخط
// ------------------------------------------------------------
// دادهٔ واقعی (live) روی پایهٔ استانی (deriveZoneRaw) سوار می‌شود:
//  - کالبدی/هوا/معابر: مستقیماً از منابع برخط
//  - رفتاری/هنجاری: برآورد استانی قطعی (بدون پیمایش میدانی)
// این ترکیب «عملیاتی‌ترین» حالت ممکن است: هر متغیری که منبع
// عمومیِ برخط داشته باشد واقعی است؛ بقیه از پایهٔ استان.
// ============================================================
import type { ZoneMeta, ZoneRaw } from './types';
import { deriveZoneRaw } from './data';
import { PROVINCES_DATA } from '../data/iranProvincePaths';
import type { PointIngest } from './ingest';
import type { FullExtract, IndicatorSample } from './liveExtract';

export const POINT_ZONE_ID = 'PT-01';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * ساخت پهنهٔ نقطه از خروجی ingestPoint (+ کاتالوگ ۳۲۹ شاخص اختیاری).
 * id ثابت PT-01 تا در جدول/نقشه قابل ارجاع باشد؛ lat/lng واقعی کاربر.
 */
export function buildPointZone(ing: PointIngest, extract?: FullExtract): { zone: ZoneMeta; raw: ZoneRaw } {
  const province = PROVINCES_DATA.find((p) => p.id === ing.provinceId);
  const name =
    ing.address?.value.name ||
    ing.address?.value.neighbourhood ||
    ing.address?.value.suburb ||
    ing.address?.value.city ||
    'نقطهٔ انتخابی';

  // تشخیص شهری/روستایی از چگالی مشاهده‌شده (OSM):
  // بافت روستایی = ابنیه و کسب‌وکار کم در بافر ۱٬۰۰۰–۱٬۵۰۰ متر
  const bld = ing.osm?.value.buildings ?? 120;
  const shp = ing.osm?.value.shops ?? 15;
  const isRural = bld < 60 && shp < 10;

  const zone: ZoneMeta = {
    id: POINT_ZONE_ID,
    name,
    city: ing.address?.value.city || province?.name || '—',
    provinceId: ing.provinceId,
    provinceFa: ing.provinceFa,
    anchor: ing.address?.value.suburb || ing.address?.value.city || 'مرکز جغرافیایی نقطه',
    anchorType: 'imamzadeh',
    households: 400,
    population: 1420,
    lat: ing.lat,
    lng: ing.lng,
    scale: isRural ? 'rural' : 'urban',
    profile: 'mid',
  };

  // پایهٔ قطعی استانی
  const base = deriveZoneRaw(zone);
  const raw: ZoneRaw = { ...base };

  // ── سوارکردن دادهٔ واقعی برخط ──────────────────────────
  if (ing.air && ing.air.status === 'live') {
    raw.pm25 = ing.air.value.pm25;
    raw.no2 = ing.air.value.no2;
    raw.so2 = ing.air.value.so2;
    raw.aerosol = clamp(ing.air.value.pm10 / 250, 0.05, 0.75); // PM10 → هوایویز (پراکسی)
  }

  if (ing.weather && ing.weather.status === 'live') {
    // LST شهری ≈ دمای هوا + ۱۲°C (اقلیم‌شناسی محافظه‌کار)
    raw.lst = clamp(ing.weather.value.temperature + 12, 24, 54);
    // شاخص SPEI مبتنی بر بارش نسبی (پراکسی خشک‌سالی)
    const p = ing.weather.value.precipitation;
    raw.spei = clamp((p - 1.2) * 1.4, -2.8, 1.6);
    raw.hazardExposure = clamp(0.15 + Math.min(p / 8, 0.5) + (ing.weather.value.uvIndex > 9 ? 0.1 : 0), 0.05, 0.9);
  }

  if (ing.osm && ing.osm.status === 'live') {
    const o = ing.osm.value;
    const areaKm2 = Math.PI * 1.5 * 1.5; // ۷٫۰۷ km²

    // سلامت/دسترسی
    raw.clinicDensity = clamp(o.health / areaKm2, 0, 8);
    raw.pharmacyDensity = clamp(o.health / (areaKm2 * 2), 0, 6);
    raw.healthCentersPerCap = clamp(o.health / 2.2, 0.5, 12);
    raw.hospitalDist = clamp(14 - o.health * 1.1, 0.5, 20);
    raw.foodShops = clamp(o.shops / areaKm2, 0.5, 22);
    raw.bankAtmDensity = clamp(o.finance / areaKm2, 0, 9);
    raw.marketDensity = clamp(o.market / areaKm2, 0, 6);
    raw.schoolDensity = clamp(o.schools / areaKm2, 0.3, 9);
    raw.libraryDensity = clamp(o.schools / (areaKm2 * 3), 0, 3.5);
    raw.busStops = clamp(o.busStops, 0.5, 30);
    raw.fuelStations = clamp(o.market / 6, 0, 6);
    raw.worshipDensity = clamp(o.worship / areaKm2, 0.4, 10);
    raw.ngoDensity = clamp(o.schools / 4, 0, 3.5);
    raw.parkPerCap = clamp(o.parks * 1.5, 0.2, 14);
    raw.multiPurposeSpaces = clamp(o.schools / 2, 0.2, 9);

    // کالبد/بافت
    raw.builtShare = clamp(Math.min(o.buildings / 700, 1) * 0.95, 0.1, 0.95);
    raw.settlementFootprint = raw.builtShare;
    raw.fineGrainShare = clamp(1.05 - raw.builtShare, 0.05, 0.85);
    raw.populationDensity = clamp(o.buildings * 22, 300, 24000);
    raw.intersectionDensity = clamp(o.roads / 6, 5, 160);
    raw.connectivity = clamp(Math.min(o.roads / 900, 1) * 0.95, 0.2, 0.96);
    raw.pedestrianInfra = clamp(Math.min(o.roads / 1100, 1) * 0.9, 0.05, 0.9);
    raw.permeability = clamp(0.45 + Math.min(o.roads / 1200, 0.5), 0.2, 0.95);
    raw.relatedVariety = clamp(0.6 + Math.log10(o.shops + 1) * 0.6, 0.3, 2.4);
    raw.businessDiversity = clamp(0.5 + Math.log10(o.shops + o.market + 1) * 0.6, 0.2, 2.2);
    raw.economicDynamism = clamp(0.3 + Math.log10(o.shops + o.market + 1) * 0.25, 0.1, 0.95);
  }

  // ── سوارکردن خروجی کاتالوگ مادر (۳۲۹ شاخص، نگاشت rawTarget) ──
  if (extract && extract.samples.length > 0) {
    applySamplesToRaw(raw, extract.samples);
  }

  return { zone, raw };
}

/**
 * اعمال مقادیر شاخص‌های استخراج‌شده روی فیلدهای خام پایپلاین.
 * اولویت: برخط > برآورد > شبیه‌سازی (برای هر فیلد، میانگین همان سطح).
 */
function applySamplesToRaw(raw: ZoneRaw, samples: IndicatorSample[]): void {
  const byRaw = new Map<string, { live: number[]; proxy: number[]; sim: number[] }>();
  for (const s of samples) {
    if (!s.rawTarget || s.value == null || !Number.isFinite(s.value)) continue;
    const slot = byRaw.get(s.rawTarget) ?? { live: [], proxy: [], sim: [] };
    if (s.status === 'live') slot.live.push(s.value);
    else if (s.status === 'proxy') slot.proxy.push(s.value);
    else slot.sim.push(s.value);
    byRaw.set(s.rawTarget, slot);
  }
  for (const [field, slot] of byRaw) {
    const src = slot.live.length ? slot.live : slot.proxy.length ? slot.proxy : slot.sim;
    if (!src.length) continue;
    const mean = src.reduce((s, v) => s + v, 0) / src.length;
    const key = field as keyof ZoneRaw;
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) {
      (raw as unknown as Record<string, number>)[key] = clamp(mean, 0.001, 50000);
    }
  }
}
