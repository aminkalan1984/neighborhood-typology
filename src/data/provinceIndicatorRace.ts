import mdgDataUrl from './portals/development/mdg-2014.json?url';
import projectionDataUrl from './portals/population/projections-1396-1415.json?url';

export type RaceIndicatorKey =
  | 'population'
  | 'urban-population'
  | 'rural-population'
  | 'female-share'
  | 'urban-share'
  | 'labor-participation'
  | 'unemployment'
  | 'adult-literacy'
  | 'primary-enrollment'
  | 'infant-mortality';

export interface RaceIndicatorDefinition {
  key: RaceIndicatorKey;
  label: string;
  description: string;
  unit: string;
  source: string;
  sourceDetail: string;
  type: 'projection' | 'mdg';
  mdgIndicator?: string;
  decimals: number;
}

export interface RacePoint {
  year: number;
  province: string;
  value: number;
}

export interface RaceDataset {
  indicator: RaceIndicatorDefinition;
  years: number[];
  frames: Record<string, RacePoint[]>;
  provinceCount: number;
  valueRange: { min: number; max: number };
}

interface MdgRow {
  indicator?: string;
  province_en?: string;
  year?: string | number;
  value?: string | number;
}

interface ProjectionRow {
  year?: string | number;
  province?: string;
  total?: string | number;
  female?: string | number;
  urban_total?: string | number;
  rural_total?: string | number;
}

const mdgIndicators = {
  urbanShare: '14. Percentage of population living in urban areas',
  laborParticipation: '29. Labor force participation rate in population aged 15 years and over',
  unemployment: '30. Unemployment rate',
  adultLiteracy: '26. Adult Literacy rate',
  primaryEnrollment: '35. Net enrollment rate in primary schools',
  infantMortality: '7. Infant mortality rate (based on vital horoscope for rural areas)',
} as const;

