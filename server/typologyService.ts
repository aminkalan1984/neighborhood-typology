import crypto from 'node:crypto';
import type { Geometry, Position } from 'geojson';
import { aggregateTypology, verificationGates } from './typologyScoring';
import { computeDualLayerTypology } from './typologyDualLayer';
import { buildIndicatorTasks, loadRegistry, normalizePersianText, resolveCandidates, startedTaskStatus } from './typologyRegistry';
import type {
  AuditEvent,
  Candidate,
  BoundaryRecord,
  BoundarySource,
  IndicatorStatus,
  MeasurementRecord,
  RunPurpose,
  RunStatus,
  SettlementType,
  TypologyRequest,
  TypologyRun,
  TypologyStore,
  LocationSearchResult,
} from './typologyTypes';

export class TypologyError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const BOUNDARY_CONFIDENCE: Record<BoundarySource, number> = {
  municipal: 0.98,
  census_block: 0.96,
  planning: 0.94,
  participatory: 0.91,
  user_supplied: 0.85,
  osm_temporary: 0.65,
};

const PURPOSES = new Set<RunPurpose>(['baseline', 'monitoring', 'intervention_priority']);
const SETTLEMENT_TYPES = new Set<SettlementType>(['urban', 'rural']);
const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMON_MOJIBAKE_PATTERN = /(?:[ÃÂØÙ][\u0080-\u00BF]|â(?:€|„|™|†|‡|—|–)|ï¿½)/u;

/** Canonical server-side boundary validation limits and result metadata. */
const MAX_BOUNDARY_POSITIONS = 100_000;
const MAX_BOUNDARY_POLYGONS = 1_000;
const MIN_RING_AREA = 1e-12;
const GEOMETRY_EPSILON = 1e-12;

type BoundaryInput = Geometry | { type: string; [key: string]: unknown };

interface BoundaryValidation {
  geometry: Geometry;
  warnings: string[];
  area_km2: number;
  polygon_count: number;
  position_count: number;
}

const RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ['LOCATION_AMBIGUOUS', 'REJECTED'],
  LOCATION_AMBIGUOUS: ['BOUNDARY_CONFIRMED', 'REJECTED'],
  BOUNDARY_CONFIRMED: ['COLLECTING', 'REJECTED'],
  COLLECTING: ['WAITING_FOR_RESTRICTED_DATA', 'COMPUTING', 'REJECTED'],
  WAITING_FOR_RESTRICTED_DATA: ['COLLECTING', 'COMPUTING', 'REJECTED'],
  COMPUTING: ['QA_REVIEW', 'WAITING_FOR_RESTRICTED_DATA', 'REJECTED'],
  QA_REVIEW: ['PROVISIONAL', 'VERIFIED', 'COMPUTING', 'REJECTED'],
  PROVISIONAL: ['COLLECTING', 'COMPUTING', 'QA_REVIEW', 'VERIFIED', 'REJECTED'],
  VERIFIED: ['COLLECTING', 'COMPUTING', 'QA_REVIEW', 'REJECTED'],
  REJECTED: [],
};

function now(): string {
  return new Date().toISOString();
}

function requireText(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypologyError(400, 'VALIDATION_ERROR', `${field} is required`);
  const normalized = value.trim();
  if (normalized.length > max) throw new TypologyError(400, 'VALIDATION_ERROR', `${field} exceeds ${max} characters`);
  return normalized;
}

export function safeStoredPlaceText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (!normalized || COMMON_MOJIBAKE_PATTERN.test(normalized) || !/[\p{L}\p{N}]/u.test(normalized)) return fallback;
  return normalized;
}

function requirePlaceText(value: unknown, field: string): string {
  const normalized = requireText(value, field);
  if (safeStoredPlaceText(normalized) !== normalized) {
    throw new TypologyError(400, 'INVALID_PLACE_NAME', `${field} must contain a readable place name`);
  }
  return normalized;
}

function candidateFromSelectedLocation(location: LocationSearchResult, request: TypologyRequest): Candidate {
  const center = location.center && Number.isFinite(location.center.lat) && Number.isFinite(location.center.lng)
    ? { lat: location.center.lat, lon: location.center.lng }
    : null;
  const id = requireText(location.candidate_id || `selected:${normalizePersianText(location.canonical_name)}`, 'selected_location.candidate_id');
  const name = requirePlaceText(location.canonical_name || request.neighborhood_name, 'selected_location.canonical_name');
  return {
    id,
    candidate_id: id,
    name,
    canonical_name: name,
    province: safeStoredPlaceText(location.province, request.province ?? ''),
    city_or_county: safeStoredPlaceText(location.city_or_county, request.city_or_county ?? ''),
    settlement_type: location.settlement_type === 'rural' ? 'rural' : 'urban',
    hierarchy: { province_code: location.province_id, county_code: location.administrative_id },
    center,
    confidence: Math.max(0, Math.min(1, Number(location.confidence) || 0)),
    requires_confirmation: true,
    boundary_available: Boolean(location.boundary_geojson),
    boundary_geojson: location.boundary_geojson ?? null,
    sources: [{ type: String(location.source || 'PBF_PLACES_LOCAL'), id }],
    source: String(location.source || 'PBF_PLACES_LOCAL'),
    notes: ['Location selected from the local Iranian places catalog; boundary must still be confirmed.'],
  };
}

function optionalText(value: unknown, field: string, max = 500): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireText(value, field, max);
}

