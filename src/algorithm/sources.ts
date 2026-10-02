// ============================================================
// رجیستری منابع عمومی داده + ورودی‌گیری برخط (Live Ingestion)
// بخش ۳ و ۱۴.۲ سند: تنها منابع عمومی/باز مجازند.
// Open-Meteo (کیفیت هوا / اقلیم) و World Bank (شاخص‌های کلان)
// با «بازگشت نرم» به دادهٔ شبیه‌سازی‌شدهٔ قطعی در صورت قطعی شبکه.
// ============================================================
import type { Provenance, ZoneMeta, ZoneRaw } from './types';

// ─── رجیستری منابع عمومی (allow-list) ────────────────────────
export interface SourceEntry {
  id: string;
  name: string;
  url: string;
  access: 'public' | 'open';
  formats: string[];
  category: string;
}

export const SOURCE_REGISTRY: SourceEntry[] = [
  { id: 'SCI', name: 'مرکز آمار ایران', url: 'https://www.amar.org.ir', access: 'public', formats: ['xlsx', 'pdf', 'html'], category: 'سرشماری' },
  { id: 'IRANOPENDATA', name: 'درگاه داده‌باز ایران', url: 'https://iranopendata.org/fa/', access: 'open', formats: ['csv', 'xlsx', 'api'], category: 'داده‌باز' },
  { id: 'OSM_OVERPASS', name: 'OpenStreetMap (Overpass)', url: 'https://overpass-api.de/api/interpreter', access: 'open', formats: ['geojson', 'json'], category: 'مکانی/POI' },
  { id: 'OSMNX', name: 'OSMnx (گراف معابر)', url: 'https://osmnx.readthedocs.io/', access: 'open', formats: ['api'], category: 'شبکه معابر' },
  { id: 'VIIRS', name: 'نور شبانه NASA/NOAA', url: 'https://eogdata.mines.edu/products/vnl/', access: 'public', formats: ['tif'], category: 'ماهواره‌ای' },
  { id: 'SENTINEL2', name: 'Sentinel-2 (Copernicus)', url: 'https://scihub.copernicus.eu/', access: 'public', formats: ['tif'], category: 'ماهواره‌ای' },
  { id: 'SENTINEL5P', name: 'Sentinel-5P (کیفیت هوا)', url: 'https://scihub.copernicus.eu/', access: 'public', formats: ['tif'], category: 'ماهواره‌ای' },
  { id: 'MODIS', name: 'MODIS (LST/NDVI)', url: 'https://lpdaac.usgs.gov/', access: 'public', formats: ['tif'], category: 'ماهواره‌ای' },
  { id: 'LANDSAT', name: 'Landsat 8/9 (USGS)', url: 'https://earthexplorer.usgs.gov/', access: 'public', formats: ['tif'], category: 'ماهواره‌ای' },
  { id: 'GHSL', name: 'JRC GHSL', url: 'https://ghsl.jrc.ec.europa.eu/', access: 'public', formats: ['tif'], category: 'رستری' },
  { id: 'WSF', name: 'DLR World Settlement Footprint', url: 'https://geoservice.dlr.de/', access: 'public', formats: ['tif'], category: 'رستری' },
  { id: 'WORLDPOP', name: 'WorldPop', url: 'https://www.worldpop.org/', access: 'open', formats: ['tif', 'csv'], category: 'جمعیت' },
  { id: 'GSW', name: 'JRC Global Surface Water', url: 'https://global-surface-water.appspot.com/', access: 'public', formats: ['tif'], category: 'آب' },
  { id: 'SPEI', name: 'SPEI (CSIC)', url: 'https://spei.csic.es/', access: 'public', formats: ['nc', 'csv'], category: 'اقلیم' },
  { id: 'GEOLOGY', name: 'سازمان زمین‌شناسی', url: 'https://www.gsi.ir/', access: 'public', formats: ['shp'], category: 'مخاطرات' },
  { id: 'OOKLA', name: 'Ookla Open Data', url: 'https://www.ookla.com/ookla-for-good/open-data', access: 'open', formats: ['csv'], category: 'پهن‌باند' },
  { id: 'OPENCELLID', name: 'OpenCelliD', url: 'https://opencellid.org/', access: 'open', formats: ['csv'], category: 'دکل همراه' },
  { id: 'HEALTHSITES', name: 'Healthsites.io', url: 'https://healthsites.io/', access: 'open', formats: ['geojson'], category: 'سلامت' },
  { id: 'JMP', name: 'WHO/UNICEF JMP', url: 'https://washdata.org/', access: 'public', formats: ['csv', 'api'], category: 'آب و بهداشت' },
  { id: 'WORLD_BANK', name: 'بانک جهانی (WDI)', url: 'https://api.worldbank.org/v2/', access: 'public', formats: ['api', 'csv'], category: 'کلان' },
  { id: 'UIS', name: 'UNESCO UIS', url: 'https://data.uis.unesco.org/', access: 'public', formats: ['csv', 'api'], category: 'آموزش' },
  { id: 'IPUMS', name: 'IPUMS International', url: 'https://international.ipums.org/', access: 'open', formats: ['dta', 'csv'], category: 'ریزداده' },
  { id: 'ACLED', name: 'ACLED (رویدادها)', url: 'https://acleddata.com/', access: 'open', formats: ['csv'], category: 'تنش' },
  { id: 'GHO', name: 'WHO GHO', url: 'https://www.who.int/data/gho', access: 'public', formats: ['csv', 'api'], category: 'سلامت' },
  { id: 'GBD', name: 'IHME GBD', url: 'https://vizhub.healthdata.org/gbd-results/', access: 'open', formats: ['csv'], category: 'سلامت' },
  { id: 'ICT', name: 'آمار ICT مرکز آمار', url: 'https://www.amar.org.ir', access: 'public', formats: ['pdf', 'xlsx'], category: 'فناوری' },
  { id: 'FIELD', name: 'پیمایش میدانی', url: '', access: 'public', formats: ['survey'], category: 'میدانی' },
  { id: 'OPEN_METEO', name: 'Open-Meteo (کیفیت هوا و اقلیم)', url: 'https://open-meteo.com/', access: 'open', formats: ['api'], category: 'اقلیم/هوا' },
  { id: 'NOMINATIM', name: 'Nominatim (ژئوکد معکوس OSM)', url: 'https://nominatim.openstreetmap.org/', access: 'open', formats: ['api'], category: 'مکانی/ژئوکد' },
  { id: 'OPENAQ', name: 'OpenAQ (کیفیت هوای ایستگاهی)', url: 'https://api.openaq.org/', access: 'open', formats: ['api'], category: 'کیفیت هوا' },
  { id: 'FIRMS', name: 'NASA FIRMS (آتش فعال ماهواره‌ای)', url: 'https://firms.modaps.eosdis.nasa.gov/', access: 'open', formats: ['csv', 'api'], category: 'ماهواره‌ای/مخاطرات' },
  { id: 'OSRM', name: 'OSRM (مسیریابی شبکه معابر)', url: 'https://project-osrm.org/', access: 'open', formats: ['api'], category: 'شبکه معابر' },
  { id: 'GLOFAS', name: 'GloFAS / Open-Meteo Flood (سیل رودخانه‌ای)', url: 'https://open-meteo.com/en/docs/flood-api', access: 'open', formats: ['api'], category: 'آب/سیل' },
];

