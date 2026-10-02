// ============================================================
// لایهٔ استخراج دادهٔ واقعی برخط برای گونه‌بندی محله/نقطهٔ دلخواه
// (بخش ۱۴.۲ سند — منابع عمومی/باز فقط)
// ------------------------------------------------------------
// منابع فعال (بدون نیاز به کلید، CORS باز، هر روز به‌روز):
//  ۱) Nominatim (OpenStreetMap)  — ژئوکد معکوس: نام محله/شهر/استان
//  ۲) Open-Meteo Air Quality    — PM2.5/PM10/NO₂/O₃/SO₂/CO
//  ۳) Open-Meteo Forecast       — دما/رطوبت/بارش/فشار/باد/UV/ارتفاع
//  ۴) Overpass API (OSM)        — شمارش POI‌ها، جاده‌ها و ابنیه در بافر
// تشخیص استان: نقطه‌درچندضلعی روی کانتور واقعی ۳۱ استان (WGS84)
// هر منبع به‌طور مستقل با بازگشت نرم به دادهٔ شبیه‌سازی‌شدهٔ قطعی.
// ============================================================
import { PROVINCE_OUTLINES } from '../data/provinceOutlines';
import { PROVINCES_DATA } from '../data/iranProvincePaths';
import type { Provenance } from './types';

// ─── ابزارهای پایه ───────────────────────────────────────────
const TIMEOUT_MS = 9000;
import { clamp, hashString, mulberry32 } from './rand';

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── انواع خروجی ─────────────────────────────────────────────
export interface GeocodeAddress {
  name: string;          // نام محله/نقطه
  neighbourhood: string; // محلهٔ دقیق (neighbourhood)
  suburb: string;        // ناحیه
  city: string;          // شهر
  provinceFa: string;    // استان (متن Nominatim)
  country: string;
}

export interface AirQualityObs {
  pm25: number; pm10: number; no2: number; o3: number; so2: number; co: number;
  aqi: number;           // برآورد شاخص کیفیت هوا (EPA-like, ساده)
}

export interface WeatherObs {
  temperature: number; humidity: number; precipitation: number;
  pressure: number; windSpeed: number; uvIndex: number; elevation: number;
  weatherCode: number;
}

export interface OsmCounts {
  schools: number;       // school|kindergarten|college|university|library
  health: number;        // hospital|clinic|pharmacy|doctors
  finance: number;       // bank|atm
  worship: number;       // place_of_worship
  parks: number;         // leisure=park (node+way)
  market: number;        // marketplace|fuel|restaurant|fast_food|cafe
  shops: number;         // shop=*
  busStops: number;      // highway=bus_stop
  roads: number;         // way[highway] در بافر ۱۲۰۰م
  buildings: number;     // way[building] در بافر ۱۰۰۰م
}

export type IngestStatus = 'live' | 'simulated';

/** هر مشاهدات یک منبع + منشأ آن */
export interface Observed<T> {
  status: IngestStatus;
  value: T;
  detail: string;        // شرح فنی (واحد/بافر)
  fetchedAt: string;
}

export interface PointIngest {
  lat: number;
  lng: number;
  address?: Observed<GeocodeAddress>;
  air?: Observed<AirQualityObs>;
  weather?: Observed<WeatherObs>;
  osm?: Observed<OsmCounts>;
  provinceId: string;            // تشخیص‌شده از نقطه‌درچندضلعی
  provinceFa: string;
  provenance: Provenance[];
  warnings: string[];
}

