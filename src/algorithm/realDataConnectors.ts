// ============================================================
// کانکتورهای داده واقعی — اتصال به ۹ API عمومی
// ============================================================
export interface RealDataSource {
  name: string;
  baseUrl: string;
  status: 'online' | 'offline' | 'degraded';
  lastFetched?: string;
  error?: string;
  latencyMs?: number;
  cache?: 'HIT' | 'MISS' | 'STALE';
  provider?: string;
}

export interface ExternalProviderTelemetry {
  provider: string;
  status: 'online' | 'degraded' | 'offline';
  last_latency_ms?: number | null;
  last_error?: string | null;
  last_success_at?: string | null;
  cache_hits?: number;
  stale_hits?: number;
  cache?: 'HIT' | 'MISS' | 'STALE';
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const EXTERNAL_PROXY_TIMEOUT_MS = 40_000;
const externalTelemetry = new Map<string, ExternalProviderTelemetry>();

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function requestId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // Older browsers can use the timestamp fallback below.
  }
  return `ara-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchExternalJson<T>(path: string, provider: string): Promise<T> {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      headers: { Accept: 'application/json', 'X-Correlation-ID': requestId() },
      signal: AbortSignal.timeout(EXTERNAL_PROXY_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network request failed';
    externalTelemetry.set(provider, { provider, status: 'offline', last_latency_ms: performance.now() - started, last_error: message });
    throw error;
  }
  const cache = response.headers.get('X-Cache');
  const actualProvider = response.headers.get('X-Provider') || provider;
  const fallback = response.headers.get('X-Provider-Fallback');
  const latencyMs = performance.now() - started;
  const previous = externalTelemetry.get(provider);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const error = body?.error?.message || `${provider} returned ${response.status}`;
    externalTelemetry.set(provider, { provider, status: 'offline', last_latency_ms: latencyMs, last_error: error });
    throw new Error(error);
  }
  externalTelemetry.set(provider, {
    ...(previous ?? {}),
    provider,
    status: fallback ? 'degraded' : 'online',
    last_latency_ms: latencyMs,
    last_error: null,
    last_success_at: new Date().toISOString(),
    cache: cache === 'HIT' || cache === 'STALE' || cache === 'MISS' ? cache : undefined,
  });
  if (actualProvider !== provider) {
    externalTelemetry.set(actualProvider, {
      provider: actualProvider,
      status: 'online',
      last_latency_ms: latencyMs,
      last_error: null,
      last_success_at: new Date().toISOString(),
      cache: cache === 'HIT' || cache === 'STALE' || cache === 'MISS' ? cache : undefined,
    });
  }
  return await response.json() as T;
}

export async function fetchExternalDataHealth(): Promise<ExternalProviderTelemetry[] | null> {
  try {
    const response = await fetch(apiUrl('/api/external-data/health'), {
      headers: { Accept: 'application/json', 'X-Correlation-ID': requestId() },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { providers?: ExternalProviderTelemetry[] };
    return (payload.providers ?? []).map((provider) => {
      const previous = externalTelemetry.get(provider.provider);
      const merged: ExternalProviderTelemetry = {
        ...previous,
        ...provider,
        status: previous?.status === 'degraded' ? 'degraded' : provider.status,
        cache: previous?.cache,
      };
      externalTelemetry.set(provider.provider, merged);
      return merged;
    });
  } catch {
    return null;
  }
}

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }

function finiteApiNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ─── ۱. Open-Meteo: کیفیت هوا و اقلیم ────────────────────
export async function fetchOpenMeteoAirQuality(lat: number, lng: number): Promise<{
  pm25?: number; pm10?: number; no2?: number; o3?: number;
  temperature?: number; humidity?: number; windSpeed?: number;
} | null> {
  try {
    const airUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lng + '&current=pm2_5,pm10,nitrogen_dioxide,ozone&timezone=auto';
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto';
    const [airRes, weatherRes] = await Promise.all([
      fetch(airUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(weatherUrl, { signal: AbortSignal.timeout(8000) }),
    ]);
    const airData = airRes.ok ? await airRes.json() as { current?: { pm2_5?: number; pm10?: number; nitrogen_dioxide?: number; ozone?: number } } : null;
    const weatherData = weatherRes.ok ? await weatherRes.json() as { current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number } } : null;
    const values = {
      pm25: finiteApiNumber(airData?.current?.pm2_5),
      pm10: finiteApiNumber(airData?.current?.pm10),
      no2: finiteApiNumber(airData?.current?.nitrogen_dioxide),
      o3: finiteApiNumber(airData?.current?.ozone),
      temperature: finiteApiNumber(weatherData?.current?.temperature_2m),
      humidity: finiteApiNumber(weatherData?.current?.relative_humidity_2m),
      windSpeed: finiteApiNumber(weatherData?.current?.wind_speed_10m),
    };
    const result = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null));
    return Object.keys(result).length > 0 ? result : null;
  } catch { return null; }
}

// ─── ۲. OpenStreetMap: شمارش POI ──────────────────────────
export async function fetchOSMPois(lat: number, lng: number): Promise<{
  schools: number; hospitals: number; parks: number;
  busStops: number; supermarkets: number; pharmacies: number;
  mosques: number; banks: number; restaurants: number;
} | null> {
  try {
    const data = await fetchExternalJson<Record<string, unknown>>(`/api/external-data/osm/pois?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, 'osm-overpass');
    const keys = ['schools', 'hospitals', 'parks', 'busStops', 'supermarkets', 'pharmacies', 'mosques', 'banks', 'restaurants'] as const;
    const values = Object.fromEntries(keys.map((key) => [key, finiteApiNumber(data[key]) ?? 0])) as Record<typeof keys[number], number>;
    return values;
  } catch { return null; }
}

