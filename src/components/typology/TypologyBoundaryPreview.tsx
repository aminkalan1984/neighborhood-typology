import { AlertTriangle, CheckCircle2, MapPinned } from 'lucide-react';

export type BoundaryGeometry = Record<string, unknown> | null | undefined;

type Position = [number, number];
type Ring = Position[];

interface NormalizedBoundary {
  type: 'Polygon' | 'MultiPolygon' | null;
  polygons: Ring[][];
  positions: number;
  warnings: string[];
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
}

export interface TypologyBoundaryPreviewProps {
  geometry: BoundaryGeometry;
  compact?: boolean;
  label?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function position(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = value[0];
  const lat = value[1];
  return typeof lon === 'number' && Number.isFinite(lon) && typeof lat === 'number' && Number.isFinite(lat)
    ? [lon, lat]
    : null;
}

function ringsForGeometry(value: Record<string, unknown>): { type: NormalizedBoundary['type']; polygons: Ring[][] } {
  const type = value.type;
  const coordinates = value.coordinates;
  if (type === 'Polygon' && Array.isArray(coordinates)) {
    return { type, polygons: [coordinates.map((ring) => Array.isArray(ring) ? ring.map(position).filter((item): item is Position => Boolean(item)) : [])] };
  }
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    return {
      type,
      polygons: coordinates.map((polygon) => Array.isArray(polygon)
        ? polygon.map((ring) => Array.isArray(ring) ? ring.map(position).filter((item): item is Position => Boolean(item)) : [])
        : []),
    };
  }
  return { type: null, polygons: [] };
}

function extractGeometry(input: BoundaryGeometry): Record<string, unknown> | null {
  const root = asRecord(input);
  if (!root) return null;
  if (root.type === 'Feature') return asRecord(root.geometry);
  if (root.type === 'FeatureCollection' && Array.isArray(root.features)) {
    const geometries = root.features.map(asRecord).map((feature) => feature ? asRecord(feature.geometry) : null).filter(Boolean) as Record<string, unknown>[];
    if (geometries.length === 1) return geometries[0];
    if (geometries.length > 1) {
      return { type: 'MultiPolygon', coordinates: geometries.flatMap((item) => {
        if (item.type === 'Polygon' && Array.isArray(item.coordinates)) return [item.coordinates];
        if (item.type === 'MultiPolygon' && Array.isArray(item.coordinates)) return item.coordinates;
        return [];
      }) };
    }
  }
  return root;
}

export function inspectBoundaryGeometry(input: BoundaryGeometry): NormalizedBoundary {
  const geometry = extractGeometry(input);
  if (!geometry) return { type: null, polygons: [], positions: 0, warnings: ['هندسه‌ای برای پیش‌نمایش انتخاب نشده است.'], bounds: null };
  const normalized = ringsForGeometry(geometry);
  const warnings = normalized.type ? [] : ['فقط Polygon و MultiPolygon پشتیبانی می‌شود.'];
  const all = normalized.polygons.flatMap((polygon) => polygon.flat());
  let bounds: NormalizedBoundary['bounds'] = null;
  for (const [lon, lat] of all) {
    if (!bounds) bounds = { minLon: lon, maxLon: lon, minLat: lat, maxLat: lat };
    else {
      bounds.minLon = Math.min(bounds.minLon, lon);
      bounds.maxLon = Math.max(bounds.maxLon, lon);
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
    }
  }
  normalized.polygons.forEach((polygon, polygonIndex) => {
    if (!polygon.length || polygon[0].length < 4) warnings.push(`پلیگون ${polygonIndex + 1} حلقهٔ کافی ندارد.`);
    polygon.forEach((ring, ringIndex) => {
      if (ring.length < 4) warnings.push(`حلقهٔ ${polygonIndex + 1}.${ringIndex + 1} کمتر از چهار نقطه دارد.`);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) warnings.push(`حلقهٔ ${polygonIndex + 1}.${ringIndex + 1} بسته نیست.`);
      ring.forEach(([lon, lat]) => {
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) warnings.push(`مختصات حلقهٔ ${polygonIndex + 1}.${ringIndex + 1} خارج از WGS84 است.`);
      });
    });
  });
  return { ...normalized, positions: all.length, warnings: [...new Set(warnings)], bounds };
}