// ─── ۱) ژئوکد معکوس (Nominatim) ──────────────────────────────
interface NominatimResp {
  display_name?: string;
  name?: string;
  address?: {
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    province?: string;
    state?: string;
    country?: string;
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<Observed<GeocodeAddress>> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}` +
    `&format=jsonv2&accept-language=fa&zoom=16&addressdetails=1`;
  const d = (await fetchJson(url)) as NominatimResp;
  const a = d?.address;
  if (!a) throw new Error('پاسخ خالی Nominatim');
  const city = a.city ?? a.town ?? a.village ?? a.city_district ?? '';
  return {
    status: 'live',
    detail: 'ژئوکد معکوس OpenStreetMap (Nominatim) — نام محله، شهر و استان',
    fetchedAt: new Date().toISOString(),
    value: {
      name: d.name ?? a.neighbourhood ?? a.suburb ?? (city || d.display_name?.split(',')[0] || 'نقطهٔ انتخابی'),
      neighbourhood: a.neighbourhood ?? a.suburb ?? '',
      suburb: a.suburb ?? a.city_district ?? '',
      city,
      provinceFa: a.province ?? a.state ?? '',
      country: a.country ?? '',
    },
  };
}

// ─── ۲) کیفیت هوا (Open-Meteo Air Quality) ───────────────────
interface AqResp {
  current?: {
    pm2_5?: number; pm10?: number; nitrogen_dioxide?: number;
    ozone?: number; sulphur_dioxide?: number; carbon_monoxide?: number;
  };
}

/** شاخص کیفیت ساده (مقیاس EPA با میانگین وزنی) — فقط برای نمایش */
export function roughAqi(pm25: number, pm10: number, no2: number, o3: number): number {
  const seg = (c: number, breaks: number[], idx: number[]): number => {
    if (c <= breaks[0]) return idx[0];
    for (let i = 1; i < breaks.length; i++) {
      if (c <= breaks[i]) {
        const t = (c - breaks[i - 1]) / (breaks[i] - breaks[i - 1]);
        return idx[i - 1] + t * (idx[i] - idx[i - 1]);
      }
    }
    return idx[idx.length - 1];
  };
  const a1 = seg(pm25, [12, 35.4, 55.4, 150.4, 250.4, 500], [50, 100, 150, 200, 300, 500]);
  const a2 = seg(pm10, [54, 154, 254, 354, 424, 604], [50, 100, 150, 200, 300, 500]);
  const a3 = seg(no2, [53, 100, 360, 649, 1249, 2049], [50, 100, 150, 200, 300, 500]);
  const a4 = seg(o3, [54, 70, 85, 105, 200], [50, 100, 150, 200, 300]);
  return Math.round(Math.max(a1, a2, a3, a4));
}

export async function fetchAirQuality(lat: number, lng: number): Promise<Observed<AirQualityObs>> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide`;
  const d = (await fetchJson(url)) as AqResp;
  const c = d?.current;
  if (!c || c.pm2_5 == null) throw new Error('پاسخ ناقص Open-Meteo AQ');
  const pm25 = c.pm2_5, pm10 = c.pm10 ?? 0, no2 = c.nitrogen_dioxide ?? 0, o3 = c.ozone ?? 0;
  return {
    status: 'live',
    detail: `Open-Meteo AQ — ساعتی (μg/m³): PM2.5=${pm25.toFixed(1)} PM10=${pm10.toFixed(1)} NO₂=${no2.toFixed(1)}`,
    fetchedAt: new Date().toISOString(),
    value: {
      pm25, pm10, no2, o3,
      so2: c.sulphur_dioxide ?? 5,
      co: c.carbon_monoxide ?? 400,
      aqi: roughAqi(pm25, pm10, no2, o3),
    },
  };
}

// ─── ۳) آب‌وهوا (Open-Meteo Forecast) ────────────────────────
interface WeatherResp {
  elevation?: number;
  current?: {
    temperature_2m?: number; relative_humidity_2m?: number; precipitation?: number;
    surface_pressure?: number; wind_speed_10m?: number; uv_index?: number; weather_code?: number;
  };
}

