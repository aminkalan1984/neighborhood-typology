// ============================================================
// کلاینت Backend سینک مرکز آمار
// ------------------------------------------------------------
// همهٔ درخواست‌ها هم‌مبدأ از طریق پراکسی Vite (/api/sci) به سرور
// Node در پورت 4001 می‌روند. اگر سرور در دسترس نباشد، توابع null
// برمی‌گردانند تا UI حالت «آفلاین» را نشان دهد (دادهٔ جاسازی‌شده
// در src/data/portals همچنان به‌عنوان fallback برای بخش‌های دیگر
// پنل فعال است).
// ============================================================

export interface SciProvinceInfo {
  code: string;
  alpha: string;
  fa: string;
}

export interface LfsYearInfo {
  year: number;
  rows: number;
  waves: number[];
  totalWeighted: number;
  source: string;
}

export interface LfsSummaryRow {
  year: number;
  province: string;
  alpha: string;
  fa: string;
  employed: number;
  unemployed: number;
  inactive: number;
  laborForce: number;
  pop15: number;
  popAll: number;
  unemploymentRate: number | null;
  participationRate: number | null;
  unknown: number;
}

export interface LfsBreakdownRow {
  label: string;
  sex?: string;
  wave?: string;
  ageBand?: string;
  employed: number;
  unemployed: number;
  inactive: number;
  pop15: number;
  unemploymentRate: number | null;
  participationRate: number | null;
}

export interface LfsTimeseriesRow {
  year: number;
  fa: string;
  employed: number;
  unemployed: number;
  laborForce: number;
  pop15: number;
  popAll: number;
  unemploymentRate: number | null;
  participationRate: number | null;
}

export interface CensusSummary {
  dataset: string;
  censusYear: number | null;
  totalRawPersons: number;
  totalWeightedPersons: number;
  totalHouseholds: number;
  codebookNote: string;
  buckets: Record<string, Record<string, unknown>>;
}

async function sciGet<T>(path: string, timeoutMs = 5000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`/api/sci${path}`, { signal: ctrl.signal });
    window.clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getSciHealth(): Promise<{ ok: boolean; datasets: unknown } | null> {
  return sciGet('/health', 3000);
}

export function getLfsYears(): Promise<LfsYearInfo[] | null> {
  return sciGet<LfsYearInfo[]>('/lfs/years');
}

export async function getLfsSummary(year: number, province?: string): Promise<LfsSummaryRow[] | null> {
  const q = province ? `&province=${province}` : '';
  const data = await sciGet<{ year: number; rows: LfsSummaryRow[] } | LfsSummaryRow>(`/lfs/summary?year=${year}${q}`);
  if (!data) return null;
  if (Array.isArray(data)) return data;
  return 'rows' in data ? data.rows : [data];
}

export function getLfsBreakdown(year: number, dim: 'sex' | 'age' | 'wave', province?: string): Promise<{ rows: LfsBreakdownRow[] } | null> {
  const q = province ? `&province=${province}` : '';
  return sciGet<{ rows: LfsBreakdownRow[] }>(`/lfs/breakdown?year=${year}&dim=${dim}${q}`);
}

export function getLfsTimeseries(): Promise<{ rows: LfsTimeseriesRow[] } | null> {
  return sciGet<{ rows: LfsTimeseriesRow[] }>('/lfs/timeseries');
}

export function getCensusSummary(): Promise<CensusSummary | null> {
  return sciGet<CensusSummary>('/census/summary');
}

export function getProvinces(): Promise<Record<string, SciProvinceInfo> | null> {
  return sciGet<Record<string, SciProvinceInfo>>('/provinces');
}