function optionalIdempotencyKey(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const key = requireText(value, 'idempotency_key', 200);
  if (!/^[\x20-\x7e]+$/.test(key)) {
    throw new TypologyError(400, 'VALIDATION_ERROR', 'idempotency_key must contain printable ASCII characters only');
  }
  return key;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

function payloadFingerprint(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function validateRunId(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new TypologyError(400, 'INVALID_RUN_ID', 'runId must be a valid UUID');
  }
  return runId;
}

function finiteNumber(value: unknown, field: string, options: { min?: number; max?: number; nullable?: boolean } = {}): number | null {
  if (value === null && options.nullable) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypologyError(400, 'VALIDATION_ERROR', `${field} must be a finite number`);
  if (options.min !== undefined && value < options.min) throw new TypologyError(400, 'VALIDATION_ERROR', `${field} must be at least ${options.min}`);
  if (options.max !== undefined && value > options.max) throw new TypologyError(400, 'VALIDATION_ERROR', `${field} must be at most ${options.max}`);
  return value;
}

function parseRequest(body: unknown): TypologyRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypologyError(400, 'VALIDATION_ERROR', 'JSON request body is required');
  const input = body as Record<string, unknown>;
  const settlementType = input.settlement_type;
  if (typeof settlementType !== 'string' || !SETTLEMENT_TYPES.has(settlementType as SettlementType)) {
    throw new TypologyError(400, 'VALIDATION_ERROR', 'settlement_type must be urban or rural');
  }
  const purpose = input.purpose ?? 'baseline';
  if (typeof purpose !== 'string' || !PURPOSES.has(purpose as RunPurpose)) {
    throw new TypologyError(400, 'VALIDATION_ERROR', 'purpose must be baseline, monitoring, or intervention_priority');
  }
  const referenceYear = finiteNumber(input.reference_year, 'reference_year', { min: 1300, max: 2200 }) as number;

  const selectedLocation = input.selected_location && typeof input.selected_location === 'object' && !Array.isArray(input.selected_location)
    ? input.selected_location as TypologyRequest['selected_location']
    : null;
  const officialContextInput = input.official_context && typeof input.official_context === 'object' && !Array.isArray(input.official_context)
    ? input.official_context as Record<string, unknown>
    : undefined;
  const designationSourcesInput = officialContextInput?.designationSources && typeof officialContextInput.designationSources === 'object' && !Array.isArray(officialContextInput.designationSources)
    ? officialContextInput.designationSources as Record<string, unknown>
    : undefined;
  const officialContext = officialContextInput ? {
    hazardDesignation: officialContextInput.hazardDesignation === true,
    historicDesignation: officialContextInput.historicDesignation === true,
    informalDesignation: officialContextInput.informalDesignation === true,
    physicalInefficiencyDesignation: officialContextInput.physicalInefficiencyDesignation === true,
    designationSources: designationSourcesInput ? {
      hazard: Array.isArray(designationSourcesInput.hazard) ? designationSourcesInput.hazard.map(String).slice(0, 20) : undefined,
      historic: Array.isArray(designationSourcesInput.historic) ? designationSourcesInput.historic.map(String).slice(0, 20) : undefined,
      informal: Array.isArray(designationSourcesInput.informal) ? designationSourcesInput.informal.map(String).slice(0, 20) : undefined,
      physical: Array.isArray(designationSourcesInput.physical) ? designationSourcesInput.physical.map(String).slice(0, 20) : undefined,
    } : undefined,
  } : undefined;
  return {
    neighborhood_name: requirePlaceText(input.neighborhood_name, 'neighborhood_name'),
    city_or_county: input.city_or_county == null || input.city_or_county === '' ? '' : requirePlaceText(input.city_or_county, 'city_or_county'),
    province: input.province == null || input.province === '' ? '' : requirePlaceText(input.province, 'province'),
    settlement_type: settlementType as SettlementType,
    reference_year: Math.trunc(referenceYear),
    optional_boundary_geojson: input.optional_boundary_geojson == null ? null : validateBoundary(input.optional_boundary_geojson).geometry,
    purpose: purpose as RunPurpose,
    selected_location: selectedLocation,
    official_context: officialContext,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function assertWgs84Crs(value: unknown): string | undefined {
  if (value == null) return undefined;
  const record = asRecord(value);
  const candidate = typeof value === 'string'
    ? value
    : record
      ? String(asRecord(record.properties)?.name ?? record.name ?? record.href ?? '')
      : '';
  const normalized = candidate.trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (!['EPSG:4326', 'CRS84', 'URN:OGC:DEF:CRS:OGC:1.3:CRS84', 'HTTP://WWW.OPENGIS.NET/GML/SRS/NAME/CRS:84'].includes(normalized)) {
    throw new TypologyError(400, 'INVALID_BOUNDARY_CRS', 'Boundary coordinates must use WGS84 (EPSG:4326/CRS84)');
  }
  return 'EPSG:4326';
}

function samePosition(a: Position, b: Position): boolean {
  return Math.abs(a[0] - b[0]) <= GEOMETRY_EPSILON && Math.abs(a[1] - b[1]) <= GEOMETRY_EPSILON;
}

function polygonCoordinates(geometry: Geometry): Position[][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new TypologyError(400, 'INVALID_BOUNDARY', 'Boundary must be a Polygon or MultiPolygon');
}

function normalizeBoundaryEnvelope(input: unknown): Geometry {
  const root = asRecord(input);
  if (!root) throw new TypologyError(400, 'INVALID_BOUNDARY', 'boundary_geojson must be a GeoJSON object');
  assertWgs84Crs(root.crs);
  const type = root.type;
  if (type === 'Feature') {
    if (!Object.prototype.hasOwnProperty.call(root, 'geometry')) throw new TypologyError(400, 'INVALID_BOUNDARY', 'Feature geometry is required');
    return normalizeBoundaryEnvelope(root.geometry);
  }
  if (type === 'FeatureCollection') {
    if (!Array.isArray(root.features) || root.features.length === 0) throw new TypologyError(400, 'INVALID_BOUNDARY', 'FeatureCollection must contain at least one Feature');
    const polygons: Position[][][] = [];
    for (const [index, feature] of root.features.entries()) {
      const featureRecord = asRecord(feature);
      if (!featureRecord || featureRecord.type !== 'Feature') throw new TypologyError(400, 'INVALID_BOUNDARY', `FeatureCollection item ${index} is not a Feature`);
      const geometry = normalizeBoundaryEnvelope(featureRecord.geometry);
      polygons.push(...polygonCoordinates(geometry));
    }
    return polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
  }
  if (type !== 'Polygon' && type !== 'MultiPolygon') throw new TypologyError(400, 'INVALID_BOUNDARY', 'Boundary must be a Polygon or MultiPolygon GeoJSON geometry');
  const coordinates = root.coordinates;
  if (!Array.isArray(coordinates)) throw new TypologyError(400, 'INVALID_BOUNDARY', 'Boundary coordinates are required');
  return type === 'Polygon'
    ? { type: 'Polygon', coordinates: coordinates as Position[][] }
    : { type: 'MultiPolygon', coordinates: coordinates as Position[][][] };
}

function orientation(a: Position, b: Position, c: Position): number {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(value) <= GEOMETRY_EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a: Position, b: Position, p: Position): boolean {
  return p[0] >= Math.min(a[0], b[0]) - GEOMETRY_EPSILON && p[0] <= Math.max(a[0], b[0]) + GEOMETRY_EPSILON
    && p[1] >= Math.min(a[1], b[1]) - GEOMETRY_EPSILON && p[1] <= Math.max(a[1], b[1]) + GEOMETRY_EPSILON;
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC !== abD && cdA !== cdB) return true;
  return (abC === 0 && onSegment(a, b, c)) || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a)) || (cdB === 0 && onSegment(c, d, b));
}

