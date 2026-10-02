import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './csv.js';
import type { Direction, Domain, IndicatorRegistry, RegistryIndex } from './types.js';

export const EXPECTED_INDICATOR_COUNTS = Object.freeze({
  total: 419,
  physical: 177,
  behavioral: 209,
  normative: 33,
});

export const EXPECTED_DIRECTION_COUNTS = Object.freeze({ direct: 341, inverse: 58, optimal: 20 });
export const EXPECTED_ACCESS_MODE_COUNTS = Object.freeze({
  'ترکیبی: برخط + درخواست سازمانی': 153,
  'ترکیبی: تولید میدانی + درخواست سازمانی': 124,
  'درخواست سازمانی/داده غیرعمومی': 91,
  'تولید میدانی': 44,
  'برخط/باز': 7,
});
export const EXPECTED_INDICATOR_CODES = Object.freeze([
  ...Array.from({ length: 177 }, (_, index) => `PHY-${String(index + 1).padStart(3, '0')}`),
  ...Array.from({ length: 209 }, (_, index) => `BEH-${String(index + 1).padStart(3, '0')}`),
  ...Array.from({ length: 33 }, (_, index) => `NOR-${String(index + 1).padStart(3, '0')}`),
]);

function required(row: Record<string, string>, key: string, rowIndex: number): string {
  const value = row[key]?.trim();
  if (!value) throw new Error(`Registry row ${rowIndex + 2}: missing ${key}`);
  return value;
}

function finite(row: Record<string, string>, key: string, rowIndex: number): number {
  const value = Number(required(row, key, rowIndex));
  if (!Number.isFinite(value)) throw new Error(`Registry row ${rowIndex + 2}: ${key} is not numeric`);
  return value;
}

export function parseDirection(value: string): Direction {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'direct' || normalized.includes('مستقیم')) return 'direct';
  if (normalized === 'inverse' || normalized.includes('معکوس')) return 'inverse';
  if (normalized === 'optimal' || normalized.includes('آستانه') || normalized.includes('بهینه')) return 'optimal';
  throw new Error(`Unsupported indicator direction: ${value}`);
}

function parseDomain(value: string): Domain {
  if (value === 'physical' || value === 'behavioral' || value === 'normative') return value;
  throw new Error(`Unsupported domain: ${value}`);
}

