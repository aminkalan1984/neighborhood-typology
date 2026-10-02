// ---------------------------------------------------------------------------
// لایه‌های موضوعی OSM استخراج‌شده از iran.pbf (scripts/extract_pbf_layers.py)
// ---------------------------------------------------------------------------
// خروجی‌ها در public/data/pbf/*.json قرار دارند و با fetch تنبل + کش بارگذاری
// می‌شوند (هرگز در باندل تزریق نمی‌شوند). منبع: OpenStreetMap (ODbL).

export interface PbfLine {
  t: string;                 // کلاس (motorway, river, ...)
  n?: string;                // نام
  r?: string;                // شماره/ref (راه‌ها)
  c: [number, number][];     // [[lng, lat], ...]
}

export interface PbfPoint {
  t: string;
  n?: string;
  p?: string;                // جمعیت (سکونتگاه‌ها)
  c: [number, number];       // [lng, lat]
}

export interface PbfPoly {
  t: string;
  n?: string;
  c: [number, number][][];   // حلقه‌ها: [[lng, lat], ...]
}

export interface PbfLayerFile {
  source: string;
  generatedAtUtc: string;
  lines?: PbfLine[];
  points?: PbfPoint[];
  polys?: PbfPoly[];
}

export type PbfLayerName =
  | 'roads' | 'water' | 'power' | 'places'
  | 'pois' | 'landuse' | 'boundaries' | 'railway';

const cache = new Map<PbfLayerName, Promise<PbfLayerFile>>();

