/**
 * P0 — کانکتورهای منابع عمومی.
 *
 * هر کانکتور فقط با runtime مشترک کار می‌کند: کش، مهلت زمانی، retry و
 * circuit breaker را از بالا می‌گیرد و منطق دامنه‌ای خودش را دارد.
 * fallback‌ها (Overpass → PBF محلی، WHO → World Bank) همان‌قدر که در
 * منیفست اعلان شده، اینجا فعال می‌شوند.
 */

import {
  DEFAULT_OVERPASS_ENDPOINTS,
  DEFAULT_LOCAL_POI_PATH,
  WHO_WORLD_BANK_FALLBACKS,
  buildHealthQuery,
  buildPoiQuery,
  buildWalkabilityQuery,
  countPoiFeatures,
  haversineKm,
  normalizeHealthsitesPayload,
  normalizeOverpassFeatures,
  normalizeWalkability,
  readLocalPoiPoints,
} from '../externalDataProxy';
import type {
  Connector,
  ConnectorContext,
  SourceManifest,
  SourceResult,
  SourceVariable,
} from './types';
import { SourceRuntime, describeError } from './runtime';
import { getManifest } from './manifests';

export interface ConnectorDeps {
  runtime: SourceRuntime;
  overpassEndpoints?: string[];
  localPoiPath?: string;
}

export class SourceQueryError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'SourceQueryError';
  }
}

/** منبع به پیکربندی/اعتبارنامهٔ غایب برخورده — با خطای شبکه اشتباه نشود */
export class SourceConfigError extends Error {
  constructor(message: string, public readonly envVar?: string) {
    super(message);
    this.name = 'SourceConfigError';
  }
}

/** پارسر سبک CSV برای منابع متنی (FIRMS) */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((name, index) => { row[name] = (cells[index] ?? '').trim(); });
    return row;
  });
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function mustManifest(id: string): SourceManifest {
  const manifest = getManifest(id);
  if (!manifest) throw new Error(`manifest ${id} is not declared`);
  return manifest;
}

function requirePoint(ctx: ConnectorContext, id: string): { lat: number; lng: number } {
  if (!ctx.point) throw new SourceQueryError(`منبع «${id}» به نقطهٔ مکانی نیاز دارد (lat,lng).`);
  return ctx.point;
}

function bboxFrom(ctx: ConnectorContext, halfDegrees: number): [number, number, number, number] {
  if (ctx.bbox) return ctx.bbox;
  const point = requirePoint(ctx, 'bbox');
  return [ctx.point!.lng - halfDegrees, ctx.point!.lat - halfDegrees, ctx.point!.lng + halfDegrees, ctx.point!.lat + halfDegrees];
}

function result(
  manifest: SourceManifest,
  variables: SourceVariable[],
  meta: {
    latencyMs: number;
    cache: SourceResult['provenance']['cache'];
    provider: 'live' | 'fallback' | 'local';
    fallbackFrom?: string;
  },
): SourceResult {
  return {
    sourceId: manifest.id,
    variables,
    provenance: {
      sourceId: manifest.id,
      endpoint: manifest.endpoint,
      license: manifest.license.name,
      attribution: manifest.license.attribution,
      fetchedAt: new Date().toISOString(),
      latencyMs: meta.latencyMs,
      cache: meta.cache,
      provider: meta.provider,
      fallbackFrom: meta.fallbackFrom,
      evidenceOnly: manifest.role === 'evidence_only',
    },
  };
}