function ringArea(ring: Position[]): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) area += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  return area / 2;
}

function ringContainsPoint(ring: Position[], point: Position): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const prior = ring[previous];
    const crosses = (current[1] > point[1]) !== (prior[1] > point[1]);
    if (crosses && point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0]) inside = !inside;
  }
  return inside;
}

function validateRing(raw: unknown, label: string, positionCounter: { value: number }): Position[] {
  if (!Array.isArray(raw) || raw.length < 4) throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} has fewer than four positions`);
  const ring: Position[] = [];
  for (const [index, rawPosition] of raw.entries()) {
    if (!Array.isArray(rawPosition) || rawPosition.length < 2 || rawPosition.slice(0, 2).some((coordinate) => typeof coordinate !== 'number' || !Number.isFinite(coordinate))) {
      throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} position ${index} contains invalid coordinates`);
    }
    const [lon, lat] = rawPosition as [number, number];
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} position ${index} is outside WGS84 bounds`);
    ring.push([...rawPosition] as Position);
    positionCounter.value += 1;
    if (positionCounter.value > MAX_BOUNDARY_POSITIONS) throw new TypologyError(413, 'INVALID_BOUNDARY', 'Boundary contains too many positions');
  }
  if (!samePosition(ring[0], ring[ring.length - 1])) throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} is not closed`);
  if (Math.abs(ringArea(ring)) <= MIN_RING_AREA) throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} has zero area`);
  for (let first = 0; first < ring.length - 1; first += 1) {
    if (samePosition(ring[first], ring[first + 1])) throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} contains a zero-length edge`);
    for (let second = first + 1; second < ring.length - 1; second += 1) {
      if (second === first + 1 || (first === 0 && second === ring.length - 2)) continue;
      if (segmentsIntersect(ring[first], ring[first + 1], ring[second], ring[second + 1])) throw new TypologyError(400, 'INVALID_BOUNDARY', `${label} self-intersects`);
    }
  }
  return ring;
}

function areaKm2(polygons: Position[][][]): number {
  const radiusKm = 6371.0088;
  let area = 0;
  for (const polygon of polygons) {
    const shell = Math.abs(ringArea(polygon[0]));
    const holes = polygon.slice(1).reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0);
    const meanLat = polygon[0].reduce((sum, position) => sum + position[1], 0) / polygon[0].length;
    const degreeKm = Math.PI * radiusKm / 180;
    area += Math.max(0, shell - holes) * degreeKm * degreeKm * Math.max(0.01, Math.cos(meanLat * Math.PI / 180));
  }
  return area;
}

export function validateBoundary(input: unknown): BoundaryValidation {
  const normalized = normalizeBoundaryEnvelope(input);
  const rawPolygons = polygonCoordinates(normalized);
  if (rawPolygons.length === 0 || rawPolygons.length > MAX_BOUNDARY_POLYGONS) throw new TypologyError(400, 'INVALID_BOUNDARY', 'Boundary must contain between one and 1,000 polygons');
  const counter = { value: 0 };
  const polygons: Position[][][] = rawPolygons.map((polygon, polygonIndex) => {
    if (!Array.isArray(polygon) || polygon.length === 0) throw new TypologyError(400, 'INVALID_BOUNDARY', `Polygon ${polygonIndex} contains no rings`);
    const rings = polygon.map((ring, ringIndex) => validateRing(ring, `Polygon ${polygonIndex + 1} ring ${ringIndex + 1}`, counter));
    const shell = rings[0];
    for (const [holeIndex, hole] of rings.slice(1).entries()) {
      if (!ringContainsPoint(shell, hole[0])) throw new TypologyError(400, 'INVALID_BOUNDARY', `Polygon ${polygonIndex + 1} hole ${holeIndex + 1} lies outside the exterior ring`);
      for (let first = 0; first < shell.length - 1; first += 1) for (let second = 0; second < hole.length - 1; second += 1) {
        if (segmentsIntersect(shell[first], shell[first + 1], hole[second], hole[second + 1])) throw new TypologyError(400, 'INVALID_BOUNDARY', `Polygon ${polygonIndex + 1} hole ${holeIndex + 1} intersects its exterior ring`);
      }
    }
    for (let first = 1; first < rings.length; first += 1) for (let second = first + 1; second < rings.length; second += 1) {
      for (let edgeA = 0; edgeA < rings[first].length - 1; edgeA += 1) for (let edgeB = 0; edgeB < rings[second].length - 1; edgeB += 1) {
        if (segmentsIntersect(rings[first][edgeA], rings[first][edgeA + 1], rings[second][edgeB], rings[second][edgeB + 1])) throw new TypologyError(400, 'INVALID_BOUNDARY', `Polygon ${polygonIndex + 1} holes intersect`);
      }
      if (ringContainsPoint(rings[first], rings[second][0]) || ringContainsPoint(rings[second], rings[first][0])) throw new TypologyError(400, 'INVALID_BOUNDARY', `Polygon ${polygonIndex + 1} holes overlap`);
    }
    return rings;
  });
  for (let first = 0; first < polygons.length; first += 1) for (let second = first + 1; second < polygons.length; second += 1) {
    const shellA = polygons[first][0];
    const shellB = polygons[second][0];
    for (let edgeA = 0; edgeA < shellA.length - 1; edgeA += 1) for (let edgeB = 0; edgeB < shellB.length - 1; edgeB += 1) {
      if (segmentsIntersect(shellA[edgeA], shellA[edgeA + 1], shellB[edgeB], shellB[edgeB + 1])) throw new TypologyError(400, 'INVALID_BOUNDARY', 'MultiPolygon exterior rings overlap');
    }
    if (ringContainsPoint(shellA, shellB[0]) || ringContainsPoint(shellB, shellA[0])) throw new TypologyError(400, 'INVALID_BOUNDARY', 'MultiPolygon polygons overlap');
  }
  const geometry: Geometry = normalized.type === 'Polygon' ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
  const area_km2 = areaKm2(polygons);
  if (!(area_km2 > 0) || !Number.isFinite(area_km2)) throw new TypologyError(400, 'INVALID_BOUNDARY', 'Boundary area must be greater than zero');
  return { geometry, warnings: ['Administrative overlap and authoritative boundary ownership still require GIS review.'], area_km2, polygon_count: polygons.length, position_count: counter.value };
}