export const ALLOWED_SOURCE_KEYS = new Set(SOURCE_REGISTRY.map((s) => s.id));

/** منابع خارج از رجیستری رد می‌شوند (الزام ۱۲.۲) */
export function assertSourceAllowed(sourceKey: string): void {
  if (!ALLOWED_SOURCE_KEYS.has(sourceKey)) {
    throw new Error(`منبع «${sourceKey}» در فهرست منابع عمومی مجاز نیست (SourceNotAllowedError).`);
  }
}

export function sourceInfo(sourceKey: string): SourceEntry {
  const s = SOURCE_REGISTRY.find((x) => x.id === sourceKey);
  return s ?? { id: sourceKey, name: sourceKey, url: '', access: 'public', formats: [], category: '—' };
}

// ─── PRNG قطعی برای fallback شبیه‌سازی‌شده ───────────────────
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

/** بازگشت نرم: مقادیر شبیه‌سازی‌شدهٔ قطعی بر پایهٔ کد پهنه */
function simulatedAirQuality(zone: ZoneMeta): { pm25: number; no2: number; so2: number; aerosol: number } {
  const rnd = mulberry32(hashString(zone.id + ':air'));
  const base = zone.provinceId === 'KHZ' || zone.provinceId === 'HOR' ? 0.72 : zone.provinceId === 'GIL' || zone.provinceId === 'MAZ' ? 0.34 : 0.52;
  return {
    pm25: clamp(12 + 83 * (base + (rnd() - 0.5) * 0.3), 12, 95),
    no2: clamp(10 + 65 * (base + (rnd() - 0.5) * 0.3), 10, 75),
    so2: clamp(2 + 20 * (base + (rnd() - 0.5) * 0.3), 2, 22),
    aerosol: clamp(0.05 + 0.7 * (base + (rnd() - 0.5) * 0.3), 0.05, 0.75),
  };
}