/** بارگذاری تنبل یک لایهٔ PBF (نتیجه کش می‌شود). */
export function loadPbfLayer(name: PbfLayerName): Promise<PbfLayerFile> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/data/pbf/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`pbf layer ${name} -> ${r.status}`);
      return r.json() as Promise<PbfLayerFile>;
    });
    cache.set(name, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// آمار استانی استخراج‌شده از PBF (کوروپلت)
// ---------------------------------------------------------------------------

export interface PbfProvinceStat {
  name: string;
  roadsKm: Record<string, number>;
  railwayKm: number;
  waterWays: number;
  dams: number;
  powerSubstations: number;
  powerPlants: number;
  generators: number;
  wells: number;
  hospitals: number;
  clinics: number;
  schools: number;
  banks: number;
  atms: number;
  fuel: number;
  cities: number;
  towns: number;
  villages: number;
  hamlets: number;
  neighbourhoods: number;
  placesTotal: number;
  poisTotal: number;
}

export interface PbfProvinceStatsFile {
  provinces: Record<string, PbfProvinceStat>;
  names: Record<string, string>;
  note: string;
}

let statsCache: Promise<PbfProvinceStatsFile> | null = null;

export function loadPbfProvinceStats(): Promise<PbfProvinceStatsFile> {
  if (!statsCache) {
    statsCache = fetch('/data/pbf/province_stats.json').then((r) => {
      if (!r.ok) throw new Error(`pbf province stats -> ${r.status}`);
      return r.json() as Promise<PbfProvinceStatsFile>;
    });
  }
  return statsCache;
}

/** یافتن آمار استان بر اساس نام فارسی (با/بدون پیشوند «استان»). */
export function pbfStatByProvince(
  stats: PbfProvinceStatsFile,
  nameFa: string
): PbfProvinceStat | null {
  const norm = (s: string) => String(s).replace(/^استان\s*/i, '').trim();
  const target = norm(nameFa);
  for (const p of Object.values(stats.provinces)) {
    if (norm(p.name) === target) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// استایل‌ها (هماهنگ با تم تیرهٔ نقشه)
// ---------------------------------------------------------------------------

export const ROAD_COLORS: Record<string, string> = {
  motorway: '#F97316',
  motorway_link: '#F97316',
  trunk: '#FACC15',
  trunk_link: '#FACC15',
  primary: '#FDE047',
  primary_link: '#FDE047',
  secondary: '#FB923C',
  secondary_link: '#FB923C',
};

export const ROAD_WEIGHTS: Record<string, number> = {
  motorway: 2.6,
  motorway_link: 1.5,
  trunk: 2.2,
  trunk_link: 1.4,
  primary: 1.8,
  primary_link: 1.2,
  secondary: 1.3,
  secondary_link: 1.0,
};

export const ROAD_LABELS: Record<string, string> = {
  motorway: 'آزادراه',
  trunk: 'بزرگراه',
  primary: 'راه اصلی',
  secondary: 'راه فرعی',
  motorway_link: 'رمپ آزادراه',
  trunk_link: 'رمپ بزرگراه',
  primary_link: 'رمپ راه اصلی',
  secondary_link: 'رمپ راه فرعی',
};

export const WATER_WEIGHTS: Record<string, number> = {
  river: 2.2,
  canal: 1.3,
  stream: 0.9,
  drain: 0.7,
  dam: 2.6,
  weir: 1.6,
  waterfall: 1.6,
};
export const WATER_LINE_COLOR = '#38BDF8';
export const WATER_POLY_COLOR = '#0284C7';

export const PLACE_RADIUS: Record<string, number> = {
  city: 7.5,
  town: 5,
  village: 3,
  hamlet: 2.2,
  suburb: 3,
  neighbourhood: 2.6,
  district: 2.6,
  isolated_dwelling: 2,
  locality: 2,
  quarter: 2.4,
};
export const PLACE_COLORS: Record<string, string> = {
  city: '#F472B6',
  town: '#FB7185',
  village: '#E2E8F0',
  hamlet: '#94A3B8',
  suburb: '#CBD5E1',
  neighbourhood: '#CBD5E1',
  district: '#CBD5E1',
  isolated_dwelling: '#94A3B8',
  locality: '#64748B',
  quarter: '#CBD5E1',
};
export const PLACE_LABELS: Record<string, string> = {
  city: 'شهر', town: 'شهرک', village: 'روستا', hamlet: 'ده', suburb: 'حومه',
  neighbourhood: 'محله', district: 'منطقه', isolated_dwelling: 'مزرعه/خانه تنها',
  locality: 'محدوده', quarter: 'محله',
};

const POI_CATEGORY: Record<string, string> = {
  hospital: 'health', clinic: 'health', doctors: 'health', dentist: 'health',
  pharmacy: 'health', nursing_home: 'health', laboratory: 'health',
  school: 'education', college: 'education', university: 'education',
  kindergarten: 'education', library: 'education',
  bank: 'finance', atm: 'finance',
  fuel: 'fuel',
  hotel: 'tourism', guest_house: 'tourism', hostel: 'tourism', motel: 'tourism',
  apartment: 'tourism', museum: 'tourism', attraction: 'tourism', artwork: 'tourism',
  viewpoint: 'tourism', information: 'tourism', theme_park: 'tourism',
  zoo: 'tourism', aquarium: 'tourism',
  place_of_worship: 'worship',
};
/** دستهٔ هر نوع POI؛ انواع میراث (historic=*) و موارد ناشناخته به heritage می‌روند. */
export function poiCategory(t: string): string {
  return POI_CATEGORY[t] ?? 'heritage';
}

export const POI_COLORS: Record<string, string> = {
  health: '#EF4444',
  education: '#3B82F6',
  finance: '#10B981',
  fuel: '#F59E0B',
  tourism: '#8B5CF6',
  heritage: '#D97706',
  worship: '#14B8A6',
};

export const POI_LABELS: Record<string, string> = {
  health: 'سلامت', education: 'آموزش', finance: 'مالی/بانکی', fuel: 'سوخت',
  tourism: 'گردشگری', heritage: 'میراث', worship: 'مذهبی',
};

export const POI_TYPE_LABELS: Record<string, string> = {
  hospital: 'بیمارستان', clinic: 'درمانگاه', doctors: 'مطب پزشک',
  dentist: 'دندان‌پزشکی', pharmacy: 'داروخانه', laboratory: 'آزمایشگاه',
  nursing_home: 'خانه سالمندان', school: 'مدرسه', college: 'آموزشگاه',
  university: 'دانشگاه', kindergarten: 'مهدکودک', library: 'کتابخانه',
  bank: 'بانک', atm: 'خودپرداز', fuel: 'پمپ بنزین', hotel: 'هتل',
  guest_house: 'مهمان‌پذیر', hostel: 'هاستل', motel: 'متل', apartment: 'آپارتمان',
  museum: 'موزه', attraction: 'جاذبه', artwork: 'اثر هنری', viewpoint: 'چشم‌انداز',
  information: 'اطلاعات', theme_park: 'شهربازی', zoo: 'باغ‌وحش', aquarium: 'آکواریوم',
  place_of_worship: 'عبادتگاه',
};

export const LANDUSE_COLORS: Record<string, string> = {
  industrial: '#7C3AED',
  quarry: '#A16207',
  military: '#9F1239',
  forest: '#166534',
  cemetery: '#64748B',
  commercial: '#DB2777',
  landfill: '#78350F',
};
export const LANDUSE_LABELS: Record<string, string> = {
  industrial: 'صنعتی', quarry: 'معدن روباز', military: 'نظامی', forest: 'جنگل',
  cemetery: 'قبرستان', commercial: 'تجاری', landfill: 'پسماند',
};

export const POWER_LINE_COLOR = '#EF4444';
export const POWER_POINT_COLOR = '#F87171';
export const POWER_TYPE_LABELS: Record<string, string> = {
  substation: 'پست برق', plant: 'نیروگاه', generator: 'مولد', transformer: 'ترانسفورماتور',
};
export const BOUNDARY_COLOR = '#34D399';
export const RAILWAY_COLOR = '#A78BFA';
export const RAILWAY_STATION_COLOR = '#C084FC';
export const WATER_TYPE_LABELS: Record<string, string> = {
  river: 'رودخانه', canal: 'کانال/قنات', stream: 'جوی', drain: 'زهکش',
  dam: 'سد', weir: 'آب‌بند', waterfall: 'آبشار',
};