export async function fetchWeather(lat: number, lng: number): Promise<Observed<WeatherObs>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,surface_pressure,wind_speed_10m,uv_index,weather_code` +
    `&timezone=auto`;
  const d = (await fetchJson(url)) as WeatherResp;
  const c = d?.current;
  if (!c || c.temperature_2m == null) throw new Error('پاسخ ناقص Open-Meteo Forecast');
  return {
    status: 'live',
    detail: `Open-Meteo Forecast — دما ${c.temperature_2m.toFixed(1)}°C، رطوبت ${c.relative_humidity_2m?.toFixed(0) ?? '—'}٪، بارش ${c.precipitation?.toFixed(2) ?? '—'}mm`,
    fetchedAt: new Date().toISOString(),
    value: {
      temperature: c.temperature_2m,
      humidity: c.relative_humidity_2m ?? 0,
      precipitation: c.precipitation ?? 0,
      pressure: c.surface_pressure ?? 900,
      windSpeed: c.wind_speed_10m ?? 0,
      uvIndex: c.uv_index ?? 0,
      elevation: d?.elevation ?? 0,
      weatherCode: c.weather_code ?? 0,
    },
  };
}

// ─── ۴) شمارش POI/معابر/ابنیه (Overpass API) ─────────────────
// یک کوئری تلفیقی → ۱۰ شمارش مجزا (برای رعایت محدودیت نرخ Overpass)
export async function fetchOsmCounts(lat: number, lng: number): Promise<Observed<OsmCounts>> {
  const R = 1500; // متر
  const cat: Array<[keyof OsmCounts, string]> = [
    ['schools', `node["amenity"~"^(school|kindergarten|college|university|library)$"](around:${R},${lat},${lng});`],
    ['health', `node["amenity"~"^(hospital|clinic|pharmacy|doctors)$"](around:${R},${lat},${lng});`],
    ['finance', `node["amenity"~"^(bank|atm)$"](around:${R},${lat},${lng});`],
    ['worship', `node["amenity"="place_of_worship"](around:${R},${lat},${lng});`],
    ['parks', `(node["leisure"="park"](around:${R},${lat},${lng});way["leisure"="park"](around:${R},${lat},${lng}););`],
    ['market', `node["amenity"~"^(marketplace|fuel|restaurant|fast_food|cafe)$"](around:${R},${lat},${lng});`],
    ['shops', `node["shop"](around:${R},${lat},${lng});`],
    ['busStops', `node["highway"="bus_stop"](around:${R},${lat},${lng});`],
    ['roads', `way["highway"](around:1200,${lat},${lng});`],
    ['buildings', `way["building"](around:1000,${lat},${lng});`],
  ];
  const query = `[out:json][timeout:30];` + cat.map(([, c]) => `(${c});out count;`).join('');

  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ] as const;
  /** تلاش هم‌زمان روی همهٔ سرورهای آینه — اولین موفق برنده است */
  const attempts = OVERPASS_ENDPOINTS.map(async (ep) => {
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(TIMEOUT_MS + 6000),
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    return (await res.json()) as { elements?: Array<{ type: string; tags?: Record<string, string> }> };
  });
  const settled = await Promise.allSettled(attempts);
  const ok = settled.find(
    (r): r is PromiseFulfilledResult<{ elements?: Array<{ type: string; tags?: Record<string, string> }> }> => r.status === 'fulfilled',
  );
  const d = ok ? ok.value : null;
  if (!d) {
    const rej = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    throw rej?.reason instanceof Error ? rej.reason : new Error('همهٔ سرورهای Overpass در دسترس نبودند');
  }
  const counts = (d.elements ?? []).filter((e) => e.type === 'count' && e.tags);
  if (counts.length < cat.length) throw new Error('پاسخ ناقص Overpass');

  const out = {} as OsmCounts;
  cat.forEach(([key], i) => {
    const t = counts[i].tags!;
    const n = parseInt(t.nodes ?? '0', 10) + parseInt(t.ways ?? '0', 10);
    out[key] = Number.isFinite(n) ? n : 0;
  });

  return {
    status: 'live',
    detail: `Overpass (OSM) — بافر ۱۵۰۰م: ${out.shops} مغازه · ${out.health} مرکز درمانی · ${out.schools} مدرسه · ${out.roads} معبر · ${out.buildings} بنا`,
    fetchedAt: new Date().toISOString(),
    value: out,
  };
}

// ─── ۵) تشخیص استان با نقطه‌درچندضلعی (Ray Casting) ───────────
function pointInRing(lng: number, lat: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** استان محل نقطه — از کانتور واقعی ۳۱ استان (با احتساب چندحلقه‌ای‌ها) */
export function detectProvince(lat: number, lng: number): { provinceId: string; provinceFa: string } {
  for (const [id, rings] of Object.entries(PROVINCE_OUTLINES)) {
    for (const ring of rings) {
      if (pointInRing(lng, lat, ring)) {
        return { provinceId: id, provinceFa: PROVINCES_DATA.find((p) => p.id === id)?.name ?? id };
      }
    }
  }
  // نقطه خارج از مرزها → نزدیک‌ترین مرکز استان
  let best = 'TEH';
  let bestD = Infinity;
  for (const p of PROVINCES_DATA) {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = p.id; }
  }
  return { provinceId: best, provinceFa: PROVINCES_DATA.find((p) => p.id === best)?.name ?? best };
}

// ─── ۶) بازگشت نرم قطعی (وقتی منبعی در دسترس نیست) ───────────
function simulatedAddress(lat: number, lng: number, provFa: string): Observed<GeocodeAddress> {
  const rnd = mulberry32(hashString(`${lat.toFixed(4)},${lng.toFixed(4)}:addr`));
  const names = ['محلهٔ گلستان', 'بافت مرکزی', 'کوی فرهنگ', 'شهرک سرو', 'محلهٔ نصر', 'بازارچهٔ محلی'];
  const name = names[Math.floor(rnd() * names.length)];
  return {
    status: 'simulated',
    fetchedAt: new Date().toISOString(),
    detail: 'ژئوکد معکوس در دسترس نبود — نام محله به‌صورت قطعی شبیه‌سازی شد',
    value: { name, neighbourhood: name, suburb: '', city: provFa, provinceFa: provFa, country: 'ایران' },
  };
}

function simulatedAir(lat: number, lng: number, provinceId: string): Observed<AirQualityObs> {
  const rnd = mulberry32(hashString(`${lat.toFixed(4)},${lng.toFixed(4)}:air`));
  const isHot = provinceId === 'KHZ' || provinceId === 'HOR' || provinceId === 'BSH';
  const base = isHot ? 0.72 : 0.45;
  const pm25 = clamp(15 + 70 * (base + (rnd() - 0.5) * 0.25), 12, 95);
  const pm10 = pm25 * (1.8 + rnd() * 0.5);
  const no2 = clamp(10 + 50 * (base + (rnd() - 0.5) * 0.25), 10, 75);
  const o3 = clamp(60 + 100 * (rnd() - 0.3), 40, 180);
  return {
    status: 'simulated',
    fetchedAt: new Date().toISOString(),
    detail: 'Open-Meteo AQ در دسترس نبود — مقادیر قطعی شبیه‌سازی‌شده بر پایهٔ استان',
    value: { pm25, pm10, no2, o3, so2: 5 + rnd() * 15, co: 300 + rnd() * 500, aqi: roughAqi(pm25, pm10, no2, o3) },
  };
}

function simulatedWeather(lat: number, lng: number, provinceId: string): Observed<WeatherObs> {
  const rnd = mulberry32(hashString(`${lat.toFixed(4)},${lng.toFixed(4)}:wx`));
  const isHot = provinceId === 'KHZ' || provinceId === 'HOR' || provinceId === 'BSH';
  return {
    status: 'simulated',
    fetchedAt: new Date().toISOString(),
    detail: 'Open-Meteo Forecast در دسترس نبود — مقادیر قطعی شبیه‌سازی‌شدهٔ اقلیمی',
    value: {
      temperature: isHot ? 36 + rnd() * 8 : 22 + rnd() * 14,
      humidity: 15 + rnd() * 55,
      precipitation: rnd() < 0.3 ? rnd() * 4 : 0,
      pressure: 880 + rnd() * 60,
      windSpeed: 5 + rnd() * 20,
      uvIndex: rnd() * 9,
      elevation: 900 + rnd() * 1200,
      weatherCode: 2,
    },
  };
}

function simulatedOsm(lat: number, lng: number, provinceId: string): Observed<OsmCounts> {
  const rnd = mulberry32(hashString(`${lat.toFixed(4)},${lng.toFixed(4)}:osm`));
  const urban = provinceId === 'TEH' || provinceId === 'ISF' || provinceId === 'KHR' || provinceId === 'EAZ';
  const k = (base: number, spread: number) => Math.max(0, Math.round(base + rnd() * spread));
  return {
    status: 'simulated',
    fetchedAt: new Date().toISOString(),
    detail: 'Overpass در دسترس نبود — شمارش POI به‌صورت قطعی شبیه‌سازی شد',
    value: {
      schools: k(urban ? 8 : 3, 10),
      health: k(urban ? 10 : 4, 14),
      finance: k(urban ? 9 : 2, 10),
      worship: k(4, 8),
      parks: k(urban ? 4 : 1, 5),
      market: k(urban ? 25 : 8, 30),
      shops: k(urban ? 60 : 15, 80),
      busStops: k(urban ? 12 : 3, 15),
      roads: k(urban ? 420 : 120, 300),
      buildings: k(urban ? 520 : 120, 400),
    },
  };
}

// ─── ۷) هماهنگ‌کنندهٔ اصلی: استخراج کامل یک نقطه ──────────────
/**
 * استخراج هم‌زمان (Promise.allSettled) از هر ۴ منبع برخط.
 * هر منبع مستقل: اگر موفق → live؛ اگر ناموفق → simulated قطعی + هشدار.
 * خروجی شامل منشأ هر منبع برای پنل اعتماد داده است.
 */
export async function ingestPoint(lat: number, lng: number): Promise<PointIngest> {
  const { provinceId, provinceFa } = detectProvince(lat, lng);
  const provenance: Provenance[] = [];
  const warnings: string[] = [];
  const fetchedAt = new Date().toISOString();

  // هر منبع با .catch به مقدار شبیه‌سازی‌شده بازمی‌گردد؛ بنابراین
  // allSettled همیشه fulfilled است و نیازی به شاخهٔ else نیست.
  const [addrR, airR, wxR, osmR] = await Promise.allSettled([
    reverseGeocode(lat, lng).catch(() => simulatedAddress(lat, lng, provinceFa)),
    fetchAirQuality(lat, lng).catch(() => simulatedAir(lat, lng, provinceId)),
    fetchWeather(lat, lng).catch(() => simulatedWeather(lat, lng, provinceId)),
    fetchOsmCounts(lat, lng).catch(() => simulatedOsm(lat, lng, provinceId)),
  ]);

  const address = addrR.status === 'fulfilled' ? addrR.value : simulatedAddress(lat, lng, provinceFa);
  const air = airR.status === 'fulfilled' ? airR.value : simulatedAir(lat, lng, provinceId);
  const weather = wxR.status === 'fulfilled' ? wxR.value : simulatedWeather(lat, lng, provinceId);
  const osm = osmR.status === 'fulfilled' ? osmR.value : simulatedOsm(lat, lng, provinceId);

  // منشأ هر منبع
  const mk = (key: string, fa: string, o: Observed<unknown>): Provenance => ({
    sourceKey: key,
    sourceFa: fa,
    status: o.status,
    detail: o.detail,
    fetchedAt: o.fetchedAt,
  });
  provenance.push(
    mk('OSM_OVERPASS', 'OpenStreetMap (Nominatim)', address),
    mk('OPEN_METEO', 'Open-Meteo (کیفیت هوا)', air),
    mk('OPEN_METEO', 'Open-Meteo (اقلیم)', weather),
    mk('OSM_OVERPASS', 'OpenStreetMap (Overpass)', osm),
  );
  for (const o of [address, air, weather, osm]) {
    if (o.status === 'simulated') warnings.push(`${o.detail}`);
  }
  provenance.push({
    sourceKey: 'OSM_OVERPASS',
    sourceFa: 'کانتور استانها (نقطهدرچندضلعی)',
    status: 'live',
    detail: `تشخیص استان «${provinceFa}» با کانتور واقعی ۳۱ استان (${provinceId})`,
    fetchedAt,
  });

  return { lat, lng, address, air, weather, osm, provinceId, provinceFa, provenance, warnings };
}