// ─── ورودی‌گیری برخط با فچ امن (AbortController + timeout) ──
const TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface AirQualityResponse {
  current?: { pm2_5?: number; nitrogen_dioxide?: number; sulphur_dioxide?: number };
  current_units?: Record<string, string>;
}

interface WorldBankResponse {
  [0]?: { lastupdated?: string };
  [1]?: Array<{ value: number | null; date?: string }>;
}

export interface LiveIngestResult {
  overrides: Record<string, Partial<ZoneRaw>>; // keyed by zone.id
  provenance: Provenance[];
  warnings: string[];
}

/**
 * ورودی‌گیری برخط از منابع عمومی:
 * ۱) Open-Meteo کیفیت هوا برای هر استان (نمایندهٔ پهنه‌ها)
 * ۲) بانک جهانی: رشد GDP ایران (شاخص کلان برای برچسب اعتماد)
 * در صورت قطعی/خطا، به دادهٔ شبیه‌سازی‌شدهٔ قطعی بازمی‌گردد و
 * منشأ هر منبع در provenance ثبت می‌شود (live | simulated).
 */
export async function ingestLiveData(zones: ZoneMeta[]): Promise<LiveIngestResult> {
  const overrides: Record<string, Partial<ZoneRaw>> = {};
  const provenance: Provenance[] = [];
  const warnings: string[] = [];

  // ── ۱) کیفیت هوا (Open-Meteo) — یک درخواست برای هر استان ──
  const provinces = [...new Map(zones.map((z) => [z.provinceId, z])).values()];

  const aqResults = await Promise.allSettled(
    provinces.map(async (prov) => {
      const url =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${prov.lat.toFixed(3)}&longitude=${prov.lng.toFixed(3)}` +
        `&current=pm2_5,nitrogen_dioxide,sulphur_dioxide`;
      const data = (await fetchJson(url)) as AirQualityResponse;
      const c = data?.current;
      if (!c || c.pm2_5 == null) throw new Error('پاسخ ناقص Open-Meteo');
      return { provinceId: prov.provinceId, values: { pm25: c.pm2_5, no2: c.nitrogen_dioxide ?? 30, so2: c.sulphur_dioxide ?? 8 } };
    }),
  );

  const aqByProvince = new Map<string, { pm25: number; no2: number; so2: number }>();
  aqResults.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      aqByProvince.set(r.value.provinceId, r.value.values);
    } else {
      warnings.push(`دریافت کیفیت هوای برخط برای «${provinces[i].provinceId}» ناموفق بود؛ از دادهٔ شبیه‌سازی‌شده استفاده شد.`);
    }
  });

  const aqFetchedAt = new Date().toISOString();
  if (aqByProvince.size > 0) {
    provenance.push({
      sourceKey: 'OPEN_METEO',
      sourceFa: 'Open-Meteo (کیفیت هوا)',
      status: aqByProvince.size === provinces.length ? 'live' : 'simulated',
      detail: `${aqByProvince.size} از ${provinces.length} استان — PM2.5/NO2/SO2 برخط`,
      fetchedAt: aqFetchedAt,
    });
  }

  for (const zone of zones) {
    const live = aqByProvince.get(zone.provinceId);
    if (live) {
      const rnd = mulberry32(hashString(zone.id + ':jitter'));
      overrides[zone.id] = {
        pm25: clamp(live.pm25 + (rnd() - 0.5) * 6, 12, 95),
        no2: clamp(live.no2 + (rnd() - 0.5) * 4, 10, 75),
        so2: clamp(live.so2 + (rnd() - 0.5) * 1.5, 2, 22),
      };
    } else {
      overrides[zone.id] = simulatedAirQuality(zone);
    }
  }

  // ── ۲) بانک جهانی: رشد GDP ایران ─────────────────────────
  try {
    const url =
      'https://api.worldbank.org/v2/country/IRN/indicator/NY.GDP.MKTP.KD.ZG' +
      '?format=json&per_page=4&date=2021:2025';
    const wb = (await fetchJson(url)) as WorldBankResponse;
    const series = wb?.[1]?.filter((x) => x.value != null) ?? [];
    if (series.length > 0) {
      provenance.push({
        sourceKey: 'WORLD_BANK',
        sourceFa: 'بانک جهانی (WDI)',
        status: 'live',
        detail: `رشد GDP ایران: آخرین مقدار ${series[0].value?.toFixed(1)}٪ (${series[0].date})`,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch {
    warnings.push('دریافت دادهٔ بانک جهانی ناموفق بود؛ فقط برای برچسب اعتماد (غیرمؤثر در نمرات) ذخیره نشد.');
  }

  return { overrides, provenance, warnings };
}