export function parseRegistryCsv(text: string, options: { strict?: boolean; version?: string; sourcePath?: string } = {}): RegistryIndex {
  const rows = parseCsv(text).map((row, rowIndex): IndicatorRegistry => {
    const code = required(row, 'code', rowIndex);
    const formulaVersion = row.formula_version?.trim() || `${code}@1.0`;
    return {
      code,
      domain: parseDomain(required(row, 'domain', rowIndex)),
      domainFa: required(row, 'domain_fa', rowIndex),
      axis: required(row, 'axis', rowIndex),
      sourceOrder: finite(row, 'source_order', rowIndex),
      indicator: required(row, 'indicator', rowIndex),
      coefficient: finite(row, 'coefficient', rowIndex),
      coefficientLabel: required(row, 'coefficient_label', rowIndex),
      direction: parseDirection(required(row, 'direction', rowIndex)),
      directionRaw: required(row, 'direction', rowIndex),
      categoryWeightPercent: finite(row, 'category_weight_percent', rowIndex),
      domainWeightPercent: finite(row, 'domain_weight_percent', rowIndex),
      driverId: required(row, 'driver_id', rowIndex),
      mappingConfidence: required(row, 'mapping_confidence', rowIndex),
      template: required(row, 'template', rowIndex),
      calcFamily: required(row, 'calc_family', rowIndex),
      accessMode: required(row, 'access_mode', rowIndex),
      playbookCodes: (row.playbook_codes ?? '').split(',').map((part) => part.trim()).filter(Boolean),
      sourceRequirements: required(row, 'source_requirements', rowIndex),
      formulaText: required(row, 'formula_text', rowIndex),
      formulaVersion,
      registryStatus: required(row, 'registry_status', rowIndex),
    };
  });

  const byCode = new Map<string, IndicatorRegistry>();
  const byDomainMutable = new Map<Domain, IndicatorRegistry[]>([
    ['physical', []], ['behavioral', []], ['normative', []],
  ]);
  const byDriverMutable = new Map<string, IndicatorRegistry[]>();
  const duplicateCodes: string[] = [];
  const directionCounts: Record<Direction, number> = { direct: 0, inverse: 0, optimal: 0 };
  const driverWeightTotals: Record<string, number> = {};
  const accessModeCounts: Record<string, number> = {};
  const weightTotals: Record<Domain, number> = { physical: 0, behavioral: 0, normative: 0 };

  for (const row of rows) {
    if (byCode.has(row.code)) duplicateCodes.push(row.code);
    byCode.set(row.code, row);
    byDomainMutable.get(row.domain)!.push(row);
    const driverRows = byDriverMutable.get(row.driverId) ?? [];
    driverRows.push(row);
    byDriverMutable.set(row.driverId, driverRows);
    directionCounts[row.direction] += 1;
    accessModeCounts[row.accessMode] = (accessModeCounts[row.accessMode] ?? 0) + 1;
    weightTotals[row.domain] += row.domainWeightPercent;
    driverWeightTotals[row.driverId] = (driverWeightTotals[row.driverId] ?? 0) + row.domainWeightPercent;
  }

  const counts = {
    total: rows.length,
    physical: byDomainMutable.get('physical')!.length,
    behavioral: byDomainMutable.get('behavioral')!.length,
    normative: byDomainMutable.get('normative')!.length,
  };
  const errors: string[] = [];
  if (duplicateCodes.length) errors.push(`duplicate codes: ${[...new Set(duplicateCodes)].join(', ')}`);
  for (const row of rows) {
    const expectedPrefix = row.domain === 'physical' ? 'PHY-' : row.domain === 'behavioral' ? 'BEH-' : 'NOR-';
    if (!row.code.startsWith(expectedPrefix)) errors.push(`${row.code} does not match ${row.domain}`);
    if (row.coefficient < 1 || row.coefficient > 5) errors.push(`${row.code} coefficient must be 1..5`);
    if (row.domainWeightPercent <= 0) errors.push(`${row.code} domain weight must be positive`);
    if (row.playbookCodes.some((code) => !/^N(?:0[1-9]|1\d|2[0-5])$/.test(code))) errors.push(`${row.code} has an invalid playbook code`);
  }
  if (options.strict !== false) {
    for (const [key, expected] of Object.entries(EXPECTED_INDICATOR_COUNTS)) {
      const actual = counts[key as keyof typeof counts];
      if (actual !== expected) errors.push(`${key} indicator count is ${actual}; expected ${expected}`);
    }
    for (const domain of ['physical', 'behavioral', 'normative'] as const) {
      if (Math.abs(weightTotals[domain] - 100) > 1e-6) errors.push(`${domain} weights total ${weightTotals[domain]}; expected 100`);
    }
    for (const direction of ['direct', 'inverse', 'optimal'] as const) {
      if (directionCounts[direction] !== EXPECTED_DIRECTION_COUNTS[direction]) {
        errors.push(`${direction} direction count is ${directionCounts[direction]}; expected ${EXPECTED_DIRECTION_COUNTS[direction]}`);
      }
    }
    const actualCodes = new Set(rows.map((row) => row.code));
    const missingCodes = EXPECTED_INDICATOR_CODES.filter((code) => !actualCodes.has(code));
    const unexpectedCodes = rows.map((row) => row.code).filter((code) => !EXPECTED_INDICATOR_CODES.includes(code));
    if (missingCodes.length) errors.push(`missing indicator codes: ${missingCodes.join(', ')}`);
    if (unexpectedCodes.length) errors.push(`unexpected indicator codes: ${unexpectedCodes.join(', ')}`);
    for (const [accessMode, expected] of Object.entries(EXPECTED_ACCESS_MODE_COUNTS)) {
      if ((accessModeCounts[accessMode] ?? 0) !== expected) errors.push(`${accessMode} count is ${accessModeCounts[accessMode] ?? 0}; expected ${expected}`);
    }
    const expectedDrivers = ['P1', 'P2', 'P3', 'B1', 'B2', 'B3', 'B4', 'N1', 'N2', 'N3'];
    const actualDrivers = [...byDriverMutable.keys()].sort();
    if (actualDrivers.join(',') !== expectedDrivers.sort().join(',')) errors.push(`driver set is ${actualDrivers.join(',')}`);
  }
  if (errors.length) throw new Error(`Invalid typology registry: ${errors.join('; ')}`);

  rows.sort((left, right) => {
    const domainOrder: Record<Domain, number> = { physical: 0, behavioral: 1, normative: 2 };
    return domainOrder[left.domain] - domainOrder[right.domain] || left.sourceOrder - right.sourceOrder || left.code.localeCompare(right.code);
  });
  return {
    rows,
    byCode,
    byDomain: byDomainMutable,
    byDriver: byDriverMutable,
    version: options.version ?? '1.0',
    sourcePath: options.sourcePath,
    expectedCount: EXPECTED_INDICATOR_COUNTS.total,
    counts,
    weightTotals,
    driverWeightTotals,
    directionCounts,
  };
}

export function loadRegistry(filePath: string, options: { strict?: boolean; version?: string } = {}): RegistryIndex {
  const absolutePath = path.resolve(filePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  const checksum = createHash('sha256').update(text).digest('hex');
  return parseRegistryCsv(text, { ...options, version: options.version ?? `sha256:${checksum}`, sourcePath: absolutePath });
}

export function defaultRegistryPath(cwd = process.cwd()): string {
  return path.resolve(cwd, 'neighborhood_typology', 'indicator_registry_419.csv');
}

let cachedDefaultRegistry: RegistryIndex | null = null;

export function loadDefaultRegistry(cwd = process.cwd()): RegistryIndex {
  const registryPath = defaultRegistryPath(cwd);
  if (!cachedDefaultRegistry || cachedDefaultRegistry.sourcePath !== registryPath) {
    cachedDefaultRegistry = loadRegistry(registryPath);
  }
  return cachedDefaultRegistry;
}
