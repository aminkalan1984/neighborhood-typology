import { randomUUID } from 'node:crypto';
import type { NeighborhoodRequest, RunRecord, RunStatus } from './types.js';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizePersianText(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[‌ـ]/g, ' ')
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.split(' ').filter((token) => !['محله', 'کوی', 'روستا'].includes(token)).join(' ');
}

export function normalizeNeighborhoodRequest(input: Record<string, unknown>): NeighborhoodRequest {
  const neighborhoodName = String(input.neighborhoodName ?? input.neighborhood_name ?? '').trim();
  const cityOrCounty = String(input.cityOrCounty ?? input.city_or_county ?? '').trim();
  const province = String(input.province ?? '').trim();
  const settlementType = String(input.settlementType ?? input.settlement_type ?? '').trim();
  const referenceYear = Number(input.referenceYear ?? input.reference_year);
  const purpose = String(input.purpose ?? 'baseline');

  const missing = [
    ['neighborhood_name', neighborhoodName],
    ['city_or_county', cityOrCounty],
    ['province', province],
  ].filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing required request fields: ${missing.join(', ')}`);
  if (settlementType !== 'urban' && settlementType !== 'rural') {
    throw new Error('settlement_type must be urban or rural');
  }
  if (!Number.isInteger(referenceYear) || referenceYear < 1300 || referenceYear > 3000) {
    throw new Error('reference_year must be a four-digit Gregorian or Solar Hijri year');
  }

  return {
    ...input,
    neighborhoodName,
    cityOrCounty,
    province,
    settlementType,
    referenceYear,
    optionalBoundaryGeojson: input.optionalBoundaryGeojson ?? input.optional_boundary_geojson ?? input.boundary_geojson ?? null,
    purpose,
  };
}

export function createVersionedRun(
  requestInput: Record<string, unknown>,
  registryVersion: string,
  options: { runId?: string; codeVersion?: string; createdAt?: string } = {},
): RunRecord {
  return {
    runId: options.runId ?? randomUUID(),
    request: normalizeNeighborhoodRequest(requestInput),
    registryVersion,
    codeVersion: options.codeVersion ?? 'working-tree',
    status: 'WAITING_FOR_LOCATION_RESOLUTION',
    createdAt: options.createdAt ?? new Date().toISOString(),
    folders: ['raw', 'staging', 'curated', 'features', 'reports'],
  };
}

const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ['WAITING_FOR_LOCATION_RESOLUTION', 'REJECTED'],
  WAITING_FOR_LOCATION_RESOLUTION: ['LOCATION_AMBIGUOUS', 'BOUNDARY_CONFIRMED', 'REJECTED'],
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

export function transitionRun<T extends RunRecord>(run: T, nextStatus: RunStatus): T {
  if (!TRANSITIONS[run.status].includes(nextStatus)) {
    throw new Error(`Invalid run transition: ${run.status} -> ${nextStatus}`);
  }
  return { ...run, status: nextStatus };
}
