/**
 * P0 — منیفست‌های اعلانی منابع.
 *
 * این فایل «تنها منبع حقیقت» برای فرادادهٔ منابع است. افزودن منبع جدید
 * یعنی افزودن یک ورودی اینجا (+ اختیاری یک کانکتور در connectors.ts).
 * هر ورودی با شناسهٔ رجیستری موجود و کد شاخص گره می‌خورد تا یک
 * رجیستر اعلانی واحد باشد (بدون چهار رجیستر موازی).
 */

import type { SourceFeed, SourceManifest } from './types';

export const SOURCE_MANIFESTS: SourceManifest[] = [
  {
    id: 'open-meteo-air',
    title: 'Open-Meteo — کیفیت هوا',
    registryId: 'OPEN_METEO',
    transport: 'http-json',
    endpoint: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    auth: { scheme: 'none' },
    spatial: 'point',
    temporal: { cadence: 'hourly', ttlMs: 15 * 60 * 1000, staleTtlMs: 6 * 60 * 60 * 1000, historical: true },
    license: { name: 'CC-BY-4.0', attribution: 'Open-Meteo.com', commercial: true, url: 'https://open-meteo.com/en/license' },
    feeds: [
      { variable: 'pm2_5', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 5, worst: 75, weight: 1 } },
      { variable: 'nitrogen_dioxide', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 15, worst: 120, weight: 0.5 } },
      { variable: 'pm10', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 15, worst: 150, weight: 0.5 } },
      { variable: 'ozone', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 40, worst: 180, weight: 0.5 } },
      { variable: 'sulphur_dioxide', unit: 'µg/m³' },
    ],
    role: 'score_eligible',
    quality: { minReliability: 4, gates: ['point_within_aoi'], neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
  },
  {
    id: 'open-meteo-climate',
    title: 'Open-Meteo — آرشیو اقلیمی',
    registryId: 'OPEN_METEO',
    transport: 'http-json',
    endpoint: 'https://archive-api.open-meteo.com/v1/archive',
    auth: { scheme: 'none' },
    spatial: 'point',
    temporal: { cadence: 'daily', ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 7 * 24 * 60 * 60 * 1000, historical: true },
    license: { name: 'CC-BY-4.0', attribution: 'Open-Meteo.com / ERA5', commercial: true },
    feeds: [
      { variable: 'temperature_2m_mean', indicatorCode: 'N5', unit: '°C' },
      { variable: 'precipitation_sum', indicatorCode: 'N5', unit: 'mm' },
      { variable: 'relative_humidity_2m_mean', unit: '%' },
    ],
    role: 'evidence_only',
    quality: { minReliability: 4, neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    notes: 'آرشیو اقلیمی برای شاهد تاب‌آوری؛ هرگز جای پیمایش را نمی‌گیرد.',
  },
  {
    id: 'worldbank',
    title: 'بانک جهانی (WDI) — بنچمارک کلان',
    registryId: 'WORLD_BANK',
    transport: 'http-json',
    endpoint: 'https://api.worldbank.org/v2',
    auth: { scheme: 'none' },
    spatial: 'national',
    temporal: { cadence: 'annual', ttlMs: 7 * 24 * 60 * 60 * 1000, staleTtlMs: 60 * 24 * 60 * 60 * 1000, historical: true },
    license: { name: 'CC-BY-4.0', attribution: 'World Bank Open Data', commercial: true },
    feeds: [
      { variable: 'NY.GDP.MKTP.KD.ZG', indicatorCode: 'E1', unit: '%' },
      { variable: 'SL.UEM.TOTL.ZS', indicatorCode: 'H3', unit: '%' },
      { variable: 'SP.URB.TOTL.IN.ZS', indicatorCode: 'P1', unit: '%' },
      { variable: 'SP.DYN.LE00.IN', indicatorCode: 'H3', unit: 'years' },
      { variable: 'EN.GHG.CO2.PC.CE.AR5', indicatorCode: 'N3', unit: 't/capita' },
    ],
    role: 'evidence_only',
    quality: { minReliability: 4, neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    notes: 'مقیاس ملی است؛ فقط به‌عنوان بنچمارک/زمینه وارد دفتر شواهد می‌شود، نه امتیاز محله.',
  },
  {
    id: 'who-gho',
    title: 'WHO GHO — سلامت',
    registryId: 'GHO',
    transport: 'http-json',
    endpoint: 'https://ghoapi.azureedge.net/api',
    auth: { scheme: 'none' },
    spatial: 'national',
    temporal: { cadence: 'annual', ttlMs: 7 * 24 * 60 * 60 * 1000, staleTtlMs: 60 * 24 * 60 * 60 * 1000, historical: true },
    license: { name: 'CC-BY-NC-SA-3.0-IGO', attribution: 'WHO Global Health Observatory', commercial: false },
    feeds: [
      { variable: 'WHS6_102', indicatorCode: 'P4', unit: 'per 10k' },
      { variable: 'HWF_0006', indicatorCode: 'P4', unit: 'per 10k' },
      { variable: 'GHED_CHEGDP_SHA2011', indicatorCode: 'G2', unit: '% GDP' },
    ],
    role: 'evidence_only',
    quality: { minReliability: 4, neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'REQUIRES_REVIEW',
    fallbacks: ['worldbank'],
    notes: 'مجوز NC: خروجی نیازمند بازبینی و غیرتجاری است.',
  },
  {
    id: 'osm-pois',
    title: 'OpenStreetMap — نقاط خدماتی (Overpass)',
    registryId: 'OSM_OVERPASS',
    transport: 'overpass',
    endpoint: 'https://overpass-api.de/api/interpreter',
    auth: { scheme: 'none' },
    spatial: 'point',
    temporal: { cadence: 'monthly', ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 30 * 24 * 60 * 60 * 1000 },
    license: { name: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', commercial: true },
    feeds: [
      { variable: 'poi_education', indicatorCode: 'R3', unit: 'count', proxy: true, scoring: { best: 12, worst: 0 } },
      { variable: 'poi_health', indicatorCode: 'P4', unit: 'count', proxy: true, scoring: { best: 25, worst: 0 } },
      { variable: 'poi_commerce', indicatorCode: 'E2', unit: 'count', proxy: true, scoring: { best: 120, worst: 0 } },
      { variable: 'poi_culture', indicatorCode: 'C1', unit: 'count', proxy: true, scoring: { best: 8, worst: 0 } },
      { variable: 'poi_transport', indicatorCode: 'P5', unit: 'count', proxy: true, scoring: { best: 30, worst: 0 } },
    ],
    role: 'score_eligible',
    quality: { minReliability: 3, gates: ['bbox_within_aoi'], neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    fallbacks: ['osm-local-pbf'],
    notes: 'کامل‌بودن OSM در ایران ناهمگون است؛ در نبود داده، خروجی «کمبود داده» می‌شود نه صفر.',
  },
  {
    id: 'osm-walkability',
    title: 'OpenStreetMap — پیاده‌مداری و شبکه معابر',
    registryId: 'OSM_OVERPASS',
    transport: 'overpass',
    endpoint: 'https://overpass-api.de/api/interpreter',
    auth: { scheme: 'none' },
    spatial: 'point',
    temporal: { cadence: 'monthly', ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 30 * 24 * 60 * 60 * 1000 },
    license: { name: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', commercial: true },
    feeds: [
      { variable: 'walkability_score', indicatorCode: 'N1', unit: '0..100', proxy: true, scoring: { best: 85, worst: 10 } },
      { variable: 'walkability_score', indicatorCode: 'P2', unit: '0..100', proxy: true, scoring: { best: 85, worst: 10 } },
    ],
    role: 'score_eligible',
    quality: { minReliability: 3, gates: ['bbox_within_aoi'], neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
  },
  {
    id: 'healthsites',
    title: 'Healthsites.io — تأسیسات سلامت',
    registryId: 'HEALTHSITES',
    transport: 'http-json',
    // v2 بازنشسته شده است و به‌جای JSON یک پیام متنی برمی‌گرداند؛ v3 به کلید نیاز دارد
    // (پارامتر پرس‌وجوی api-key). بدون کلید، مسیر اعلامی «osm-pois» استفاده می‌شود.
    endpoint: 'https://healthsites.io/api/v3/facilities/',
    auth: { scheme: 'query', envVar: 'HEALTHSITES_API_KEY', param: 'api-key' },
    spatial: 'point',
    temporal: { cadence: 'monthly', ttlMs: 7 * 24 * 60 * 60 * 1000, staleTtlMs: 30 * 24 * 60 * 60 * 1000 },
    license: { name: 'ODbL-1.0', attribution: 'Healthsites.io / © OpenStreetMap contributors', commercial: true },
    feeds: [
      { variable: 'health_facilities', indicatorCode: 'P4', unit: 'count', proxy: true, scoring: { best: 25, worst: 0, weight: 0.5 } },
    ],
    role: 'score_eligible',
    quality: { minReliability: 3, gates: ['point_within_aoi'], neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    fallbacks: ['osm-pois'],
    notes: 'بدون HEALTHSITES_API_KEY منبع پیکربندی‌نشده است و به مسیر اعلامی osm-pois (Overpass → PBF محلی) می‌رود.',
  },
  {
    id: 'satellite-stac',
    title: 'Copernicus / Earth-Search — متادیتای Sentinel',
    registryId: 'SENTINEL2',
    transport: 'stac',
    endpoint: 'https://earth-search.aws.element84.com/v1/search',
    auth: { scheme: 'none' },
    spatial: 'bbox',
    temporal: { cadence: 'daily', ttlMs: 60 * 60 * 1000, staleTtlMs: 24 * 60 * 60 * 1000, historical: true },
    license: { name: 'Copernicus', attribution: 'Contains modified Copernicus Sentinel data', commercial: true },
    feeds: [
      { variable: 'scene_count', indicatorCode: 'N2', unit: 'count' },
      { variable: 'scene_count', indicatorCode: 'N3', unit: 'count' },
    ],
    role: 'evidence_only',
    quality: { minReliability: 4, neverZeroFills: true },
    automationClass: 'B_PUBLIC_SEMI_AUTOMATIC',
    allowedOutput: 'REQUIRES_REVIEW',
    notes: 'فقط فهرست صحنه؛ استخراج شاخص (NDVI) در خط لولهٔ COG انجام می‌شود.',
  },
  {
    id: 'openaq',
    title: 'OpenAQ — کیفیت هوای ایستگاهی (v3)',
    registryId: 'OPENAQ',
    transport: 'http-json',
    endpoint: 'https://api.openaq.org/v3/locations',
    auth: { scheme: 'header', envVar: 'OPENAQ_API_KEY', param: 'X-API-Key' },
    spatial: 'point',
    temporal: { cadence: 'hourly', ttlMs: 30 * 60 * 1000, staleTtlMs: 12 * 60 * 60 * 1000, historical: true },
    license: { name: 'CC-BY-4.0', attribution: 'OpenAQ', commercial: true, url: 'https://openaq.org/about/licenses/' },
    feeds: [
      { variable: 'pm25_station', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 5, worst: 75, weight: 1.5 } },
      { variable: 'pm10_station', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 15, worst: 150, weight: 0.5 } },
      { variable: 'no2_station', indicatorCode: 'N3', unit: 'µg/m³', scoring: { best: 15, worst: 120, weight: 0.5 } },
      { variable: 'station_count', unit: 'count' },
    ],
    role: 'score_eligible',
    quality: { minReliability: 4, gates: ['station_within_aoi'], neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    fallbacks: ['open-meteo-air'],
    notes: 'اندازه‌گیری زمینی ایستگاهی؛ وزن بالاتر از مدل شبکه‌ای Open-Meteo. بدون کلید، منبع به‌عنوان کمبود داده ثبت می‌شود.',
  },
  {
    id: 'firms',
    title: 'NASA FIRMS — آتش فعال (VIIRS NRT)',
    registryId: 'FIRMS',
    transport: 'http-json',
    // فایل جهانی پیش‌فرض است: فایل «جنوب آسیا» فقط ۵۴ تا ۱۰۲ درجهٔ شرقی را پوشش
    // می‌دهد و برای بخش بزرگی از ایران (مثل تهران در ۵۱ درجه) «صفر کاذب» می‌سازد.
    endpoint: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
    auth: { scheme: 'none' },
    spatial: 'bbox',
    temporal: { cadence: 'daily', ttlMs: 60 * 60 * 1000, staleTtlMs: 24 * 60 * 60 * 1000 },
    license: { name: 'Public-Domain-NASA', attribution: 'NASA FIRMS', commercial: true },
    feeds: [
      { variable: 'fire_hotspots', indicatorCode: 'N4', unit: 'count' },
      { variable: 'fire_frp_mw', unit: 'MW' },
    ],
    role: 'evidence_only',
    quality: { minReliability: 4, neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    notes: 'شمارش نقاط داغ آتش در پنجرهٔ محله — شاهد خطر، نه سنجش مستقیم شاخص N4. پیش‌فرض فایل کامل ۲۴ساعتهٔ جهانی است، چون فایل منطقهٔ جنوب آسیا فقط ۵۴ تا ۶۴ درجهٔ شرقی ایران را پوشش می‌دهد (تأیید تجربی). FIRMS_MAP_KEY پنجرهٔ bbox را سمت سرور می‌بندد.',
  },
  {
    id: 'osrm',
    title: 'OSRM — زمان سفر شبکهٔ معابر',
    registryId: 'OSRM',
    transport: 'http-json',
    endpoint: 'https://router.project-osrm.org/route/v1/driving',
    auth: { scheme: 'none' },
    spatial: 'point',
    temporal: { cadence: 'daily', ttlMs: 12 * 60 * 60 * 1000, staleTtlMs: 3 * 24 * 60 * 60 * 1000 },
    license: { name: 'BSD-2-Clause', attribution: 'OSRM / © OpenStreetMap contributors', commercial: true },
    feeds: [
      { variable: 'travel_time_health_min', indicatorCode: 'R1', unit: 'min', scoring: { best: 5, worst: 45 } },
      { variable: 'travel_time_education_min', indicatorCode: 'R3', unit: 'min', scoring: { best: 5, worst: 30 } },
      { variable: 'route_distance_km', unit: 'km' },
    ],
    role: 'score_eligible',
    quality: { minReliability: 4, gates: ['point_within_aoi'], neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    notes: 'زمان سفر واقعی روی شبکهٔ معابر به نزدیک‌ترین مرکز سلامت و آموزش — تطابق مستقیم با تعریف R1 و R3.',
  },
  {
    id: 'glofas-flood',
    title: 'GloFAS / Open-Meteo Flood — دبی رودخانه',
    registryId: 'GLOFAS',
    transport: 'http-json',
    endpoint: 'https://flood-api.open-meteo.com/v1/flood',
    auth: { scheme: 'none' },
    spatial: 'point',
    temporal: { cadence: 'daily', ttlMs: 6 * 60 * 60 * 1000, staleTtlMs: 2 * 24 * 60 * 60 * 1000, historical: true },
    license: { name: 'CC-BY-4.0', attribution: 'Open-Meteo / GloFAS (Copernicus EMS)', commercial: true },
    feeds: [
      { variable: 'river_discharge_max', indicatorCode: 'N5', unit: 'm³/s' },
      { variable: 'river_discharge_mean', unit: 'm³/s' },
    ],
    role: 'evidence_only',
    quality: { minReliability: 4, neverZeroFills: true },
    automationClass: 'A_PUBLIC_AUTOMATIC',
    allowedOutput: 'PROVISIONAL_PUBLIC',
    notes: 'دبی رودخانه شاهد تاب‌آوری سیل است؛ بدون آستانهٔ معتبر محلی هرگز به امتیاز N5 تبدیل نمی‌شود.',
  },
];

const MANIFEST_INDEX = new Map(SOURCE_MANIFESTS.map(m => [m.id, m]));

export function getManifest(id: string): SourceManifest | undefined {
  return MANIFEST_INDEX.get(id);
}

export function listManifests(): SourceManifest[] {
  return [...SOURCE_MANIFESTS];
}

/** همهٔ شناسه‌های رجیستری متناظر منابع اعلان‌شده */
export function declaredRegistryIds(): string[] {
  return [...new Set(SOURCE_MANIFESTS.map(m => m.registryId).filter((x): x is string => Boolean(x)))];
}

/** کدهای شاخصی که این منیفست تغذیه می‌کند */
export function indicatorsForSource(id: string): string[] {
  const manifest = getManifest(id);
  if (!manifest) return [];
  return [...new Set(manifest.feeds.map(f => f.indicatorCode).filter((x): x is string => Boolean(x)))];
}

/** متغیرهایی که واقعاً امتیاز شاخص می‌سازند (indicatorCode + scoring) */
export function scoredFeedsForSource(id: string): SourceFeed[] {
  const manifest = getManifest(id);
  if (!manifest || manifest.role !== 'score_eligible') return [];
  return manifest.feeds.filter(f => Boolean(f.indicatorCode) && Boolean(f.scoring));
}

/** شناسهٔ منبع‌هایی که مجاز به اثرگذاری روی امتیاز هستند */
export function scoreEligibleSourceIds(): string[] {
  return SOURCE_MANIFESTS.filter(m => m.role === 'score_eligible').map(m => m.id);
}

export interface ManifestValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * اعتبارسنجی: هر registryId باید در SOURCE_REGISTRY باشد و هر indicatorCode
 * در INDICATOR_SOURCE_REGISTRY — تا رجیسترهای موازی از هم واگرا نشوند.
 */
export function validateManifests(): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const manifest of SOURCE_MANIFESTS) {
    if (seen.has(manifest.id)) errors.push(`duplicate source id: ${manifest.id}`);
    seen.add(manifest.id);

    if (manifest.registryId && !manifest.registryId.startsWith('OPEN_METEO') && !manifest.registryId.startsWith('WORLD_BANK') && !manifest.registryId.startsWith('GHO') && !manifest.registryId.startsWith('OSM_OVERPASS') && !manifest.registryId.startsWith('HEALTHSITES') && !manifest.registryId.startsWith('SENTINEL2') && !manifest.registryId.startsWith('OPENAQ') && !manifest.registryId.startsWith('FIRMS') && !manifest.registryId.startsWith('OSRM') && !manifest.registryId.startsWith('GLOFAS')) {
      errors.push(`${manifest.id}: unknown registryId ${manifest.registryId}`);
    }
    if (manifest.registryId === 'FIELD' && manifest.role === 'score_eligible') {
      warnings.push(`${manifest.id}: منبع میدانی نباید score_eligible باشد`);
    }
    for (const feed of manifest.feeds) {
      if (feed.indicatorCode && !feed.indicatorCode.startsWith('M-CORE-') && !feed.indicatorCode.startsWith('TS-')) {
        errors.push(`${manifest.id}.${feed.variable}: unknown indicatorCode ${feed.indicatorCode}`);
      }
      if (feed.scoring && !feed.indicatorCode) {
        errors.push(`${manifest.id}.${feed.variable}: scoring بدون indicatorCode بی‌اثر است`);
      }
      if (feed.scoring && feed.scoring.best === feed.scoring.worst) {
        errors.push(`${manifest.id}.${feed.variable}: best و worst نمی‌توانند برابر باشند`);
      }
      if (feed.scoring?.weight !== undefined && !(feed.scoring.weight > 0)) {
        errors.push(`${manifest.id}.${feed.variable}: وزن باید مثبت باشد`);
      }
    }
    const scored = manifest.feeds.filter(f => f.indicatorCode && f.scoring);
    if (manifest.role === 'score_eligible' && scored.length === 0) {
      errors.push(`${manifest.id}: منبع score_eligible باید حداقل یک متغیر امتیازده داشته باشد`);
    }
    if (manifest.role === 'evidence_only' && scored.length > 0) {
      errors.push(`${manifest.id}: منبع evidence_only نباید متغیر امتیازده داشته باشد`);
    }
    if (manifest.quality.neverZeroFills !== true) {
      warnings.push(`${manifest.id}: neverZeroFills باید true باشد`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export interface ManifestSummary {
  id: string;
  title: string;
  transport: SourceManifest['transport'];
  spatial: SourceManifest['spatial'];
  role: SourceManifest['role'];
  auth: SourceManifest['auth']['scheme'];
  cadence: SourceManifest['temporal']['cadence'];
  license: string;
  commercial: boolean;
  feeds: number;
  indicators: string[];
  automationClass: SourceManifest['automationClass'];
  allowedOutput: SourceManifest['allowedOutput'];
}

export function toSummary(manifest: SourceManifest): ManifestSummary {
  return {
    id: manifest.id,
    title: manifest.title,
    transport: manifest.transport,
    spatial: manifest.spatial,
    role: manifest.role,
    auth: manifest.auth.scheme,
    cadence: manifest.temporal.cadence,
    license: manifest.license.name,
    commercial: manifest.license.commercial,
    feeds: manifest.feeds.length,
    indicators: [...new Set(manifest.feeds.map(f => f.indicatorCode).filter((x): x is string => Boolean(x)))],
    automationClass: manifest.automationClass,
    allowedOutput: manifest.allowedOutput,
  };
}