// ─── ۳. World Bank: شاخص‌های کلان ایران ──────────────────
export async function fetchWorldBankIndicators(): Promise<{
  gdpGrowth?: number; inflation?: number; unemployment?: number;
  urbanPopulation?: number; lifeExpectancy?: number; co2Emissions?: number;
} | null> {
  try {
    const codes = [
      { key: 'gdpGrowth', code: 'NY.GDP.MKTP.KD.ZG' },
      { key: 'inflation', code: 'FP.CPI.TOTL.ZG' },
      { key: 'unemployment', code: 'SL.UEM.TOTL.ZS' },
      { key: 'urbanPopulation', code: 'SP.URB.TOTL.IN.ZS' },
      { key: 'lifeExpectancy', code: 'SP.DYN.LE00.IN' },
      { key: 'co2Emissions', code: 'EN.ATM.CO2E.PC' },
    ];
    const results: Record<string, number> = {};
    let successful = 0;
    await Promise.all(codes.map(async (ind) => {
      try {
        const res = await fetchExternalJson<unknown[]>('/api/external-data/worldbank/' + ind.code, 'worldbank');
        const data = res;
        const arr = Array.isArray(data[1]) ? data[1] : [];
        const value = finiteApiNumber((arr[0] as { value?: unknown })?.value);
        if (value !== null) { results[ind.key] = value; successful += 1; }
      } catch { /* Keep the field absent so the documented fallback remains visible. */ }
    }));
    if (successful === 0) return null;
    return results;
  } catch { return null; }
}

// ─── ۴. WHO GHO: شاخص‌های سلامت ─────────────────────────
export async function fetchWHOHealthIndicators(): Promise<{
  healthExpenditure?: number; hospitalBeds?: number; physicians?: number;
} | null> {
  try {
    const codes = [
      { key: 'healthExpenditure', code: 'GHS_SHA_GHED_GDP_SHA2011' },
      { key: 'hospitalBeds', code: 'WHS6_102' },
      { key: 'physicians', code: 'WHS6_106' },
    ];
    const results: Record<string, number> = {};
    let successful = 0;
    await Promise.all(codes.map(async (ind) => {
      try {
        const data = await fetchExternalJson<{ value?: Array<{ NumericValue?: number }> }>('/api/external-data/who/' + ind.code, 'who');
        const value = finiteApiNumber(Array.isArray(data?.value) ? data.value[0]?.NumericValue : null);
        if (value !== null) { results[ind.key] = value; successful += 1; }
      } catch { /* Keep the field absent so the documented fallback remains visible. */ }
    }));
    if (successful === 0) return null;
    return results;
  } catch { return null; }
}