export const RACE_INDICATORS: RaceIndicatorDefinition[] = [
  {
    key: 'population',
    label: 'جمعیت کل',
    description: 'برآورد جمعیت استان‌ها در سری پیش‌بینی رسمی',
    unit: 'نفر',
    source: 'پرتال جمعیت',
    sourceDetail: 'Portals/0/Files/Population projections → projections-1396-1415.json',
    type: 'projection',
    decimals: 0,
  },
  {
    key: 'urban-population',
    label: 'جمعیت شهری',
    description: 'جمعیت ساکن در پهنه‌های شهری هر استان',
    unit: 'نفر',
    source: 'پرتال جمعیت',
    sourceDetail: 'Portals/0/Files/Population projections → projections-1396-1415.json',
    type: 'projection',
    decimals: 0,
  },
  {
    key: 'rural-population',
    label: 'جمعیت روستایی',
    description: 'جمعیت ساکن در پهنه‌های روستایی هر استان',
    unit: 'نفر',
    source: 'پرتال جمعیت',
    sourceDetail: 'Portals/0/Files/Population projections → projections-1396-1415.json',
    type: 'projection',
    decimals: 0,
  },
  {
    key: 'female-share',
    label: 'سهم زنان از جمعیت',
    description: 'سهم جمعیت زنان از کل جمعیت استان',
    unit: 'درصد',
    source: 'پرتال جمعیت',
    sourceDetail: 'Portals/0/Files/Population projections → projections-1396-1415.json',
    type: 'projection',
    decimals: 1,
  },
  {
    key: 'urban-share',
    label: 'درصد شهرنشینی',
    description: 'نسبت جمعیت شهری به کل جمعیت استان',
    unit: 'درصد',
    source: 'شاخص‌های توسعه هزاره',
    sourceDetail: 'Portals/0/Files/Development indicators → mdg-2014.json',
    type: 'mdg',
    mdgIndicator: mdgIndicators.urbanShare,
    decimals: 1,
  },
  {
    key: 'labor-participation',
    label: 'مشارکت اقتصادی',
    description: 'نرخ مشارکت نیروی کار ۱۵ ساله و بیشتر',
    unit: 'درصد',
    source: 'شاخص‌های توسعه هزاره',
    sourceDetail: 'Portals/0/Files/Development indicators → mdg-2014.json',
    type: 'mdg',
    mdgIndicator: mdgIndicators.laborParticipation,
    decimals: 1,
  },
  {
    key: 'unemployment',
    label: 'نرخ بیکاری',
    description: 'نرخ بیکاری جمعیت فعال استان',
    unit: 'درصد',
    source: 'شاخص‌های توسعه هزاره',
    sourceDetail: 'Portals/0/Files/Development indicators → mdg-2014.json',
    type: 'mdg',
    mdgIndicator: mdgIndicators.unemployment,
    decimals: 1,
  },
  {
    key: 'adult-literacy',
    label: 'باسوادی بزرگسالان',
    description: 'نرخ باسوادی بزرگسالان در استان‌ها',
    unit: 'درصد',
    source: 'شاخص‌های توسعه هزاره',
    sourceDetail: 'Portals/0/Files/Development indicators → mdg-2014.json',
    type: 'mdg',
    mdgIndicator: mdgIndicators.adultLiteracy,
    decimals: 1,
  },
  {
    key: 'primary-enrollment',
    label: 'ثبت‌نام خالص ابتدایی',
    description: 'نرخ ثبت‌نام خالص دوره ابتدایی',
    unit: 'درصد',
    source: 'شاخص‌های توسعه هزاره',
    sourceDetail: 'Portals/0/Files/Development indicators → mdg-2014.json',
    type: 'mdg',
    mdgIndicator: mdgIndicators.primaryEnrollment,
    decimals: 1,
  },
  {
    key: 'infant-mortality',
    label: 'مرگ‌ومیر نوزادان',
    description: 'مرگ‌ومیر نوزادان در مناطق روستایی',
    unit: 'در هزار تولد',
    source: 'شاخص‌های توسعه هزاره',
    sourceDetail: 'Portals/0/Files/Development indicators → mdg-2014.json',
    type: 'mdg',
    mdgIndicator: mdgIndicators.infantMortality,
    decimals: 1,
  },
];

const provinceNameMap: Record<string, string> = {
  Alborz: 'البرز',
  Ardebil: 'اردبیل',
  Bushehr: 'بوشهر',
  'Chaharmahal & Bakhtiyari': 'چهارمحال و بختیاری',
  'East Azarbayejan': 'آذربایجان شرقی',
  Esfahan: 'اصفهان',
  Fars: 'فارس',
  Gilan: 'گیلان',
  Golestan: 'گلستان',
  Hamedan: 'همدان',
  Hormozgan: 'هرمزگان',
  Ilam: 'ایلام',
  Kerman: 'کرمان',
  Kermanshah: 'کرمانشاه',
  'Khorasan-e-Razavi': 'خراسان رضوی',
  Khuzestan: 'خوزستان',
  'Kohgiluyeh & Boyerahmad': 'کهگیلویه و بویراحمد',
  Kordestan: 'کردستان',
  Lorestan: 'لرستان',
  Markazi: 'مرکزی',
  Mazandaran: 'مازندران',
  'North Khorasan': 'خراسان شمالی',
  Qazvin: 'قزوین',
  Qom: 'قم',
  Semnan: 'سمنان',
  'Sistan & Baluchestan': 'سیستان و بلوچستان',
  'South Khorasan': 'خراسان جنوبی',
  Tehran: 'تهران',
  'West Azarbayejan': 'آذربایجان غربی',
  Yazd: 'یزد',
  Zanjan: 'زنجان',
};

let sourcePromise: Promise<{ mdg: MdgRow[]; projections: ProjectionRow[] }> | null = null;
const datasetCache = new Map<RaceIndicatorKey, RaceDataset>();

