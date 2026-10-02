import fs from 'node:fs';
import path from 'node:path';
import type { TypologyConfig, TypologyConfigInput } from './types.js';

export const DEFAULT_TYPOLOGY_CONFIG: TypologyConfig = {
  version: '1.0',
  scoring: {
    scaleMin: 1,
    scaleMax: 5,
    lowAnchorUpperExclusive: 2,
    highAnchorLowerInclusive: 4,
    minimumDomainWeightCoverage: 0.7,
    minimumDriverWeightCoverage: 0.5,
    minimumBootstrapLabelStability: 0.8,
    maximumReferenceYearGap: 2,
    allowImputationInCertifiedResult: false,
  },
  privacy: {
    minimumPublishableCellCount: 10,
    removeDirectIdentifiers: true,
    storeSensitiveCoordinates: false,
  },
  referenceCohort: {
    required: true,
    matchFields: ['settlement_type', 'province', 'population_band', 'climate_zone'],
  },
  aggregation: {
    withinDomain: 'weighted_arithmetic_mean',
    acrossDomains: 'geometric_mean',
    equalDomainWeightForSI: true,
  },
  quality: {
    boundaryConfidenceMinimum: 0.9,
    rasterValidPixelShareMinimum: 0.8,
    surveyResponseRateMinimum: 0.6,
    fieldDoubleRatingShare: 0.1,
  },
};

export function mergeTypologyConfig(config: TypologyConfigInput = {}): TypologyConfig {
  return {
    ...DEFAULT_TYPOLOGY_CONFIG,
    ...config,
    scoring: { ...DEFAULT_TYPOLOGY_CONFIG.scoring, ...config.scoring },
    privacy: { ...DEFAULT_TYPOLOGY_CONFIG.privacy, ...config.privacy },
    referenceCohort: { ...DEFAULT_TYPOLOGY_CONFIG.referenceCohort, ...config.referenceCohort },
    aggregation: { ...DEFAULT_TYPOLOGY_CONFIG.aggregation, ...config.aggregation },
    quality: { ...DEFAULT_TYPOLOGY_CONFIG.quality, ...config.quality },
  };
}

function parseScalar(value: string): string | number | boolean | string[] {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  return trimmed;
}

/** Loads the controlled subset used by neighborhood_typology/config.yml without a YAML runtime dependency. */
export function loadTypologyConfig(filePath: string): TypologyConfig {
  const absolutePath = path.resolve(filePath);
  const flat = new Map<string, string | number | boolean | string[]>();
  let section = '';
  for (const rawLine of fs.readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const match = /^(\s*)([A-Za-z0-9_]+):(?:\s*(.*))?$/.exec(line);
    if (!match) throw new Error(`Unsupported typology config line: ${rawLine}`);
    const [, indent, key, rawValue = ''] = match;
    if (!indent.length && !rawValue.trim()) {
      section = key;
      continue;
    }
    const pathKey = indent.length ? `${section}.${key}` : key;
    flat.set(pathKey, parseScalar(rawValue));
  }

  const number = (key: string, fallback: number) => typeof flat.get(key) === 'number' ? flat.get(key) as number : fallback;
  const boolean = (key: string, fallback: boolean) => typeof flat.get(key) === 'boolean' ? flat.get(key) as boolean : fallback;
  const string = (key: string, fallback: string) => typeof flat.get(key) === 'string' ? flat.get(key) as string : fallback;
  const array = (key: string, fallback: string[]) => Array.isArray(flat.get(key)) ? flat.get(key) as string[] : fallback;
  return mergeTypologyConfig({
    version: string('version', DEFAULT_TYPOLOGY_CONFIG.version),
    scoring: {
      scaleMin: number('scoring.scale_min', DEFAULT_TYPOLOGY_CONFIG.scoring.scaleMin),
      scaleMax: number('scoring.scale_max', DEFAULT_TYPOLOGY_CONFIG.scoring.scaleMax),
      lowAnchorUpperExclusive: number('scoring.low_anchor_upper_exclusive', DEFAULT_TYPOLOGY_CONFIG.scoring.lowAnchorUpperExclusive),
      highAnchorLowerInclusive: number('scoring.high_anchor_lower_inclusive', DEFAULT_TYPOLOGY_CONFIG.scoring.highAnchorLowerInclusive),
      minimumDomainWeightCoverage: number('scoring.minimum_domain_weight_coverage', DEFAULT_TYPOLOGY_CONFIG.scoring.minimumDomainWeightCoverage),
      minimumDriverWeightCoverage: number('scoring.minimum_driver_weight_coverage', DEFAULT_TYPOLOGY_CONFIG.scoring.minimumDriverWeightCoverage),
      minimumBootstrapLabelStability: number('scoring.minimum_bootstrap_label_stability', DEFAULT_TYPOLOGY_CONFIG.scoring.minimumBootstrapLabelStability),
      maximumReferenceYearGap: number('scoring.maximum_reference_year_gap', DEFAULT_TYPOLOGY_CONFIG.scoring.maximumReferenceYearGap),
      allowImputationInCertifiedResult: boolean('scoring.allow_imputation_in_certified_result', DEFAULT_TYPOLOGY_CONFIG.scoring.allowImputationInCertifiedResult),
    },
    privacy: {
      minimumPublishableCellCount: number('privacy.minimum_publishable_cell_count', DEFAULT_TYPOLOGY_CONFIG.privacy.minimumPublishableCellCount),
      removeDirectIdentifiers: boolean('privacy.remove_direct_identifiers', DEFAULT_TYPOLOGY_CONFIG.privacy.removeDirectIdentifiers),
      storeSensitiveCoordinates: boolean('privacy.store_sensitive_coordinates', DEFAULT_TYPOLOGY_CONFIG.privacy.storeSensitiveCoordinates),
    },
    referenceCohort: {
      required: boolean('reference_cohort.required', DEFAULT_TYPOLOGY_CONFIG.referenceCohort.required),
      matchFields: array('reference_cohort.match_fields', DEFAULT_TYPOLOGY_CONFIG.referenceCohort.matchFields),
    },
    aggregation: DEFAULT_TYPOLOGY_CONFIG.aggregation,
    quality: {
      boundaryConfidenceMinimum: number('quality.boundary_confidence_minimum', DEFAULT_TYPOLOGY_CONFIG.quality.boundaryConfidenceMinimum),
      rasterValidPixelShareMinimum: number('quality.raster_valid_pixel_share_minimum', DEFAULT_TYPOLOGY_CONFIG.quality.rasterValidPixelShareMinimum),
      surveyResponseRateMinimum: number('quality.survey_response_rate_minimum', DEFAULT_TYPOLOGY_CONFIG.quality.surveyResponseRateMinimum),
      fieldDoubleRatingShare: number('quality.field_double_rating_share', DEFAULT_TYPOLOGY_CONFIG.quality.fieldDoubleRatingShare),
    },
  });
}

export function defaultConfigPath(cwd = process.cwd()): string {
  return path.resolve(cwd, 'neighborhood_typology', 'config.yml');
}

export function loadDefaultTypologyConfig(cwd = process.cwd()): TypologyConfig {
  return loadTypologyConfig(defaultConfigPath(cwd));
}
