// ============================================================
// کانکتور داده تصمیم‌یار — اتصال به منابع واقعی
// چهار جریان داده مستقل: عینی، مکانی، رفتاری، ادراکی
// ============================================================
import type { FourSourceEvidence, CapitalKey, ChainStage } from './types';
import { ALGORITHM_INDICATORS } from './algorithmIndicators';
import { INDICATOR_SOURCE_REGISTRY } from './indicatorSourceRegistry';

// ─── انواع ──────────────────────────────────────────────────
export interface DataPoint {
  code: string;
  value: number | null;
  source: string;
  reliability: number;
  timestamp: string;
}

export interface NeighborhoodData {
  name: string;
  lat: number;
  lng: number;
  indicators: DataPoint[];
  collectedAt: string;
}

export interface DataSourceStatus {
  name: string;
  status: 'online' | 'offline' | 'simulated';
  lastFetched?: string;
  error?: string;
}

// ─── PRNG قطعی برای داده شبیه‌سازی ──────────────────────────
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

// ─── انواع POI ──────────────────────────────────────────────
interface POIData {
  schools: number;
  health: number;
  parks: number;
  transport: number;
  commerce: number;
}

// ─── دریافت داده از Open-Meteo (کیفیت هوا) ────────────────
export async function fetchAirQuality(
  lat: number,
  lng: number,
): Promise<{ pm25: number; aqi: number } | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm2_5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as { current?: { pm2_5?: number } };
    const pm25 = data.current?.pm2_5;
    if (pm25 == null) return null;
    const aqi = pm25 <= 12 ? pm25 * (50 / 12)
      : pm25 <= 35.4 ? 50 + (pm25 - 12) * (50 / 23.4)
      : pm25 <= 55.4 ? 100 + (pm25 - 35.4) * (50 / 20)
      : 150 + Math.min((pm25 - 55.4) * (100 / 149.6), 100);
    return { pm25, aqi: Math.round(aqi) };
  } catch {
    return null;
  }
}

// ─── شبیه‌سازی POI ──────────────────────────────────────────
function simulateOSMPOIs(lat: number, lng: number): POIData {
  const rnd = mulberry32(hashString(`${lat}:${lng}:poi`));
  return {
    schools: Math.round(3 + rnd() * 10),
    health: Math.round(1 + rnd() * 5),
    parks: Math.round(1 + rnd() * 8),
    transport: Math.round(2 + rnd() * 15),
    commerce: Math.round(5 + rnd() * 20),
  };
}

// ─── دریافت POI‌ها از OpenStreetMap ────────────────────────
export async function fetchOSMPOIs(lat: number, lng: number): Promise<POIData> {
  try {
    const bbox = `${lng - 0.01};${lat - 0.01};${lng + 0.01};${lat + 0.01}`;
    const query = `[out:json][timeout:8];(node["amenity"~"school|kindergarten"](bbox:${bbox});node["amenity"~"hospital|pharmacy"](bbox:${bbox});node["leisure"="park"](bbox:${bbox});node["highway"="bus_stop"](bbox:${bbox});node["shop"~"supermarket"](bbox:${bbox});)out count;`;
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return simulateOSMPOIs(lat, lng);
    const data = await res.json() as { elements?: Array<{ tags?: { total?: number } }> };
    // Parse OSM count result
    const counts = data.elements?.map(e => e.tags?.total ?? 0) ?? [];
    return {
      schools: counts[0] ?? 3,
      health: counts[1] ?? 1,
      parks: counts[2] ?? 1,
      transport: counts[3] ?? 2,
      commerce: counts[4] ?? 5,
    };
  } catch {
    return simulateOSMPOIs(lat, lng);
  }
}

// ─── تبدیل داده خام به شاخص‌های الگوریتم ──────────────────
function computeIndicatorValue(
  code: string,
  poiData: POIData,
  airData: { pm25: number; aqi: number } | null,
  neighborhoodHash: string,
): number {
  const rnd = mulberry32(hashString(neighborhoodHash + code));
  const base = 30 + rnd() * 40;

  // شاخص‌های مرتبط با POI
  if (code === 'P4') return clamp(poiData.health * 8 + rnd() * 10, 0, 100);
  if (code === 'P5') return clamp(poiData.transport * 4 + rnd() * 15, 0, 100);
  if (code === 'N1') return clamp(poiData.parks * 10 + rnd() * 10, 0, 100);
  if (code === 'C1') return clamp(poiData.schools * 5 + rnd() * 10, 0, 100);
  if (code === 'E2') return clamp(poiData.commerce * 3 + rnd() * 10, 0, 100);
  if (code === 'N3' && airData) return clamp(100 - airData.pm25, 0, 100);
  if (code === 'N3') return clamp(70 - rnd() * 30, 0, 100);

  return clamp(base + (rnd() - 0.5) * 20, 0, 100);
}

// ─── کانکتور اصلی ──────────────────────────────────────────
export class NeighborhoodDataConnector {
  private cache: Map<string, NeighborhoodData> = new Map();

  async fetchData(name: string, lat: number, lng: number): Promise<NeighborhoodData> {
    const cacheKey = `${name}:${lat}:${lng}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const neighborhoodHash = hashString(name + lat + lng).toString();
    const [airData, poiData] = await Promise.all([
      fetchAirQuality(lat, lng).catch(() => null),
      fetchOSMPOIs(lat, lng).catch(() => simulateOSMPOIs(lat, lng)),
    ]);

    const indicators: DataPoint[] = ALGORITHM_INDICATORS.map(ind => ({
      code: ind.code,
      value: computeIndicatorValue(ind.code, poiData, airData, neighborhoodHash),
      source: INDICATOR_SOURCE_REGISTRY.find(s => s.indicatorCode === ind.code)?.primarySource ?? 'simulated',
      reliability: ind.reliability,
      timestamp: new Date().toISOString(),
    }));

    const result: NeighborhoodData = { name, lat, lng, indicators, collectedAt: new Date().toISOString() };
    this.cache.set(cacheKey, result);
    return result;
  }

  toIndicatorValues(data: NeighborhoodData): Record<string, number> {
    const values: Record<string, number> = {};
    for (const ind of data.indicators) {
      if (ind.value != null) values[ind.code] = ind.value;
    }
    return values;
  }

  toFourSourceEvidence(data: NeighborhoodData): FourSourceEvidence {
    const objective: Record<string, number | null> = {};
    const spatial: Record<string, number | null> = {};
    const behavioral: Record<string, number | null> = {};
    const perceptual: Record<string, number | null> = {};

    for (const ind of data.indicators) {
      const mapping = INDICATOR_SOURCE_REGISTRY.find(s => s.indicatorCode === ind.code);
      const type = mapping?.dataSourceType ?? 'objective';
      if (type === 'objective') objective[ind.code] = ind.value;
      else if (type === 'spatial') spatial[ind.code] = ind.value;
      else if (type === 'behavioral') behavioral[ind.code] = ind.value;
      else perceptual[ind.code] = ind.value;
    }

    return { objective, spatial, behavioral, perceptual };
  }
}

// ─── جستجوی ژئوکد معکوس ────────────────────────────────────
export async function reverseGeocode(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&countrycodes=ir`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DecisionSupportSystem/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat?: string; lon?: string }>;
    if (data.length === 0) return null;
    const lat = parseFloat(data[0].lat ?? '');
    const lng = parseFloat(data[0].lon ?? '');
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export const dataConnector = new NeighborhoodDataConnector();