async function loadSources() {
  if (!sourcePromise) {
    sourcePromise = Promise.all([
      fetch(mdgDataUrl).then((response) => {
        if (!response.ok) throw new Error(`mdg data failed: ${response.status}`);
        return response.json() as Promise<MdgRow[]>;
      }),
      fetch(projectionDataUrl).then((response) => {
        if (!response.ok) throw new Error(`population data failed: ${response.status}`);
        return response.json() as Promise<ProjectionRow[]>;
      }),
    ]).then(([mdg, projections]) => ({ mdg, projections }));
  }
  return sourcePromise;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').replace(/٪|%/g, '').trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProvinceName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\u064a|\u0649/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[\u200c\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function yearNumber(value: unknown): number | null {
  const match = String(value ?? '').match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function makeDataset(indicator: RaceIndicatorDefinition, points: RacePoint[]): RaceDataset {
  const frames: Record<string, RacePoint[]> = {};
  const provinces = new Set<string>();
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const key = String(point.year);
    if (!frames[key]) frames[key] = [];
    frames[key].push(point);
    provinces.add(point.province);
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }

  for (const frame of Object.values(frames)) {
    frame.sort((a, b) => b.value - a.value || a.province.localeCompare(b.province, 'fa'));
  }

  return {
    indicator,
    years: Object.keys(frames).map(Number).sort((a, b) => a - b),
    frames,
    provinceCount: provinces.size,
    valueRange: {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
    },
  };
}

function projectionPoints(indicator: RaceIndicatorDefinition, rows: ProjectionRow[]): RacePoint[] {
  const points: RacePoint[] = [];
  for (const row of rows) {
    const year = yearNumber(row.year);
    const province = normalizeProvinceName(row.province);
    const total = finiteNumber(row.total);
    if (year === null || !province || total === null || total <= 0) continue;

    let value: number | null = null;
    if (indicator.key === 'population') value = total * 1000;
    if (indicator.key === 'urban-population') value = (finiteNumber(row.urban_total) ?? 0) * 1000;
    if (indicator.key === 'rural-population') value = (finiteNumber(row.rural_total) ?? 0) * 1000;
    if (indicator.key === 'female-share') {
      const female = finiteNumber(row.female);
      value = female === null ? null : (female / total) * 100;
    }
    if (indicator.key === 'urban-share') {
      const urban = finiteNumber(row.urban_total);
      value = urban === null ? null : (urban / total) * 100;
    }
    if (value !== null && Number.isFinite(value)) points.push({ year, province, value });
  }
  return points;
}

function mdgPoints(indicator: RaceIndicatorDefinition, rows: MdgRow[]): RacePoint[] {
  const grouped = new Map<string, { province: string; year: number; total: number; count: number }>();
  for (const row of rows) {
    if (row.indicator !== indicator.mdgIndicator) continue;
    const year = yearNumber(row.year);
    const province = provinceNameMap[String(row.province_en ?? '').trim()];
    const value = finiteNumber(row.value);
    if (year === null || !province || value === null) continue;
    const key = `${year}|${province}`;
    const current = grouped.get(key);
    if (current) {
      current.total += value;
      current.count += 1;
    } else {
      grouped.set(key, { province, year, total: value, count: 1 });
    }
  }
  return Array.from(grouped.values()).map((item) => ({
    year: item.year,
    province: item.province,
    value: item.total / item.count,
  }));
}

export async function loadRaceDataset(key: RaceIndicatorKey): Promise<RaceDataset> {
  const cached = datasetCache.get(key);
  if (cached) return cached;
  const indicator = RACE_INDICATORS.find((item) => item.key === key);
  if (!indicator) throw new Error(`Unknown race indicator: ${key}`);
  const sources = await loadSources();
  const points = indicator.type === 'projection'
    ? projectionPoints(indicator, sources.projections)
    : mdgPoints(indicator, sources.mdg);
  const dataset = makeDataset(indicator, points);
  datasetCache.set(key, dataset);
  return dataset;
}