function audit(action: string, actor = 'system', details?: Record<string, unknown>, transition?: { from: RunStatus; to: RunStatus }): AuditEvent {
  return {
    id: crypto.randomUUID(),
    at: now(),
    actor,
    action,
    ...(transition ? { from_status: transition.from, to_status: transition.to } : {}),
    ...(details ? { details } : {}),
  };
}

function transition(run: TypologyRun, next: RunStatus, action: string, actor = 'system', details?: Record<string, unknown>): void {
  const from = run.status;
  if (!RUN_TRANSITIONS[from].includes(next)) {
    throw new TypologyError(409, 'INVALID_STATE_TRANSITION', `${action} cannot transition ${from} to ${next}`, {
      allowed: RUN_TRANSITIONS[from],
    });
  }
  run.status = next;
  run.updated_at = now();
  run.audit.push(audit(action, actor, details, { from, to: next }));
}

function ensureStatus(run: TypologyRun, allowed: RunStatus[], action: string): void {
  if (!allowed.includes(run.status)) {
    throw new TypologyError(409, 'INVALID_STATE_TRANSITION', `${action} is not allowed while run is ${run.status}`, { allowed });
  }
}

function taskMissing(run: TypologyRun): TypologyRun['missing'] {
  return run.tasks
    .filter((task) => !['COMPUTED', 'APPROVED'].includes(task.status))
    .map((task) => ({
      indicator_code: task.code,
      status: task.status,
      reason: task.missing_reason ?? 'measurement_not_available',
      next_action: task.next_action,
    }));
}

function localizedMissingAction(reason: string, current: string): string {
  const actions: Record<string, string> = {
    survey_data_not_received: 'بسته پیمایش ناشناس سازی شده و مورد تایید را گردآوری و بارگذاری کنید.',
    field_audit_not_received: 'ممیزی میدانی مکان مند مصوب را تکمیل و مستندات آن را بارگذاری کنید.',
    organizational_data_not_received: 'داده تجمیعی سازمانی را همراه منشا، نسخه، مجوز و checksum بارگذاری کنید.',
    approved_connector_not_executed: 'اتصال دهنده مورد تایید رجیستر را اجرا کنید و برآورد مدلی را جایگزین داده نکنید.',
    approved_source_not_configured: 'منبع و playbook مصوب تامین داده را تعیین و به مسئول آن واگذار کنید.',
    failed_qa: 'منبع یا روش را اصلاح و نسخه جدید شواهد را بارگذاری کنید.',
    standardized_score_not_computed: 'فرمول قطعی نسخه دار و استانداردسازی مصوب را اجرا کنید.',
  };
  return actions[reason] ?? current;
}

function suggestedDataOwner(accessMode = ''): string {
  if (accessMode.includes('سازمانی')) return 'دستگاه متولی داده';
  if (accessMode.includes('میدانی')) return 'تیم پیمایش و ممیزی میدانی';
  if (accessMode.includes('برخط')) return 'مدیر اتصال دهنده داده';
  return 'راهبری داده محله';
}

function publicationLevel(run: TypologyRun): TypologyRun['publication_level'] {
  if (run.status === 'REJECTED') return 'REJECTED';
  if (run.status === 'VERIFIED') return 'VERIFIED';
  if ((run.boundary?.confidence ?? 0) < 0.9 || !run.score) return 'EXPLORATORY';
  return 'PROVISIONAL';
}

function requireRun(run: TypologyRun | null): TypologyRun {
  if (!run) throw new TypologyError(404, 'RUN_NOT_FOUND', 'Typology run was not found');
  return run;
}

