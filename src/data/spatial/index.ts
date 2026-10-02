// ---------------------------------------------------------------------------
// داده‌های مکانی یکپارچه‌شده از پوشهٔ geojson/
// ---------------------------------------------------------------------------
// این ماژول، داده‌های فشردهٔ استخراج‌شده از «geojson/» را با الگوی ?url + fetch
// (همان الگوی src/lib/hakimGrounding.ts) بارگذاری می‌کند. خروجی‌ها توسط
// `python scripts/extract_geojson_integration.py` تولید می‌شوند و هرگز به
// باندل تزریق نمی‌شوند — فقط هنگام نیاز fetch می‌شوند.

import provinceGeoStatsUrl from './province-geo-stats.json?url';
import healthFacilitiesUrl from './health-facilities.json?url';
import transportPointsUrl from './transport-points.json?url';
import hospitalAccessUrl from './hospital-access.json?url';
import infographicUrl from './infographic-province.json?url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvinceGeoStat {
  code: string;
  nameFa: string;
  totalFeatures: number | null;
  educationCount: number | null;
  /** تعداد ردپای ساختمان OSM (استخراج جریانی از فایل ۳۶۴MB) */
  buildings?: number;
  byGroup: Record<string, number>;
  socioeconomic: {
    population_2016?: number;
    population_2025_estimate?: number;
    share_national_pop_2016_pct?: number;
    gdp_share_percent?: number | null;
    in_top10_gdp_1398?: boolean;
    mapped_industrial?: number;
  };
  environmental: {
    precip_mm?: number;
    water_stress?: string;
    aqi_2024?: number;
    temp_c?: number;
  };
  satellite: {
    mode?: string;
    ndvi_mean?: number;
    deprivation_level?: string;
  };
}

export interface ProvinceGeoStatsFile {
  generatedAtUtc: string;
  source: string;
  provinces: Record<string, ProvinceGeoStat>;
}

export interface HealthPoint {
  lat: number;
  lng: number;
  type: string;
  name: string | null;
}

export interface HealthFacilitiesFile {
  generatedAtUtc: string;
  source: string;
  totalFeatures: number;
  pointFeatures: number;
  polygonFeatures: number;
  assignedToProvince: number;
  unassigned: number;
  categories: string[];
  byProvince: Record<string, number>;
  byProvinceCategory: Record<string, { categories: Record<string, number> }>;
  samplePoints: HealthPoint[];
}

export interface TransportPoint {
  lat: number;
  lng: number;
  name: string | null;
  type: string | null;
}

export interface TransportPointsFile {
  generatedAtUtc: string;
  source: string;
  airports: { total: number; points: TransportPoint[] };
  seaPorts: { total: number; points: TransportPoint[] };
  education: { total: number; byProvince: Record<string, number>; points: TransportPoint[] };
  financial: { total: number; byProvince: Record<string, number>; points: TransportPoint[] };
  populatedPlaces: { total: number; points: TransportPoint[] };
}

export interface HospitalAccessMetric {
  withinMin: number | null;
  withinSharePct: number | null;
  medianRangeMin: number | null;
  medianSharePct: number | null;
}

export interface HospitalAccessFile {
  generatedAtUtc: string;
  source: string;
  nameToCode: Record<string, string>;
  provinces: Record<
    string,
    {
      nameEn: string;
      code?: string;
      population: number;
      بیمارستان?: HospitalAccessMetric;
      'بهداشت اولیه'?: HospitalAccessMetric;
    }
  >;
}

export interface InfographicIndicator {
  label: string;
  value: string;
  unit: string;
  year: string;
  rank: number | null;
  national: string;
  source: string;
}

export interface InfographicProvince {
  nameFa: string;
  indicators: InfographicIndicator[];
}

export interface InfographicRanking {
  label: string;
  rows: Array<[string, string]>;
}

export interface InfographicFile {
  generatedAtUtc: string;
  source: string;
  byProvince: Record<string, InfographicProvince>;
  rankings: InfographicRanking[];
}

export interface SpatialData {
  provinceStats: ProvinceGeoStatsFile;
  health: HealthFacilitiesFile;
  transport: TransportPointsFile;
  hospitalAccess: HospitalAccessFile;
}