// ─── ۵. UNESCO UIS: شاخص‌های آموزش ──────────────────────
export async function fetchUNESCOEducation(): Promise<{
  literacyRate?: number; enrollmentPrimary?: number;
  enrollmentSecondary?: number; pupilTeacherRatio?: number;
} | null> {
  const codes = [
    { key: 'literacyRate', code: 'SE.ADT.LITR.ZS' },
    { key: 'enrollmentPrimary', code: 'SE.PRM.NENR' },
    { key: 'enrollmentSecondary', code: 'SE.SEC.NENR' },
    { key: 'pupilTeacherRatio', code: 'SE.PRM.ENRL.TC.ZS' },
  ];
  const results: Record<string, number> = {};
  await Promise.all(codes.map(async (indicator) => {
    try {
      const data = await fetchExternalJson<unknown[]>(`/api/external-data/unesco/${indicator.code}`, 'unesco');
      const rows = Array.isArray(data[1]) ? data[1] : [];
      const value = finiteApiNumber((rows[0] as { value?: unknown })?.value);
      if (value !== null) results[indicator.key] = value;
    } catch {
      // Missing UIS series remain absent; no synthetic education value is inserted.
    }
  }));
  return Object.keys(results).length > 0 ? results : null;
}

// ─── ۶. Nominatim: ژئوکد معکوس ────────────────────────────
export async function fetchGeocode(name: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = apiUrl('/api/typology/locations/search?q=' + encodeURIComponent(name) + '&limit=1');
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const payload = await res.json() as { data?: { results?: Array<{ canonical_name?: string; province?: string; city_or_county?: string; center?: { lat?: number; lng?: number } | null }> } };
    const match = payload.data?.results?.[0];
    const lat = finiteApiNumber(match?.center?.lat);
    const lng = finiteApiNumber(match?.center?.lng);
    if (lat === null || lng === null) return null;
    const displayName = [match?.canonical_name, match?.city_or_county, match?.province].filter(Boolean).join('، ');
    return { lat, lng, displayName: displayName || name };
  } catch { return null; }
}

// ─── ۷. Open-Meteo: داده تاریخی اقلیم ─────────────────────
export async function fetchClimateHistorical(lat: number, lng: number): Promise<{
  avgTemp: number; totalRainfall: number; droughtIndex: number;
} | null> {
  try {
    const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + lat + '&longitude=' + lng + '&start_date=2024-01-01&end_date=2024-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto';
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as { daily?: { temperature_2m_mean?: number[]; precipitation_sum?: number[] } };
    const temps = (data.daily?.temperature_2m_mean ?? []).filter(Number.isFinite);
    const rain = data.daily?.precipitation_sum ?? [];
    if (temps.length === 0 || rain.length === 0) return null;
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const totalRainfall = rain.reduce((a, b) => a + b, 0);
    return { avgTemp, totalRainfall, droughtIndex: totalRainfall < 200 ? 0.8 : totalRainfall < 400 ? 0.4 : 0.1 };
  } catch { return null; }
}