function parseEvidenceRecord(run: TypologyRun, body: unknown): MeasurementRecord {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypologyError(400, 'VALIDATION_ERROR', 'Evidence record must be an object');
  const input = body as Record<string, unknown>;
  const code = requireText(input.indicator_code ?? input.code, 'indicator_code', 20).toUpperCase();
  const task = run.tasks.find((candidate) => candidate.code === code);
  if (!task) throw new TypologyError(400, 'UNKNOWN_INDICATOR', `Indicator ${code} is not in registry ${run.registry_version}`);

  const status = String(input.status ?? 'measured');
  if (!['measured', 'validated', 'missing', 'suppressed', 'not_recorded'].includes(status)) {
    throw new TypologyError(400, 'VALIDATION_ERROR', 'Evidence status is invalid');
  }

  const isMissing = ['missing', 'suppressed', 'not_recorded'].includes(status);
  const rawValue = input.raw_value === undefined ? null : input.raw_value;
  if (!isMissing && rawValue === null) throw new TypologyError(400, 'VALIDATION_ERROR', 'raw_value is required for measured evidence');
  if (rawValue !== null && typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    throw new TypologyError(400, 'VALIDATION_ERROR', 'raw_value must be a number, string, or null');
  }
  if (typeof rawValue === 'number' && !Number.isFinite(rawValue)) throw new TypologyError(400, 'VALIDATION_ERROR', 'raw_value must be finite');

  const score = input.score_1_5 === undefined || input.score_1_5 === null
    ? null
    : finiteNumber(input.score_1_5, 'score_1_5', { min: 1, max: 5 });
  if (isMissing && score !== null) throw new TypologyError(400, 'MISSING_VALUE_HAS_SCORE', 'Missing evidence cannot have a score');

  const sourceInput = (input.source && typeof input.source === 'object' && !Array.isArray(input.source))
    ? input.source as Record<string, unknown>
    : {};
  const source = {
    organization: optionalText(sourceInput.organization, 'source.organization'),
    url: optionalText(sourceInput.url, 'source.url', 2_000),
    device: optionalText(sourceInput.device, 'source.device'),
    dataset_id: optionalText(sourceInput.dataset_id, 'source.dataset_id'),
    version: optionalText(sourceInput.version, 'source.version'),
    retrieved_at: optionalText(sourceInput.retrieved_at, 'source.retrieved_at'),
    license: optionalText(sourceInput.license, 'source.license'),
    checksum: optionalText(sourceInput.checksum, 'source.checksum'),
    coverage: sourceInput.coverage === undefined ? undefined : finiteNumber(sourceInput.coverage, 'source.coverage', { min: 0, max: 1 }) as number,
    source_tier: sourceInput.source_tier as typeof source.source_tier,
    geography_level: sourceInput.geography_level == null ? undefined : String(sourceInput.geography_level),
    data_vintage: sourceInput.data_vintage == null ? undefined : String(sourceInput.data_vintage),
  };
  if (!isMissing) {
    if (!source.url && !source.device) throw new TypologyError(400, 'MISSING_PROVENANCE', 'A source URL or device identifier is required');
    if (!source.dataset_id || !source.version || !source.retrieved_at || !source.license || !source.checksum) {
      throw new TypologyError(400, 'MISSING_PROVENANCE', 'dataset_id, version, retrieved_at, license, and checksum are required');
    }
  }

  const methodInput = (input.method && typeof input.method === 'object' && !Array.isArray(input.method))
    ? input.method as Record<string, unknown>
    : {};
  const formulaVersion = optionalText(methodInput.formula_version, 'method.formula_version') ?? task.formula_version;
  if (score !== null && formulaVersion !== task.formula_version) {
    throw new TypologyError(409, 'FORMULA_VERSION_MISMATCH', `Expected ${task.formula_version}; received ${formulaVersion}`);
  }

  const qualityInput = (input.quality && typeof input.quality === 'object' && !Array.isArray(input.quality))
    ? input.quality as Record<string, unknown>
    : {};
  const flags = Array.isArray(qualityInput.flags)
    ? qualityInput.flags.filter((flag): flag is string => typeof flag === 'string').slice(0, 100)
    : [];
  const quality = {
    spatial_coverage: qualityInput.spatial_coverage === undefined ? undefined : finiteNumber(qualityInput.spatial_coverage, 'quality.spatial_coverage', { min: 0, max: 1 }) as number,
    temporal_coverage: qualityInput.temporal_coverage === undefined ? undefined : finiteNumber(qualityInput.temporal_coverage, 'quality.temporal_coverage', { min: 0, max: 1 }) as number,
    score: qualityInput.score === undefined ? undefined : finiteNumber(qualityInput.score, 'quality.score', { min: 0, max: 1 }) as number,
    source_reliability: qualityInput.source_reliability === undefined ? undefined : finiteNumber(qualityInput.source_reliability, 'quality.source_reliability', { min: 0, max: 1 }) as number,
    method_validity: qualityInput.method_validity === undefined ? undefined : finiteNumber(qualityInput.method_validity, 'quality.method_validity', { min: 0, max: 1 }) as number,
    validation_score: qualityInput.validation_score === undefined ? undefined : finiteNumber(qualityInput.validation_score, 'quality.validation_score', { min: 0, max: 1 }) as number,
    flags,
  };
  if (!isMissing && quality.score === undefined) throw new TypologyError(400, 'MISSING_QUALITY', 'quality.score is required for measured evidence');

  return {
    id: crypto.randomUUID(),
    indicator_code: code,
    neighborhood_id: run.selected_candidate_id ?? run.run_id,
    raw_value: rawValue as number | string | null,
    cleaned_value: (input.cleaned_value ?? rawValue) as number | string | null,
    unit: optionalText(input.unit, 'unit'),
    numerator: input.numerator === undefined || input.numerator === null ? null : finiteNumber(input.numerator, 'numerator') as number,
    denominator: input.denominator === undefined || input.denominator === null ? null : finiteNumber(input.denominator, 'denominator') as number,
    reference_date: optionalText(input.reference_date, 'reference_date'),
    geography: optionalText(input.geography, 'geography'),
    source,
    method: {
      formula_version: formulaVersion,
      code_commit: optionalText(methodInput.code_commit, 'method.code_commit'),
    },
    quality,
    score_1_5: score,
    score_absolute_0_1: input.score_absolute_0_1 === undefined || input.score_absolute_0_1 === null ? null : finiteNumber(input.score_absolute_0_1, 'score_absolute_0_1', { min: 0, max: 1 }) as number,
    score_relative_0_1: input.score_relative_0_1 === undefined || input.score_relative_0_1 === null ? null : finiteNumber(input.score_relative_0_1, 'score_relative_0_1', { min: 0, max: 1 }) as number,
    reference_cohort_id: optionalText(input.reference_cohort_id, 'reference_cohort_id'),
    boundary_version: optionalText(input.boundary_version, 'boundary_version'),
    uncertainty: input.uncertainty && typeof input.uncertainty === 'object' && !Array.isArray(input.uncertainty)
      ? input.uncertainty as Record<string, unknown>
      : null,
    status: status as MeasurementRecord['status'],
    missing_reason: isMissing ? requireText(input.missing_reason, 'missing_reason', 500) : undefined,
    next_action: optionalText(input.next_action, 'next_action', 500),
    created_at: now(),
  };
}