/** اجرای Overpass با زنجیرهٔ endpointها؛ فقط آخرین خطا گزارش می‌شود */
async function fetchOverpass(runtime: SourceRuntime, sourceId: string, query: string, endpoints: string[]): Promise<unknown> {
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      return await runtime.fetchJson(sourceId, endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'ARA-Neighborhood-Decision-Support/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('all Overpass endpoints failed');
}

function createAirConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('open-meteo-air');
  const { runtime } = deps;
  const currentFields = ['pm2_5', 'nitrogen_dioxide', 'sulphur_dioxide', 'pm10', 'ozone'] as const;

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const url = new URL(manifest.endpoint);
      url.searchParams.set('latitude', point.lat.toFixed(4));
      url.searchParams.set('longitude', point.lng.toFixed(4));

      let historical = false;
      if (ctx.at) {
        const day = ctx.at.slice(0, 10);
        historical = true;
        url.searchParams.set('start_date', day);
        url.searchParams.set('end_date', day);
        url.searchParams.set('hourly', currentFields.join(','));
      } else {
        url.searchParams.set('current', currentFields.join(','));
      }

      const key = `${historical ? 'hist' : 'cur'}:${point.lat.toFixed(3)},${point.lng.toFixed(3)}:${ctx.at ?? ''}`;
      const cache = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const payload = (await runtime.fetchJson(manifest.id, url.toString(), { signal })) as {
          current?: Record<string, unknown>;
          hourly?: Record<string, unknown[]>;
          current_units?: Record<string, string>;
        };
        const variables: SourceVariable[] = [];
        for (const field of currentFields) {
          let value: number | null = null;
          if (historical && Array.isArray(payload.hourly?.[field])) {
            const series = payload.hourly[field] as unknown[];
            const hour = ctx.at ? Number(ctx.at.slice(11, 13)) : 12;
            const raw = series[Number.isFinite(hour) ? clamp(hour, 0, series.length - 1) : 0];
            value = typeof raw === 'number' ? raw : null;
          } else {
            const raw = payload.current?.[field];
            value = typeof raw === 'number' ? raw : null;
          }
          variables.push({
            variable: field,
            value,
            unit: manifest.feeds.find(f => f.variable === field)?.unit ?? payload.current_units?.[field],
            observedAt: ctx.at ?? new Date(runtime.now()).toISOString(),
            indicatorCode: manifest.feeds.find(f => f.variable === field)?.indicatorCode,
          });
        }
        if (variables.every(v => v.value === null)) throw new Error('Open-Meteo returned no usable values');
        return variables;
      });

      return result(manifest, cache.value, { latencyMs: cache.latencyMs, cache: cache.cache, provider: 'live' });
    },
  };
}

function createClimateConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('open-meteo-climate');
  const { runtime } = deps;
  const fields = ['temperature_2m_mean', 'precipitation_sum', 'relative_humidity_2m_mean'] as const;

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const url = new URL(manifest.endpoint);
      url.searchParams.set('latitude', point.lat.toFixed(4));
      url.searchParams.set('longitude', point.lng.toFixed(4));
      const endDate = ctx.at ? ctx.at.slice(0, 10) : new Date(runtime.now()).toISOString().slice(0, 10);
      const startDate = ctx.at
        ? ctx.at.slice(0, 10)
        : new Date(runtime.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      url.searchParams.set('start_date', startDate);
      url.searchParams.set('end_date', endDate);
      url.searchParams.set('daily', fields.join(','));

      const key = `climate:${point.lat.toFixed(3)},${point.lng.toFixed(3)}:${startDate}:${endDate}`;
      const cache = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const payload = (await runtime.fetchJson(manifest.id, url.toString(), { signal })) as { daily?: Record<string, Array<number | null>> };
        const daily = payload.daily ?? {};
        return fields.map<SourceVariable>(field => {
          const series = (daily[field] ?? []).filter((x): x is number => typeof x === 'number');
          const value = series.length ? series.reduce((a, b) => a + b, 0) / series.length : null;
          return {
            variable: field,
            value,
            unit: manifest.feeds.find(f => f.variable === field)?.unit,
            observedAt: `${startDate}/${endDate}`,
            indicatorCode: manifest.feeds.find(f => f.variable === field)?.indicatorCode,
          };
        });
      });

      return result(manifest, cache.value, { latencyMs: cache.latencyMs, cache: cache.cache, provider: 'live' });
    },
  };
}

function createWorldBankConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('worldbank');
  const { runtime } = deps;

  return {
    manifest,
    async query(_ctx, signal) {
      const variables: SourceVariable[] = [];
      let provider: 'live' | 'fallback' = 'live';
      let latency = 0;
      let cacheMode: SourceResult['provenance']['cache'] = 'MISS';

      for (const feed of manifest.feeds) {
        const url = new URL(`${manifest.endpoint}/country/IRN/indicator/${encodeURIComponent(feed.variable)}`);
        url.searchParams.set('format', 'json');
        url.searchParams.set('per_page', '1');
        url.searchParams.set('mrnev', '1');
        try {
          const cached = await runtime.cached(manifest.id, feed.variable, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
            const payload = (await runtime.fetchJson(manifest.id, url.toString(), { signal })) as unknown[];
            const row = Array.isArray(payload?.[1]) ? (payload[1] as Array<Record<string, unknown>>)[0] : undefined;
            const value = typeof row?.value === 'number' ? row.value : null;
            return { value, date: typeof row?.date === 'string' ? row.date : null } as { value: number | null; date: string | null };
          });
          latency = Math.max(latency, cached.latencyMs);
          cacheMode = cached.cache;
          variables.push({ variable: feed.variable, value: cached.value.value, unit: feed.unit, observedAt: cached.value.date ?? undefined, indicatorCode: feed.indicatorCode });
        } catch (error) {
          runtime.recordFallback(manifest.id, describeError(error));
          provider = 'fallback';
          variables.push({ variable: feed.variable, value: null, unit: feed.unit, indicatorCode: feed.indicatorCode });
        }
      }

      return result(manifest, variables, { latencyMs: latency, cache: cacheMode, provider });
    },
  };
}

function createWhoConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('who-gho');
  const { runtime } = deps;

  return {
    manifest,
    async query(_ctx, signal) {
      const variables: SourceVariable[] = [];
      let provider: 'live' | 'fallback' = 'live';
      let latency = 0;
      let cacheMode: SourceResult['provenance']['cache'] = 'MISS';

      for (const feed of manifest.feeds) {
        const url = new URL(`${manifest.endpoint}/${encodeURIComponent(feed.variable)}`);
        url.searchParams.set('$filter', "SpatialDim eq 'IRN'");
        url.searchParams.set('$orderby', 'TimeDim desc');
        url.searchParams.set('$top', '1');
        try {
          const cached = await runtime.cached(manifest.id, feed.variable, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
            const payload = (await runtime.fetchJson(manifest.id, url.toString(), { signal })) as { value?: Array<Record<string, unknown>> };
            const row = Array.isArray(payload?.value) ? payload.value[0] : undefined;
            const value = typeof row?.NumericValue === 'number' ? row.NumericValue : null;
            if (value === null) throw new Error(`WHO GHO has no value for ${feed.variable}`);
            return { value, time: typeof row?.TimeDim === 'number' ? String(row.TimeDim) : null };
          });
          latency = Math.max(latency, cached.latencyMs);
          cacheMode = cached.cache;
          variables.push({ variable: feed.variable, value: cached.value.value, unit: feed.unit, observedAt: cached.value.time ?? undefined, indicatorCode: feed.indicatorCode });
        } catch (error) {
          runtime.recordFallback(manifest.id, describeError(error));
          const fallback = await worldBankFallback(runtime, feed.variable, signal);
          if (fallback === null) {
            provider = 'fallback';
            variables.push({ variable: feed.variable, value: null, unit: feed.unit, indicatorCode: feed.indicatorCode });
          } else {
            provider = 'fallback';
            variables.push({ variable: feed.variable, value: fallback, unit: feed.unit, indicatorCode: feed.indicatorCode });
          }
        }
      }

      return result(manifest, variables, { latencyMs: latency, cache: cacheMode, provider, fallbackFrom: provider === 'fallback' ? 'worldbank' : undefined });
    },
  };
}