// ─── ۸. OpenStreetMap: شاخص پیاده‌مداری ───────────────────
export async function fetchWalkabilityScore(lat: number, lng: number): Promise<{
  sidewalkDensity: number; crossingDensity: number; streetLightDensity: number;
} | null> {
  try {
    const data = await fetchExternalJson<Record<string, unknown>>(`/api/external-data/osm/walkability?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, 'osm-overpass');
    const sidewalkDensity = finiteApiNumber(data.sidewalkDensity);
    const crossingDensity = finiteApiNumber(data.crossingDensity);
    const streetLightDensity = finiteApiNumber(data.streetLightDensity);
    if (sidewalkDensity === null || crossingDensity === null || streetLightDensity === null) return null;
    return { sidewalkDensity, crossingDensity, streetLightDensity };
  } catch { return null; }
}

// ─── ۹. Healthsites.io: مراکز درمانی ─────────────────────
export async function fetchHealthFacilities(lat: number, lng: number): Promise<{
  hospitals: number; clinics: number; pharmacies: number; healthPosts: number;
} | null> {
  try {
    const url = '/api/external-data/healthsites?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng);
    const data = await fetchExternalJson<{ features?: Array<{ properties?: { type?: string } }> } | null>(url, 'healthsites');
    const features = Array.isArray(data?.features) ? data.features : [];
    let hospitals = 0, clinics = 0, pharmacies = 0, healthPosts = 0;
    for (const f of features) {
      const type = (f.properties?.type ?? '').toLowerCase();
      if (type.includes('hospital')) hospitals++;
      else if (type.includes('clinic') || type.includes('doctor')) clinics++;
      else if (type.includes('pharmacy')) pharmacies++;
      else healthPosts++;
    }
    return { hospitals, clinics, pharmacies, healthPosts };
  } catch { return null; }
}

// ─── تبدیل همه داده‌ها به شاخص‌های الگوریتم ───────────────
export function combineToAlgorithmIndicators(data: {
  air?: { pm25?: number; pm10?: number; no2?: number; temperature?: number } | null;
  pois?: { schools: number; hospitals: number; parks: number; busStops: number; supermarkets: number; pharmacies: number; mosques: number; banks: number; restaurants: number } | null;
  worldBank?: { gdpGrowth?: number; inflation?: number; unemployment?: number; urbanPopulation?: number; lifeExpectancy?: number } | null;
  who?: { healthExpenditure?: number; hospitalBeds?: number; physicians?: number } | null;
  unesco?: { literacyRate?: number; enrollmentPrimary?: number } | null;
  climate?: { avgTemp: number; totalRainfall: number; droughtIndex: number } | null;
  walkability?: { sidewalkDensity: number; crossingDensity: number; streetLightDensity: number } | null;
  healthFacilities?: { hospitals: number; clinics: number; pharmacies: number; healthPosts: number } | null;
}): Record<string, number> {
  const result: Record<string, number> = {};
  const set = (code: string, value: number | null | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) result[code] = clamp(value, 0, 100);
  };
  const sumAvailable = (...values: Array<number | undefined>): number | null => {
    const available = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return available.length > 0 ? available.reduce((sum, value) => sum + value, 0) : null;
  };
  const p = data.pois;
  const hf = data.healthFacilities;
  const hospitalCount = sumAvailable(p?.hospitals, hf?.hospitals);
  const pharmacyCount = sumAvailable(p?.pharmacies, hf?.pharmacies);

  set('H1', data.unesco?.literacyRate === undefined ? null : data.unesco.literacyRate * 0.95);
  set('H2', data.unesco?.enrollmentPrimary === undefined ? null : data.unesco.enrollmentPrimary * 0.85);
  set('H3', data.worldBank?.unemployment === undefined ? null : 100 - data.worldBank.unemployment * 3);
  set('H4', data.unesco?.literacyRate === undefined ? null : 55 + data.unesco.literacyRate * 0.2);
  set('H5', data.worldBank?.gdpGrowth === undefined ? null : 50 + data.worldBank.gdpGrowth * 3);
  set('S1', p ? 40 + p.schools * 3 : null);
  set('S2', hospitalCount === null ? null : 35 + hospitalCount * 8);
  set('S3', p ? 45 + p.parks * 5 : null);
  set('S4', p ? 30 + p.mosques * 8 : null);
  set('S5', p ? 50 + p.banks * 10 : null);
  set('E1', data.worldBank?.gdpGrowth === undefined ? null : 50 + data.worldBank.gdpGrowth * 5);
  set('E2', p ? p.schools * 5 + p.restaurants * 2 : null);
  set('E3', p ? 60 + p.supermarkets * 4 : null);
  set('E4', data.worldBank?.inflation === undefined ? null : 100 - data.worldBank.inflation * 1.5);
  set('E5', p ? 50 + p.banks * 10 : null);
  set('P1', data.walkability ? 60 + data.walkability.crossingDensity * 0.3 : null);
  set('P2', data.walkability ? data.walkability.sidewalkDensity * 0.8 : null);
  set('P3', data.walkability ? 50 + data.walkability.crossingDensity * 0.5 : null);
  set('P4', hospitalCount === null && pharmacyCount === null ? null : (hospitalCount ?? 0) * 15 + (pharmacyCount ?? 0) * 5);
  set('P5', p ? p.busStops * 3 : null);
  set('N1', p ? p.parks * 10 : null);
  set('N2', data.climate ? 30 + data.climate.totalRainfall * 0.05 : null);
  set('N3', data.air?.pm25 === undefined ? null : 100 - data.air.pm25);
  set('N4', data.climate ? 80 - data.climate.droughtIndex * 50 : null);
  set('N5', data.climate ? 70 - data.climate.droughtIndex * 30 : null);
  set('C1', p ? p.mosques * 8 + p.parks * 5 : null);
  set('C2', p ? 50 + p.schools * 4 : null);
  set('C3', p ? 45 + p.restaurants * 5 : null);
  set('C4', p ? 40 + p.parks * 8 : null);
  set('C5', p ? 50 + p.mosques * 6 : null);
  set('G1', data.who?.healthExpenditure === undefined ? null : 50 + data.who.healthExpenditure * 3);
  set('G2', data.who?.hospitalBeds === undefined ? null : 45 + data.who.hospitalBeds * 10);
  set('G3', data.who?.physicians === undefined ? null : 40 + data.who.physicians * 12);
  set('G4', p ? 55 + p.banks * 8 : null);
  set('G5', hf ? 35 + (hf.healthPosts + hf.clinics) * 5 : null);
  set('R1', p ? 60 + p.schools * 3 + p.hospitals * 5 : null);
  set('R2', p ? p.schools * 3 + p.hospitals * 5 : null);
  set('R3', p ? 50 + p.parks * 6 : null);
  set('R4', p ? 45 + p.supermarkets * 5 : null);
  set('R5', p ? 60 + p.busStops * 2 + p.pharmacies * 3 : null);
  return result;
}

// ─── وضعیت منابع ──────────────────────────────────────────
export function buildSourceStatuses(data: {
  air?: unknown; pois?: unknown; worldBank?: unknown; who?: unknown;
  unesco?: unknown; climate?: unknown; walkability?: unknown; healthFacilities?: unknown;
  telemetry?: ExternalProviderTelemetry[];
}): RealDataSource[] {
  const telemetry = new Map((data.telemetry ?? [...externalTelemetry.values()]).map((item) => [item.provider, item]));
  const defs: [string, string, unknown, string | undefined][] = [
    ['Open-Meteo Air Quality', 'https://air-quality-api.open-meteo.com', data.air, undefined],
    ['OpenStreetMap POIs', '/api/external-data/osm/pois', data.pois, 'osm-overpass'],
    ['World Bank WDI', 'https://api.worldbank.org', data.worldBank, 'worldbank'],
    ['WHO Global Health Observatory', 'https://ghoapi.azureedge.net', data.who, 'who'],
    ['UNESCO UIS Education (World Bank fallback)', 'https://api.worldbank.org', data.unesco, 'unesco'],
    ['Open-Meteo Climate Historical', 'https://archive-api.open-meteo.com', data.climate, undefined],
    ['OSM Walkability', '/api/external-data/osm/walkability', data.walkability, 'osm-overpass'],
    ['Healthsites.io', 'https://healthsites.io', data.healthFacilities, 'healthsites'],
  ];
  return defs.map(([name, baseUrl, val, provider]) => {
    const details = provider ? telemetry.get(provider) : undefined;
    const status = details?.status ?? (val ? 'online' : 'offline');
    return {
    name,
    baseUrl,
    status,
    provider,
    latencyMs: details?.last_latency_ms ?? undefined,
    error: details?.last_error ?? undefined,
    lastFetched: details?.last_success_at ?? undefined,
    cache: details?.cache,
  };
  });
}