export class TypologyService {
  private readonly registry: ReturnType<typeof loadRegistry>;

  constructor(
    private readonly store: TypologyStore,
    options: { registryPath?: string; codeVersion?: string } = {},
  ) {
    this.registry = loadRegistry(options.registryPath);
    this.codeVersion = options.codeVersion ?? process.env.GIT_COMMIT ?? 'working-tree';
  }

  private readonly codeVersion: string;

  getRegistryMetadata(): Record<string, unknown> {
    return {
      version: this.registry.version,
      indicators: this.registry.rows.length,
      domains: {
        physical: this.registry.rows.filter((row) => row.domain === 'physical').length,
        behavioral: this.registry.rows.filter((row) => row.domain === 'behavioral').length,
        normative: this.registry.rows.filter((row) => row.domain === 'normative').length,
      },
    };
  }

  async createRun(body: unknown, actor = 'api-user'): Promise<TypologyRun> {
    const request = parseRequest(body);
    const timestamp = now();
    const run: TypologyRun = {
      run_id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      registry_version: this.registry.version,
      code_version: this.codeVersion,
      status: 'CREATED',
      publication_level: 'EXPLORATORY',
      request,
      candidates: request.selected_location ? [candidateFromSelectedLocation(request.selected_location, request)] : resolveCandidates(request),
      tasks: buildIndicatorTasks(this.registry.rows),
      measurements: [],
      missing: [],
      audit: [audit('RUN_CREATED', actor, { registry_version: this.registry.version })],
    };
    transition(run, 'LOCATION_AMBIGUOUS', 'LOCATION_RESOLUTION_CREATED', 'system', { candidates: run.candidates.length });
    run.missing = taskMissing(run);
    await this.store.create(run);
    return run;
  }

  async getRun(runId: string): Promise<TypologyRun> {
    return requireRun(await this.store.get(validateRunId(runId)));
  }

  async listRuns(limit = 20): Promise<TypologyRun[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return (await this.store.list()).slice(0, safeLimit);
  }

  async getCandidates(runId: string): Promise<{ run_id: string; status: RunStatus; candidates: TypologyRun['candidates'] }> {
    const run = await this.getRun(runId);
    const fallbackName = safeStoredPlaceText(run.request.neighborhood_name, 'محله ثبت شده بدون نام معتبر');
    return {
      run_id: run.run_id,
      status: run.status,
      candidates: run.candidates.map((candidate) => ({
        ...candidate,
        name: safeStoredPlaceText(candidate.name, fallbackName),
        canonical_name: safeStoredPlaceText(candidate.canonical_name, fallbackName),
        province: safeStoredPlaceText(candidate.province),
        city_or_county: safeStoredPlaceText(candidate.city_or_county),
      })),
    };
  }

  async confirmBoundary(runId: string, body: unknown, actor = 'api-user'): Promise<TypologyRun> {
    const run = await this.getRun(runId);
    ensureStatus(run, ['LOCATION_AMBIGUOUS'], 'boundary confirmation');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypologyError(400, 'VALIDATION_ERROR', 'JSON request body is required');
    const input = body as Record<string, unknown>;
    const candidateId = requireText(input.candidate_id, 'candidate_id');
    if (!run.candidates.some((candidate) => candidate.id === candidateId)) throw new TypologyError(400, 'UNKNOWN_CANDIDATE', 'candidate_id is not one of this run candidates');
    const source = requireText(input.source, 'source') as BoundarySource;
    if (!(source in BOUNDARY_CONFIDENCE)) throw new TypologyError(400, 'VALIDATION_ERROR', 'Unsupported boundary source');
    const checked = validateBoundary(input.boundary_geojson ?? run.request.optional_boundary_geojson);
    const areaChange = input.area_change_percent === undefined
      ? undefined
      : finiteNumber(input.area_change_percent, 'area_change_percent', { min: 0 }) as number;

    const boundary: BoundaryRecord = {
      geojson: checked.geometry,
      source,
      source_id: optionalText(input.source_id, 'source_id'),
      version: requireText(input.version, 'version'),
      crs: optionalText(input.crs, 'crs') ?? 'EPSG:4326',
      approved_at: optionalText(input.approved_at, 'approved_at'),
      confidence: BOUNDARY_CONFIDENCE[source],
      area_change_percent: areaChange,
      validation: {
        structurally_valid: true,
        warnings: [...checked.warnings, ...(areaChange !== undefined && areaChange > 5 ? ['Area differs by more than 5%; expert review is required.'] : [])],
        topology_valid: true,
        polygon_count: checked.polygon_count,
        position_count: checked.position_count,
      },
      area_km2: checked.area_km2,
    };
    run.selected_candidate_id = candidateId;
    run.boundary = boundary;
    run.reference_cohort_id = `pending:${normalizePersianText(run.request.settlement_type)}:${normalizePersianText(run.request.province)}`;
    transition(run, 'BOUNDARY_CONFIRMED', 'BOUNDARY_CONFIRMED', actor, { source, confidence: boundary.confidence });
    run.publication_level = publicationLevel(run);
    await this.store.update(run);
    return run;
  }