export interface SpatialDataWithInfographic extends SpatialData {
  infographic: InfographicFile;
}

// ---------------------------------------------------------------------------
// Loader (cached)
// ---------------------------------------------------------------------------

let cache: SpatialData | null = null;
let infographicCache: InfographicFile | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load spatial data: ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

/** بارگذاری یکبارهٔ همهٔ داده‌های مکانی (نتیجه کش می‌شود). */
export async function loadSpatialData(): Promise<SpatialData> {
  if (cache) return cache;
  const [provinceStats, health, transport, hospitalAccess] = await Promise.all([
    fetchJson<ProvinceGeoStatsFile>(provinceGeoStatsUrl),
    fetchJson<HealthFacilitiesFile>(healthFacilitiesUrl),
    fetchJson<TransportPointsFile>(transportPointsUrl),
    fetchJson<HospitalAccessFile>(hospitalAccessUrl),
  ]);
  cache = { provinceStats, health, transport, hospitalAccess };
  return cache;
}

/** بارگذاری دادهٔ اینفوگراف استانی (نتیجه کش می‌شود؛ ~۱۳۰KB جداگانه). */
export async function loadInfographicData(): Promise<InfographicFile> {
  if (infographicCache) return infographicCache;
  infographicCache = await fetchJson<InfographicFile>(infographicUrl);
  return infographicCache;
}

/** یافتن دادهٔ استانی بر اساس کد (IR-00 … IR-30) یا نام فارسی استان. */
export function provinceStatByRef(
  data: SpatialData,
  ref: { code?: string | null; name?: string | null }
): ProvinceGeoStat | null {
  const provinces = data.provinceStats.provinces;
  if (ref.code && provinces[ref.code]) return provinces[ref.code];
  if (ref.name) {
    const norm = String(ref.name).replace(/^استان\s*/i, '').trim();
    for (const p of Object.values(provinces)) {
      const pn = (p.nameFa || '').replace(/^استان\s*/i, '').trim();
      if (pn === norm) return p;
    }
  }
  return null;
}

/** یافتن دادهٔ دسترسی درمانی بر اساس کد استانی. */
export function hospitalAccessByCode(data: SpatialData, code: string | null | undefined) {
  if (!code) return null;
  for (const p of Object.values(data.hospitalAccess.provinces)) {
    if (p.code === code) return p;
  }
  return null;
}

/** ترجمهٔ کلیدهای گروه زیرساخت به برچسب فارسی. */
export const INFRA_GROUP_LABELS: Record<string, string> = {
  transport: 'حمل‌ونقل',
  utilities: 'تأسیسات',
  education: 'آموزش',
  public_services: 'خدمات عمومی',
  health: 'سلامت',
  industrial: 'صنعتی',
  energy: 'انرژی',
  water: 'آب',
};

/** رنگ هر گروه زیرساخت (هماهنگ با تم نقشه). */
export const INFRA_GROUP_COLORS: Record<string, string> = {
  transport: '#F59E0B',
  utilities: '#8B5CF6',
  education: '#3B82F6',
  public_services: '#06B6D4',
  health: '#EC4899',
  industrial: '#10B981',
  energy: '#EF4444',
  water: '#0EA5E9',
};

/** رنگ هر دستهٔ مرکز درمانی برای نمایش نقطه‌ای روی نقشه. */
export const HEALTH_TYPE_COLORS: Record<string, string> = {
  'بیمارستان': '#DC2626',
  'داروخانه': '#0EA5E9',
  'کلینیک / درمانگاه': '#F59E0B',
  'مطب پزشک': '#8B5CF6',
  'دندانپزشکی': '#3B82F6',
  'آزمایشگاه': '#14B8A6',
  'فیزیوتراپی / توانبخشی': '#10B981',
  'مراکز اهدای خون': '#EF4444',
  'طب سنتی / جایگزین': '#A3E635',
  'بینایی‌سنجی / اپتومتری': '#6366F1',
  'مشاوره': '#F472B6',
  'سایر مراکز درمانی': '#94A3B8',
};