function project(ring: Ring, bounds: NonNullable<NormalizedBoundary['bounds']>): string {
  const width = Math.max(bounds.maxLon - bounds.minLon, 0.000001);
  const height = Math.max(bounds.maxLat - bounds.minLat, 0.000001);
  const scale = Math.min(280 / width, 140 / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  const offsetX = (320 - drawnWidth) / 2;
  const offsetY = (180 - drawnHeight) / 2;
  return ring.map(([lon, lat]) => `${(offsetX + (lon - bounds.minLon) * scale).toFixed(2)},${(offsetY + (bounds.maxLat - lat) * scale).toFixed(2)}`).join(' ');
}

function numberFa(value: number, digits = 2): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(value);
}

export default function TypologyBoundaryPreview({ geometry, compact = false, label = 'پیش‌نمایش مرز' }: TypologyBoundaryPreviewProps) {
  const inspected = inspectBoundaryGeometry(geometry);
  const valid = inspected.type !== null && inspected.positions > 0 && inspected.warnings.length === 0;
  const bounds = inspected.bounds;

  return (
    <section className={`border border-line bg-surface ${compact ? 'rounded-md p-3' : 'rounded-lg p-4'}`} dir="rtl" aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-800"><MapPinned size={15} /></span>
          <div className="min-w-0">
            <h3 className="truncate text-[10px] font-black text-ink-800">{label}</h3>
            <p className="mt-1 text-[9px] font-bold text-ink-400">{inspected.type ? `${inspected.type} · ${numberFa(inspected.positions)} نقطه` : 'هندسه دریافت نشده'}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black ${valid ? 'border-ok/30 bg-ok-soft text-ok-700' : 'border-warn/30 bg-warn-soft text-warn-700'}`}>
          {valid ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          {valid ? 'ساختاری معتبر' : 'نیازمند بررسی'}
        </span>
      </div>

      {bounds && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[8px] font-bold text-ink-500 sm:grid-cols-4">
          <span>پلیگون: <b className="text-ink-800">{numberFa(inspected.polygons.length)}</b></span>
          <span>حلقه: <b className="text-ink-800">{numberFa(inspected.polygons.reduce((sum, polygon) => sum + polygon.length, 0))}</b></span>
          <span dir="ltr">Lon {bounds.minLon.toFixed(3)}…{bounds.maxLon.toFixed(3)}</span>
          <span dir="ltr">Lat {bounds.minLat.toFixed(3)}…{bounds.maxLat.toFixed(3)}</span>
        </div>
      )}

      {bounds && inspected.polygons.length > 0 && (
        <div className={`mt-3 overflow-hidden border border-line bg-paper ${compact ? 'h-28' : 'h-40'}`}>
          <svg viewBox="0 0 320 180" className="h-full w-full" role="img" aria-label="نمایش هندسه مرز">
            <rect width="320" height="180" fill="#F6F9F7" />
            {inspected.polygons.flatMap((polygon, polygonIndex) => polygon.map((ring, ringIndex) => (
              <polyline key={`${polygonIndex}-${ringIndex}`} points={project(ring, bounds)} fill={ringIndex === 0 ? '#3C9C6A' : '#F6F9F7'} fillOpacity={ringIndex === 0 ? 0.28 : 1} stroke="#1D5940" strokeWidth={ringIndex === 0 ? 2 : 1} strokeLinejoin="round" />
            )))}
          </svg>
        </div>
      )}

      {inspected.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-r-2 border-warn pr-2 text-[8px] font-bold leading-4 text-warn-700" role="status">
          {inspected.warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
          {inspected.warnings.length > 4 && <li>و {numberFa(inspected.warnings.length - 4)} هشدار دیگر…</li>}
        </ul>
      )}
    </section>
  );
}