  async startRun(runId: string, actor = 'api-user'): Promise<TypologyRun> {
    const run = await this.getRun(runId);
    ensureStatus(run, ['BOUNDARY_CONFIRMED'], 'start');
    transition(run, 'COLLECTING', 'COLLECTION_STARTED', actor);
    run.tasks = run.tasks.map((task) => ({ ...task, ...startedTaskStatus(task) }));
    run.missing = taskMissing(run);
    transition(run, 'WAITING_FOR_RESTRICTED_DATA', 'WAITING_FOR_REQUIRED_INPUTS', 'system', {
      missing_indicators: run.missing.length,
    });
    run.publication_level = publicationLevel(run);
    await this.store.update(run);
    return run;
  }

  async addEvidence(runId: string, body: unknown, actor = 'api-user'): Promise<{ run: TypologyRun; accepted: MeasurementRecord[] }> {
    const run = await this.getRun(runId);
    ensureStatus(run, ['COLLECTING', 'WAITING_FOR_RESTRICTED_DATA', 'QA_REVIEW', 'PROVISIONAL'], 'evidence upload');
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const recordsInput = Array.isArray(input.records) ? input.records : [body];
    if (recordsInput.length === 0 || recordsInput.length > 419) throw new TypologyError(400, 'VALIDATION_ERROR', 'Provide between 1 and 419 evidence records');
    const idempotencyKey = optionalIdempotencyKey(input.idempotency_key);
    const fingerprint = idempotencyKey ? payloadFingerprint(recordsInput) : undefined;
    const previousReceipt = idempotencyKey ? run.evidence_idempotency?.[idempotencyKey] : undefined;
    if (previousReceipt) {
      if (previousReceipt.fingerprint !== fingerprint) {
        throw new TypologyError(409, 'IDEMPOTENCY_CONFLICT', 'This idempotency key was already used for a different evidence batch');
      }
      const replayed = previousReceipt.record_ids
        .map((id) => run.measurements.find((measurement) => measurement.id === id))
        .filter((measurement): measurement is MeasurementRecord => Boolean(measurement));
      return { run, accepted: replayed };
    }
    const accepted = recordsInput.map((record) => parseEvidenceRecord(run, record));

    for (const record of accepted) {
      const previous = run.measurements
        .filter((measurement) => measurement.indicator_code === record.indicator_code && !measurement.superseded_by)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (previous) previous.superseded_by = record.id;
      run.measurements.push(record);

      const task = run.tasks.find((candidate) => candidate.code === record.indicator_code)!;
      task.measurement_ids.push(record.id);
      if (['missing', 'suppressed', 'not_recorded'].includes(record.status)) {
        task.status = 'NOT_AVAILABLE';
        task.missing_reason = record.missing_reason ?? record.status;
        task.next_action = record.next_action ?? 'Obtain an approved replacement source without imputing a numeric value.';
      } else if (record.quality.flags.includes('FAILED_QA')) {
        task.status = 'FAILED_QA';
        task.missing_reason = 'failed_qa';
        task.next_action = 'منبع یا روش را اصلاح و نسخه جدید شواهد را بارگذاری کنید.';
      } else if (record.score_1_5 === null) {
        task.status = 'COMPUTABLE';
        task.missing_reason = 'standardized_score_not_computed';
        task.next_action = `فرمول قطعی ${task.formula_version} و استانداردسازی مصوب را اجرا کنید.`;
      } else {
        task.status = 'COMPUTED';
        delete task.missing_reason;
        task.next_action = 'این اندازه گیری نسخه دار را در محاسبه مجدد و کنترل کیفیت وارد کنید.';
      }
    }
    run.score = undefined;
    run.missing = taskMissing(run);
    run.updated_at = now();
    run.audit.push(audit('EVIDENCE_ADDED', actor, { record_ids: accepted.map((record) => record.id) }));
    if (idempotencyKey && fingerprint) {
      run.evidence_idempotency = {
        ...run.evidence_idempotency,
        [idempotencyKey]: {
          fingerprint,
          record_ids: accepted.map((record) => record.id),
          accepted_at: run.updated_at,
        },
      };
    }
    run.publication_level = publicationLevel(run);
    await this.store.update(run);
    return { run, accepted };
  }

  async recompute(runId: string, actor = 'api-user'): Promise<TypologyRun> {
    const run = await this.getRun(runId);
    ensureStatus(run, ['COLLECTING', 'WAITING_FOR_RESTRICTED_DATA', 'QA_REVIEW', 'PROVISIONAL'], 'recompute');
    transition(run, 'COMPUTING', 'DETERMINISTIC_RECOMPUTE_STARTED', actor);
    run.score = aggregateTypology(run.tasks, run.measurements);
    run.dual_layer_typology = computeDualLayerTypology(run.tasks, run.measurements, run.request.official_context);
    run.missing = taskMissing(run);
    transition(run, 'QA_REVIEW', 'DETERMINISTIC_RECOMPUTE_FINISHED', 'system', {
      computed_indicators: run.tasks.filter((task) => task.status === 'COMPUTED').length,
      missing_indicators: run.missing.length,
      dual_layer_status: run.dual_layer_typology.provisional ? 'provisional' : 'complete',
      official_status: run.dual_layer_typology.official.status,
    });
    run.publication_level = publicationLevel(run);
    await this.store.update(run);
    return run;
  }