async function worldBankFallback(runtime: SourceRuntime, whoIndicator: string, signal?: AbortSignal): Promise<number | null> {
  const indicator = WHO_WORLD_BANK_FALLBACKS[whoIndicator] ?? WHO_WORLD_BANK_FALLBACKS[whoIndicator.replace(/_/g, '')];
  if (!indicator) return null;
  const url = new URL(`https://api.worldbank.org/v2/country/IRN/indicator/${encodeURIComponent(indicator)}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('per_page', '1');
  url.searchParams.set('mrnev', '1');
  try {
    const payload = (await runtime.fetchJson('worldbank', url.toString(), { signal })) as unknown[];
    const row = Array.isArray(payload?.[1]) ? (payload[1] as Array<Record<string, unknown>>)[0] : undefined;
    return typeof row?.value === 'number' ? row.value : null;
  } catch {
    return null;
  }
}

function createPoiConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('osm-pois');
  const { runtime } = deps;
  const endpoints = deps.overpassEndpoints?.length ? deps.overpassEndpoints : DEFAULT_OVERPASS_ENDPOINTS;
  const localPoiPath = deps.localPoiPath ?? DEFAULT_LOCAL_POI_PATH;

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const south = point.lat - 0.015;
      const west = point.lng - 0.015;
      const north = point.lat + 0.015;
      const east = point.lng + 0.015;
      const query = buildPoiQuery(south, west, north, east);
      const key = `pois:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        try {
          const payload = await fetchOverpass(runtime, manifest.id, query, endpoints);
          const features = normalizeOverpassFeatures(payload);
          // پاسخ خالی یعنی «پوشش OSM وجود ندارد»، نه «صفر مکان». نباید صفر ثبت شود.
          if (features.length === 0) throw new Error('Overpass returned no features for the requested bbox');
          return { counts: countPoiFeatures(features), provider: 'live' as const, from: undefined as string | undefined };
        } catch (primaryError) {
          const local = readLocalPoiPoints(localPoiPath);
          if (local.length === 0) throw primaryError;
          const localFeatures = local.flatMap(p => {
            if (!p.c) return [];
            const distance = Math.hypot((p.c[1] - point.lat) * 111, (p.c[0] - point.lng) * 88);
            if (distance > 2.5) return [];
            return [{ properties: { type: String(p.t ?? '').toLowerCase(), name: p.n ?? null } }];
          });
          if (localFeatures.length === 0) throw primaryError;
          return { counts: countPoiFeatures(localFeatures), provider: 'local' as const, from: 'local-osm-pbf' };
        }
      });

      const counts = cached.value.counts;
      const variables: SourceVariable[] = [
        { variable: 'poi_education', value: counts.schools, unit: 'count', indicatorCode: 'R3' },
        { variable: 'poi_health', value: counts.hospitals + counts.pharmacies, unit: 'count', indicatorCode: 'P4' },
        { variable: 'poi_commerce', value: counts.supermarkets + counts.banks + counts.restaurants, unit: 'count', indicatorCode: 'E2' },
        { variable: 'poi_culture', value: counts.mosques, unit: 'count', indicatorCode: 'C1' },
        { variable: 'poi_transport', value: counts.busStops, unit: 'count', indicatorCode: 'P5' },
      ];
      void signal;

      return result(manifest, variables, {
        latencyMs: cached.latencyMs,
        cache: cached.cache,
        provider: cached.value.provider,
        fallbackFrom: cached.value.from,
      });
    },
  };
}

function createWalkabilityConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('osm-walkability');
  const { runtime } = deps;
  const endpoints = deps.overpassEndpoints?.length ? deps.overpassEndpoints : DEFAULT_OVERPASS_ENDPOINTS;

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const south = point.lat - 0.01;
      const west = point.lng - 0.01;
      const north = point.lat + 0.01;
      const east = point.lng + 0.01;
      const query = buildWalkabilityQuery(south, west, north, east);
      const key = `walk:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const payload = await fetchOverpass(runtime, manifest.id, query, endpoints);
        const metrics = normalizeWalkability(payload);
        const score = clamp(20 + metrics.sidewalkDensity * 0.6 + metrics.crossingDensity * 0.4 + metrics.streetLightDensity * 0.3, 0, 100);
        return { score, metrics };
      });
      void signal;

      const variables: SourceVariable[] = [
        { variable: 'walkability_score', value: Math.round(cached.value.score * 10) / 10, unit: '0..100', indicatorCode: 'N1' },
      ];

      return result(manifest, variables, { latencyMs: cached.latencyMs, cache: cached.cache, provider: 'live' });
    },
  };
}

function createHealthsitesConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('healthsites');
  const { runtime } = deps;
  const endpoints = deps.overpassEndpoints?.length ? deps.overpassEndpoints : DEFAULT_OVERPASS_ENDPOINTS;
  const localPoiPath = deps.localPoiPath ?? DEFAULT_LOCAL_POI_PATH;

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const apiKey = process.env.HEALTHSITES_API_KEY?.trim();
      const key = `health:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        // نسخهٔ ۲ این API بازنشسته شده و به‌جای JSON یک پیام متنی برمی‌گرداند؛ نسخهٔ ۳
        // به کلید (`api-key`) نیاز دارد. بدون کلید مستقیم به مسیر اعلامی osm-pois
        // می‌رویم تا هر درخواست روی endpoint مرده معطل نشود.
        if (apiKey) {
          try {
            const primaryUrl = new URL(manifest.endpoint);
            primaryUrl.searchParams.set('api-key', apiKey);
            primaryUrl.searchParams.set('extent', `${point.lng - 0.045},${point.lat - 0.045},${point.lng + 0.045},${point.lat + 0.045}`);
            primaryUrl.searchParams.set('page', '1');
            primaryUrl.searchParams.set('output', 'geojson');
            const payload = await runtime.fetchJson(manifest.id, primaryUrl.toString(), { signal });
            const features = normalizeHealthsitesPayload(payload).features;
            if (features.length > 0) return { count: features.length, provider: 'live' as const, from: undefined as string | undefined };
            runtime.recordFallback(manifest.id, 'Healthsites returned no facilities for the requested extent');
          } catch (error) {
            runtime.recordFallback(manifest.id, describeError(error));
          }
        }
        {
          const south = point.lat - 0.045;
          const west = point.lng - 0.045;
          const north = point.lat + 0.045;
          const east = point.lng + 0.045;
          const query = buildHealthQuery(south, west, north, east);
          try {
            const payload = await fetchOverpass(runtime, 'osm-pois', query, endpoints);
            return { count: normalizeOverpassFeatures(payload).length, provider: 'fallback' as const, from: 'osm-pois' };
          } catch (overpassError) {
            const local = readLocalPoiPoints(localPoiPath);
            const allowed = new Set(['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'nursing_home', 'laboratory']);
            const count = local.filter(p => {
              if (!p.c || !allowed.has(String(p.t ?? '').toLowerCase())) return false;
              return Math.hypot((p.c[1] - point.lat) * 111, (p.c[0] - point.lng) * 88) <= 5;
            }).length;
            if (count === 0) throw overpassError;
            return { count, provider: 'local' as const, from: 'local-osm-pbf' };
          }
        }
      });

      const variables: SourceVariable[] = [
        { variable: 'health_facilities', value: cached.value.count, unit: 'count', indicatorCode: 'P4' },
      ];
      return result(manifest, variables, {
        latencyMs: cached.latencyMs,
        cache: cached.cache,
        provider: cached.value.provider,
        fallbackFrom: cached.value.from,
      });
    },
  };
}

function createStacConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('satellite-stac');
  const { runtime } = deps;

  return {
    manifest,
    async query(ctx, signal) {
      const bbox = ctx.bbox ?? bboxFrom(ctx, 0.02);
      const end = ctx.at ?? new Date(runtime.now()).toISOString();
      const start = new Date(runtime.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const key = `stac:${bbox.map(v => v.toFixed(3)).join(',')}:${end.slice(0, 10)}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const payload = (await runtime.fetchJson(manifest.id, manifest.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ collections: ['sentinel-2-l2a'], bbox, datetime: `${start}/${end}`, limit: 100 }),
          signal,
        })) as { features?: unknown[] };
        return Array.isArray(payload.features) ? payload.features.length : 0;
      });

      const variables: SourceVariable[] = [
        { variable: 'scene_count', value: cached.value, unit: 'count', observedAt: end, indicatorCode: 'N2' },
      ];
      return result(manifest, variables, { latencyMs: cached.latencyMs, cache: cached.cache, provider: 'live' });
    },
  };
}

function createOpenAqConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('openaq');
  const { runtime } = deps;
  const apiKey = process.env.OPENAQ_API_KEY?.trim();

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      if (!apiKey) {
        throw new SourceConfigError('منبع OpenAQ به کلید نیاز دارد؛ OPENAQ_API_KEY تنظیم نشده است.', 'OPENAQ_API_KEY');
      }
      const headers = { Accept: 'application/json', 'X-API-Key': apiKey };
      const listUrl = new URL(manifest.endpoint);
      listUrl.searchParams.set('coordinates', `${point.lat},${point.lng}`);
      listUrl.searchParams.set('radius', '25000');
      listUrl.searchParams.set('limit', '5');
      const key = `openaq:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const listing = (await runtime.fetchJson(manifest.id, listUrl.toString(), { headers, signal })) as {
          results?: Array<{ id?: number; name?: string }>;
        };
        const stations = (listing.results ?? []).filter(s => typeof s.id === 'number').slice(0, 5);
        if (stations.length === 0) throw new Error('OpenAQ has no station within 25 km of the requested point');

        const samples: Record<string, number[]> = { pm25: [], pm10: [], no2: [] };
        for (const station of stations) {
          const latestUrl = `https://api.openaq.org/v3/locations/${station.id}/latest`;
          try {
            const latest = (await runtime.fetchJson(manifest.id, latestUrl, { headers, signal })) as {
              results?: Array<{ value?: number; parameter?: { name?: string } }>;
            };
            for (const reading of latest.results ?? []) {
              const name = String(reading.parameter?.name ?? '').toLowerCase();
              const value = typeof reading.value === 'number' ? reading.value : null;
              if (value === null) continue;
              if (name === 'pm25') samples.pm25.push(value);
              else if (name === 'pm10') samples.pm10.push(value);
              else if (name === 'no2') samples.no2.push(value);
            }
          } catch (error) {
            runtime.recordFallback(manifest.id, describeError(error));
          }
        }
        const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
        const stationsWithData = [mean(samples.pm25), mean(samples.pm10), mean(samples.no2)].filter(v => v !== null).length;
        if (stationsWithData === 0) throw new Error('OpenAQ stations nearby reported no usable measurements');
        return { stations: stations.length, pm25: mean(samples.pm25), pm10: mean(samples.pm10), no2: mean(samples.no2) };
      });

      const observedAt = ctx.at ?? new Date(runtime.now()).toISOString();
      const variables: SourceVariable[] = [
        { variable: 'pm25_station', value: cached.value.pm25, unit: 'µg/m³', observedAt, indicatorCode: 'N3' },
        { variable: 'pm10_station', value: cached.value.pm10, unit: 'µg/m³', observedAt, indicatorCode: 'N3' },
        { variable: 'no2_station', value: cached.value.no2, unit: 'µg/m³', observedAt, indicatorCode: 'N3' },
        { variable: 'station_count', value: cached.value.stations, unit: 'count', observedAt },
      ];
      return result(manifest, variables, { latencyMs: cached.latencyMs, cache: cached.cache, provider: 'live' });
    },
  };
}

function createFirmsConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('firms');
  const { runtime } = deps;
  const mapKey = process.env.FIRMS_MAP_KEY?.trim();

  return {
    manifest,
    async query(ctx, signal) {
      const [west, south, east, north] = ctx.bbox ?? bboxFrom(ctx, 0.02);
      // پوشش منطقهٔ «جنوب آسیا» فقط ۵۴ تا ۶۴ درجهٔ شرقی ایران را دربر می‌گیرد
      // (تأیید تجربی)، بنابراین فایل کامل ۲۴ساعتهٔ جهانی پیش‌فرض است.
      const url = mapKey
        ? `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/VIIRS_SNPP_NRT/${west},${south},${east},${north}/1`
        : manifest.endpoint;
      // پنجرهٔ ۲۴ساعته وابسته به زمان است؛ پس زمان در کلید کش می‌آید
      const key = `firms:${west.toFixed(2)},${south.toFixed(2)},${east.toFixed(2)},${north.toFixed(2)}:${ctx.at ?? 'latest'}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const text = await runtime.fetchText(manifest.id, url, { headers: { Accept: 'text/csv', 'User-Agent': 'ARA-Neighborhood-Decision-Support/1.0' }, signal });
        const rows = parseCsv(text);
        if (rows.length === 0) throw new Error('FIRMS returned no rows at all — the feed is unavailable, not fire-free');
        const inBox = rows.filter(row => {
          const lat = Number(row.latitude);
          const lng = Number(row.longitude);
          return Number.isFinite(lat) && Number.isFinite(lng) && lat >= south && lat <= north && lng >= west && lng <= east;
        });
        const total = inBox.reduce((sum, row) => {
          const frp = Number(row.frp);
          return sum + (Number.isFinite(frp) ? frp : 0);
        }, 0);
        // فایل کامل واکشی شده و هیچ نقطهٔ داغی در پنجره نیست ⇒ صفر واقعی، نه کمبود داده.
        return { hotspots: inBox.length, frpMw: Math.round(total * 100) / 100 };
      });

      const variables: SourceVariable[] = [
        { variable: 'fire_hotspots', value: cached.value.hotspots, unit: 'count', observedAt: ctx.at, indicatorCode: 'N4' },
        { variable: 'fire_frp_mw', value: cached.value.frpMw, unit: 'MW', observedAt: ctx.at },
      ];
      // بدون MAP_KEY فایل کامل ۲۴ساعتهٔ عمومی واکشی می‌شود — این هم دادهٔ زندهٔ
      // رسمی همان منبع است، نه fallback؛ فقط بدون کلید پنجره سمت سرور بسته نمی‌شود.
      return result(manifest, variables, { latencyMs: cached.latencyMs, cache: cached.cache, provider: 'live' });
    },
  };
}

const OSRM_HEALTH_TYPES = new Set(['hospital', 'clinic', 'doctors', 'dentist']);
const OSRM_EDUCATION_TYPES = new Set(['school', 'kindergarten', 'college', 'university']);

function nearestPoi(points: LocalPoiPointLike[], origin: { lat: number; lng: number }, allowed: Set<string>): { lat: number; lng: number; distanceKm: number } | null {
  let best: { lat: number; lng: number; distanceKm: number } | null = null;
  for (const point of points) {
    if (!point.c) continue;
    if (!allowed.has(String(point.t ?? '').toLowerCase())) continue;
    const [lng, lat] = point.c;
    const distanceKm = haversineKm(origin.lat, origin.lng, lat, lng);
    if (!best || distanceKm < best.distanceKm) best = { lat, lng, distanceKm };
  }
  return best;
}

interface LocalPoiPointLike { t?: string; n?: string; c?: [number, number] }

function createOsrmConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('osrm');
  const { runtime } = deps;
  const localPoiPath = deps.localPoiPath ?? DEFAULT_LOCAL_POI_PATH;

  const route = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }, signal?: AbortSignal) => {
    const url = `${manifest.endpoint}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const payload = (await runtime.fetchJson(manifest.id, url, { headers: { Accept: 'application/json' }, signal })) as {
      code?: string;
      routes?: Array<{ duration?: number; distance?: number }>;
    };
    if (payload.code && payload.code !== 'Ok') throw new Error(`OSRM returned ${payload.code}`);
    const route0 = payload.routes?.[0];
    const durationSeconds = typeof route0?.duration === 'number' ? route0.duration : null;
    const distanceMeters = typeof route0?.distance === 'number' ? route0.distance : null;
    if (durationSeconds === null && distanceMeters === null) throw new Error('OSRM returned no route');
    return { minutes: durationSeconds === null ? null : durationSeconds / 60, km: distanceMeters === null ? null : distanceMeters / 1000 };
  };

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const points = readLocalPoiPoints(localPoiPath);
      const health = nearestPoi(points, point, OSRM_HEALTH_TYPES);
      const education = nearestPoi(points, point, OSRM_EDUCATION_TYPES);
      if (!health && !education) {
        throw new Error('OSRM needs destinations: the local POI extract has no health or education anchor near this point');
      }
      const key = `osrm:${point.lat.toFixed(4)},${point.lng.toFixed(4)}:${health?.lat.toFixed(4) ?? '-'}:${education?.lat.toFixed(4) ?? '-'}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const [healthRoute, educationRoute] = await Promise.all([
          health ? route(point, health, signal) : Promise.resolve(null),
          education ? route(point, education, signal) : Promise.resolve(null),
        ]);
        return {
          health, education, healthRoute, educationRoute,
          anchorKm: Math.max(health?.distanceKm ?? 0, education?.distanceKm ?? 0),
        };
      });

      const value = cached.value;
      const variables: SourceVariable[] = [
        { variable: 'travel_time_health_min', value: value.healthRoute?.minutes ?? null, unit: 'min', indicatorCode: 'R1' },
        { variable: 'travel_time_education_min', value: value.educationRoute?.minutes ?? null, unit: 'min', indicatorCode: 'R3' },
        { variable: 'route_distance_km', value: value.healthRoute?.km ?? value.educationRoute?.km ?? null, unit: 'km' },
      ];
      if (variables.every(v => v.value === null)) throw new Error('OSRM returned no usable route for any anchor');
      return result(manifest, variables, { latencyMs: cached.latencyMs, cache: cached.cache, provider: 'live' });
    },
  };
}

function createFloodConnector(deps: ConnectorDeps): Connector {
  const manifest = mustManifest('glofas-flood');
  const { runtime } = deps;

  return {
    manifest,
    async query(ctx, signal) {
      const point = requirePoint(ctx, manifest.id);
      const url = new URL(manifest.endpoint);
      url.searchParams.set('latitude', point.lat.toFixed(4));
      url.searchParams.set('longitude', point.lng.toFixed(4));
      url.searchParams.set('daily', 'river_discharge');
      if (ctx.at) {
        url.searchParams.set('start_date', ctx.at.slice(0, 10));
        url.searchParams.set('end_date', ctx.at.slice(0, 10));
      } else {
        url.searchParams.set('forecast_days', '7');
      }
      const key = `flood:${point.lat.toFixed(3)},${point.lng.toFixed(3)}:${ctx.at ?? 'now'}`;

      const cached = await runtime.cached(manifest.id, key, manifest.temporal.ttlMs, manifest.temporal.staleTtlMs ?? 0, async () => {
        const payload = (await runtime.fetchJson(manifest.id, url.toString(), { signal })) as {
          daily?: { river_discharge?: Array<number | null> };
        };
        const series = payload.daily?.river_discharge ?? [];
        const numbers = series.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        if (numbers.length === 0) throw new Error('Open-Meteo Flood returned no river discharge for this point (no modelled river cell)');
        return {
          max: Math.max(...numbers),
          mean: numbers.reduce((a, b) => a + b, 0) / numbers.length,
          days: numbers.length,
        };
      });

      const round = (v: number) => Math.round(v * 1000) / 1000;
      const variables: SourceVariable[] = [
        { variable: 'river_discharge_max', value: round(cached.value.max), unit: 'm³/s', indicatorCode: 'N5' },
        { variable: 'river_discharge_mean', value: round(cached.value.mean), unit: 'm³/s' },
      ];
      return result(manifest, variables, { latencyMs: cached.latencyMs, cache: cached.cache, provider: 'live' });
    },
  };
}

export function createConnectors(deps: ConnectorDeps): Connector[] {
  return [
    createAirConnector(deps),
    createClimateConnector(deps),
    createWorldBankConnector(deps),
    createWhoConnector(deps),
    createPoiConnector(deps),
    createWalkabilityConnector(deps),
    createHealthsitesConnector(deps),
    createStacConnector(deps),
    createOpenAqConnector(deps),
    createFirmsConnector(deps),
    createOsrmConnector(deps),
    createFloodConnector(deps),
  ];
}