  async approve(runId: string, body: unknown): Promise<{ run: TypologyRun; gates: ReturnType<typeof verificationGates> }> {
    const run = await this.getRun(runId);
    ensureStatus(run, ['QA_REVIEW', 'PROVISIONAL'], 'approval');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypologyError(400, 'VALIDATION_ERROR', 'JSON request body is required');
    const input = body as Record<string, unknown>;
    const reviewerId = requireText(input.reviewer_id, 'reviewer_id');
    const decision = requireText(input.decision, 'decision') as 'approve' | 'reject';
    if (!['approve', 'reject'].includes(decision)) throw new TypologyError(400, 'VALIDATION_ERROR', 'decision must be approve or reject');
    run.reviewer = {
      id: reviewerId,
      name: optionalText(input.reviewer_name, 'reviewer_name'),
      decision,
      reason: optionalText(input.reason, 'reason', 2_000),
      at: now(),
    };

    if (decision === 'reject') {
      transition(run, 'REJECTED', 'RUN_REJECTED', reviewerId, { reason: run.reviewer.reason });
      run.publication_level = 'REJECTED';
      await this.store.update(run);
      return { run, gates: { eligible: false, failures: ['reviewer_rejected'] } };
    }

    const gates = verificationGates(run.boundary?.confidence, run.score);
    if (gates.eligible) {
      run.tasks = run.tasks.map((task) => task.status === 'COMPUTED' ? { ...task, status: 'APPROVED' as IndicatorStatus } : task);
      transition(run, 'VERIFIED', 'RUN_VERIFIED', reviewerId);
      run.publication_level = 'VERIFIED';
    } else {
      transition(run, 'PROVISIONAL', 'APPROVAL_RECORDED_WITH_UNMET_GATES', reviewerId, { failures: gates.failures });
      run.publication_level = publicationLevel(run);
    }
    await this.store.update(run);
    return { run, gates };
  }

  async coverage(runId: string): Promise<Record<string, unknown>> {
    const run = await this.getRun(runId);
    const statusCounts = Object.fromEntries(
      [...new Set(run.tasks.map((task) => task.status))].sort().map((status) => [status, run.tasks.filter((task) => task.status === status).length]),
    );
    const computed = run.tasks.filter((task) => ['COMPUTED', 'APPROVED'].includes(task.status)).length;
    const approved = run.tasks.filter((task) => task.status === 'APPROVED').length;
    const byDomain = Object.fromEntries(['physical', 'behavioral', 'normative'].map((domain) => {
      const tasks = run.tasks.filter((task) => task.domain === domain);
      return [domain, {
        total: tasks.length,
        computed: tasks.filter((task) => ['COMPUTED', 'APPROVED'].includes(task.status)).length,
        weighted_coverage: run.score?.weighted_coverage[domain] ?? 0,
      }];
    }));
    return {
      run_id: run.run_id,
      status: run.status,
      publication_level: run.publication_level,
      // Keep the response contract aligned with the immutable registry snapshot
      // used by this run.  A hard-coded total would make coverage lie as soon
      // as the registry is extended or a historical run uses another version.
      total: run.tasks.length,
      computed,
      approved,
      missing: run.missing.length,
      failed_qa: statusCounts.FAILED_QA ?? 0,
      waiting_public: statusCounts.DOWNLOADING_PUBLIC_DATA ?? 0,
      waiting_organizational: statusCounts.WAITING_FOR_ORGANIZATIONAL_DATA ?? 0,
      waiting_survey: statusCounts.WAITING_FOR_SURVEY ?? 0,
      waiting_field: statusCounts.WAITING_FOR_FIELD_AUDIT ?? 0,
      weighted: run.score ? Object.values(run.score.weighted_coverage).reduce((sum, value) => sum + value, 0) / 3 : 0,
      status_counts: statusCounts,
      by_domain: byDomain,
      by_driver: run.score?.driver_coverage ?? Object.fromEntries([...new Set(run.tasks.map((task) => task.driver_id))].map((driver) => [driver, 0])),
      missing_items: run.missing,
    };
  }

  async report(runId: string): Promise<Record<string, unknown>> {
    const run = await this.getRun(runId);
    const currentMeasurements = run.measurements.filter((measurement) => !measurement.superseded_by);
    const coverage = await this.coverage(runId);
    const gates = verificationGates(run.boundary?.confidence, run.score);
    const missingData = run.missing.map((item) => {
      const task = run.tasks.find((candidate) => candidate.code === item.indicator_code);
      return {
        ...item,
        indicator: task?.indicator,
        access_mode: task?.access_mode,
        next_action: localizedMissingAction(item.reason, item.next_action),
        owner: suggestedDataOwner(task?.access_mode),
      };
    });
    const requestName = safeStoredPlaceText(run.request.neighborhood_name, 'محله ثبت شده بدون نام معتبر');
    const selectedName = run.candidates.find((candidate) => candidate.id === run.selected_candidate_id)?.name;
    return {
      run_id: run.run_id,
      status: run.status,
      publication_level: run.publication_level,
      created_at: run.created_at,
      updated_at: run.updated_at,
      identity: {
        official_name: safeStoredPlaceText(selectedName, requestName),
        aliases: [requestName],
        province: safeStoredPlaceText(run.request.province),
        city_or_county: safeStoredPlaceText(run.request.city_or_county),
        settlement_type: run.request.settlement_type,
        selected_candidate_id: run.selected_candidate_id ?? null,
      },
      boundary: run.boundary ? { ...run.boundary, candidate_id: run.selected_candidate_id ?? null } : null,
      registry: this.getRegistryMetadata(),
      reference_year: run.request.reference_year,
      reference_cohort_id: run.reference_cohort_id ?? null,
      coverage,
      indicator_plan: run.tasks,
      evidence_ledger: currentMeasurements,
      results: run.score ?? null,
      dual_layer_typology: run.dual_layer_typology ?? null,
      verification_gates: gates,
      missing_data: missingData,
      audit: {
        code_version: run.code_version,
        registry_version: run.registry_version,
        events: run.audit,
        reviewer: run.reviewer ?? null,
      },
      honesty_boundary: {
        ai_numeric_generation_allowed: false,
        missing_values_are_zero: false,
        imputation_used_in_verified_result: false,
        note: 'Only uploaded, provenance-bearing values with an approved formula version can contribute to P/B/N.',
      },
    };
  }
}
