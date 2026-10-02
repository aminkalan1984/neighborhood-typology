import { loadRegistry } from './typologyRegistry';
import type { RegistryRow } from './typologyTypes';

/**
 * Semantic layer for the indicator registry.
 *
 * The CSV registry remains the source of record for names and weights.  This
 * module adds an explicit measurement contract so that a connector cannot
 * silently treat a distance as a benefit, a count as a comparable rate, or a
 * survey answer as an observed physical fact.
 */

export const SEMANTIC_SCHEMA_VERSION = '1.0.0';
export const EXPECTED_INDICATOR_COUNT = 419;

export type IndicatorPolarity = 'benefit' | 'cost' | 'target' | 'contextual';

export type IndicatorMeasurementType =
  | 'network_access'
  | 'network_accessibility_composite'
  | 'distance'
  | 'travel_rate'
  | 'transport_service_index'
  | 'coverage_rate'
  | 'service_capacity_rate'
  | 'per_capita'
  | 'density'
  | 'count'
  | 'ratio'
  | 'rate'
  | 'trend'
  | 'survey_likert'
  | 'perception_index'
  | 'field_compliance'
  | 'binary_existence'
  | 'composite_index'
  | 'spatial_index'
  | 'entropy'
  | 'exposure_rate'
  | 'target_gap'
  | 'area_per_capita'
  | 'categorical_composition'
  | 'unknown';

/** A deliberately open vocabulary: new data providers can add a level later. */
export type SpatialLevel =
  | 'parcel'
  | 'building'
  | 'dwelling_or_household'
  | 'block'
  | 'site_or_segment'
  | 'network_block_to_service'
  | 'household_or_user_sample'
  | 'subneighborhood'
  | 'neighborhood'
  | 'neighborhood_to_city'
  | 'city_or_region'
  | 'unknown';

export type ProxyPolicyMode = 'none' | 'bounded' | 'fallback_only' | 'forbidden';

export interface RatioSemantics {
  numerator: string | null;
  denominator: string | null;
  scale: number | null;
  time_basis: string | null;
  expression: string | null;
}

export interface ProxyPolicy {
  mode: ProxyPolicyMode;
  allowed: boolean;
  allowed_sources: string[];
  requires_disclosure: boolean;
  max_unverified_coverage: number | null;
  fallback: 'missing' | 'flagged_estimate' | 'approved_connector' | 'none';
  rationale: string;
}

export interface SemanticNormalization {
  method: 'min_max' | 'percent_of_total' | 'per_capita' | 'z_score_cohort' | 'target_distance' | 'likert_1_5' | 'binary' | 'entropy' | 'composite_components' | 'none';
  score_range: [number, number] | null;
  formula: string;
  reference_cohort: 'city' | 'province' | 'national' | 'standard' | 'none';
}

export interface IndicatorSemanticContract {
  code: string;
  domain: string;
  axis: string;
  indicator: string;
  template: string;
  calc_family: string;
  measurement_type: IndicatorMeasurementType;
  /** Camel-case aliases make the contract convenient for API consumers. */
  measureType: IndicatorMeasurementType;
  polarity: IndicatorPolarity;
  raw_unit: string;
  rawUnit: string;
  numerator: string | null;
  denominator: string | null;
  ratio: RatioSemantics;
  spatial_level: SpatialLevel;
  spatialLevel: SpatialLevel;
  proxy_policy: ProxyPolicy;
  proxyPolicy: ProxyPolicy;
  normalization: SemanticNormalization;
  known_errors: string[];
  knownErrors: string[];
  source_signals: string[];
  inference: {
    confidence: 'high' | 'medium' | 'low';
    rules: string[];
  };
}

export interface SemanticAuditIssue {
  code: string;
  severity: 'error' | 'warning';
  field: string;
  rule: string;
  message: string;
}

export interface IndicatorSemanticAudit {
  schema_version: string;
  registry_version: string | null;
  expected_count: number;
  actual_count: number;
  audited_count: number;
  valid_count: number;
  error_count: number;
  warning_count: number;
  ok: boolean;
  coverage: number;
  issues: SemanticAuditIssue[];
  contracts: IndicatorSemanticContract[];
  by_measurement_type: Record<string, number>;
  by_polarity: Record<IndicatorPolarity, number>;
  by_spatial_level: Record<string, number>;
}

type SemanticOverride = Partial<Pick<IndicatorSemanticContract,
  'measurement_type' | 'polarity' | 'raw_unit' | 'numerator' | 'denominator' |
  'spatial_level' | 'normalization' | 'known_errors' | 'inference'>> & {
  ratio?: Partial<RatioSemantics>;
  proxy_policy?: Partial<ProxyPolicy>;
};

const NETWORK_ACCESS_CODES = new Set([
  'PHY-001', 'PHY-002', 'PHY-003', 'PHY-004', 'NOR-022',
]);

/**
 * Explicit corrections for high-risk rows.  Several rows intentionally carry
 * a generic formula in the CSV; the override records the operational contract
 * without mutating the approved registry itself.
 */
const SPECIAL_OVERRIDES: Record<string, SemanticOverride> = {
  ...Object.fromEntries([...NETWORK_ACCESS_CODES].map((code) => [code, {
    measurement_type: 'network_access' as const,
    polarity: 'benefit' as const,
    raw_unit: 'network_meters_or_minutes; derived_coverage_percent',
    numerator: 'population_within_service_threshold',
    denominator: 'resident_population',
    spatial_level: 'network_block_to_service' as const,
    normalization: {
      method: 'percent_of_total' as const,
      score_range: [0, 100] as [number, number],
      formula: '100 * population_within_threshold / resident_population; report median network distance/time separately',
      reference_cohort: 'standard' as const,
    },
    known_errors: [
      'network_distance_is_not_a_benefit_without_coverage_transform',
      'network_vs_euclidean_distance',
      'service_threshold_or_destination_class_not_defined',
      'boundary_population_mismatch',
      'zero_or_missing_population_denominator',
    ],
    inference: { confidence: 'high' as const, rules: ['explicit_network_access_contract'] },
  }])),
  'PHY-106': {
    measurement_type: 'coverage_rate',
    polarity: 'benefit',
    raw_unit: 'percent_of_occupied_households',
    numerator: 'occupied_households_with_computer_or_fixed_line',
    denominator: 'occupied_households',
    spatial_level: 'block',
    normalization: {
      method: 'percent_of_total', score_range: [0, 100],
      formula: '100 * qualifying_households / occupied_households', reference_cohort: 'city',
    },
    known_errors: [
      'generic_network_formula_is_not_a_household_coverage_measure',
      'computer_and_fixed_line_are_distinct_variables',
      'technology_definition_and_census_year_mismatch',
      'zero_or_missing_household_denominator',
    ],
    inference: { confidence: 'high', rules: ['explicit_household_ict_coverage_contract'] },
  },
  'PHY-112': {
    measurement_type: 'travel_rate',
    polarity: 'contextual',
    raw_unit: 'trips_per_person_per_day',
    numerator: 'daily_person_trips',
    denominator: 'resident_population',
    spatial_level: 'neighborhood_to_city',
    normalization: {
      method: 'per_capita', score_range: [0, 100],
      formula: 'daily_person_trips / resident_population; report production and attraction separately', reference_cohort: 'city',
    },
    known_errors: [
      'trip_count_is_scale_sensitive',
      'production_and_attraction_must_not_be_mixed',
      'mobile_phone_sample_selection_bias',
      'time_of_day_and_day_type_mismatch',
    ],
    inference: { confidence: 'high', rules: ['explicit_daily_trip_rate_contract'] },
  },
  'PHY-148': {
    measurement_type: 'network_accessibility_composite',
    polarity: 'benefit',
    raw_unit: 'network_minutes_and_coverage_percent',
    numerator: 'population_within_time_threshold_to_incubators_science_parks_and_transit',
    denominator: 'resident_population',
    spatial_level: 'network_block_to_service',
    normalization: {
      method: 'percent_of_total', score_range: [0, 100],
      formula: 'weighted coverage and inverse network travel time to knowledge and export gateways', reference_cohort: 'standard',
    },
    known_errors: [
      'generic_park_formula_copy_mismatch',
      'knowledge_destination_inventory_incomplete',
      'network_time_model_and_traffic_period_mismatch',
      'double_counting_incubator_and_science_park_destinations',
    ],
    inference: { confidence: 'high', rules: ['explicit_knowledge_access_contract'] },
  },
  'PHY-154': {
    measurement_type: 'field_compliance',
    polarity: 'benefit',
    raw_unit: 'percent_of_wayfinding_points_compliant',
    numerator: 'parking_and_destination_signage_points_compliant',
    denominator: 'assessed_wayfinding_points',
    spatial_level: 'site_or_segment',
    normalization: {
      method: 'percent_of_total', score_range: [0, 100],
      formula: '100 * compliant_signage_points / assessed_wayfinding_points', reference_cohort: 'standard',
    },
    known_errors: [
      'generic_park_access_formula_copy_mismatch',
      'observer_reliability_and_checklist_drift',
      'sampled_points_may_not_represent_all_decision_nodes',
      'zero_or_missing_assessed_points',
    ],
    inference: { confidence: 'high', rules: ['explicit_wayfinding_compliance_contract'] },
  },
  'PHY-159': {
    measurement_type: 'service_capacity_rate',
    polarity: 'contextual',
    raw_unit: 'hospitals_or_beds_per_10000_residents',
    numerator: 'active_hospital_count_or_bed_capacity',
    denominator: 'resident_population',
    spatial_level: 'neighborhood_to_city',
    normalization: {
      method: 'per_capita', score_range: [0, 100],
      formula: '10,000 * active hospital capacity (or count) / resident_population; retain catchment-adjusted capacity', reference_cohort: 'city',
    },
    known_errors: [
      'raw_count_is_scale_sensitive',
      'hospital_catchment_crosses_neighborhood_boundary',
      'count_and_bed_capacity_are_not_interchangeable',
      'generic_health_formula_may_overstate_local_service',
    ],
    inference: { confidence: 'high', rules: ['explicit_hospital_capacity_contract'] },
  },
  'NOR-008': {
    measurement_type: 'transport_service_index',
    polarity: 'benefit',
    raw_unit: 'score_0_100_plus_network_minutes',
    numerator: 'weighted_coverage_frequency_reliability_affordability_and_quality',
    denominator: null,
    spatial_level: 'network_block_to_service',
    normalization: {
      method: 'composite_components', score_range: [0, 100],
      formula: 'equal-weight baseline of coverage, frequency, reliability, affordability, accessibility and perceived quality', reference_cohort: 'standard',
    },
    known_errors: [
      'generic_transport_formula_omits_service_quality_components',
      'network_access_and_perception_require_separate_evidence',
      'frequency_and_reliability_time_window_mismatch',
      'self_report_and_operator_data_conflict',
    ],
    inference: { confidence: 'high', rules: ['explicit_transport_service_index_contract'] },
  },
  'NOR-025': {
    measurement_type: 'transport_service_index',
    polarity: 'benefit',
    raw_unit: 'score_0_100_plus_network_minutes',
    numerator: 'weighted_public_transport_coverage_frequency_reliability_and_quality',
    denominator: null,
    spatial_level: 'network_block_to_service',
    normalization: {
      method: 'composite_components', score_range: [0, 100],
      formula: 'weighted service quality and network accessibility; retain distance/time and perception as separate components', reference_cohort: 'standard',
    },
    known_errors: [
      'generic_transport_formula_omits_service_quality_components',
      'network_access_and_perception_require_separate_evidence',
      'frequency_and_reliability_time_window_mismatch',
      'self_report_and_operator_data_conflict',
    ],
    inference: { confidence: 'high', rules: ['explicit_transport_service_index_contract'] },
  },
};

function text(row: RegistryRow): string {
  return `${row.indicator} ${row.template} ${row.calc_family} ${row.formula_text} ${row.source_requirements}`.toLocaleLowerCase('fa');
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function directionPolarity(row: RegistryRow, value: string): IndicatorPolarity {
  const direction = `${row.direction} ${value}`;
  if (direction.includes('آستانه')) return 'target';
  if (direction.includes('معکوس')) return 'cost';
  if (direction.includes('مستقیم')) return 'benefit';
  return 'contextual';
}

const FORMULA_TEMPLATE_TYPES: Partial<Record<string, IndicatorMeasurementType>> = {
  culture: 'composite_index',
  gis_quality: 'field_compliance',
  geography: 'composite_index',
  stormwater: 'composite_index',
  livestock: 'ratio',
  design_guideline: 'field_compliance',
  open_space: 'composite_index',
  emergency_coverage: 'coverage_rate',
  compliance: 'field_compliance',
  ecology: 'spatial_index',
  play_land: 'coverage_rate',
  ict: 'composite_index',
  incompatible_landuse: 'ratio',
  fallback: 'composite_index',
  water: 'per_capita',
  municipal_property: 'ratio',
  participatory_planning: 'composite_index',
  municipal_responsiveness: 'composite_index',
  healthy_lifestyle: 'composite_index',
  business: 'composite_index',
  housing_affordability: 'target_gap',
  local_market: 'coverage_rate',
  housing_finance: 'composite_index',
  poverty_concentration: 'exposure_rate',
  intergenerational: 'composite_index',
  physical_activity: 'rate',
  social_program: 'coverage_rate',
  employment_discrimination: 'rate',
  workplace_accessibility: 'field_compliance',
  volunteering: 'rate',
  economic_barrier: 'target_gap',
  location_quotient: 'ratio',
  technology_adoption: 'rate',
  empowerment: 'coverage_rate',
  corruption: 'composite_index',
  youth_unemployment: 'rate',
  rights_support: 'coverage_rate',
  vulnerability: 'rate',
  related_variety: 'entropy',
  place_status: 'perception_index',
  demographic_deviation: 'target_gap',
  social_harm: 'rate',
  equity_assessment: 'composite_index',
  compact_growth: 'spatial_index',
  distributional_equity: 'composite_index',
  social_protection: 'coverage_rate',
  parking: 'service_capacity_rate',
  tourism_income: 'per_capita',
  tourism_use: 'rate',
  service_responsiveness: 'composite_index',
  road_area: 'ratio',
  smart_city: 'composite_index',
};

function inferFormulaSpecificMeasurement(row: RegistryRow, value: string): { type: IndicatorMeasurementType; fallback: boolean } {
  if (value.includes('مقیاس ۱–۵') || value.includes('لیکرت')) return { type: 'survey_likert', fallback: false };
  if (value.includes('مقدار پایه دودویی')) return { type: 'binary_existence', fallback: false };
  if (value.includes('شاخص مرکب')) return { type: 'composite_index', fallback: false };
  if (value.includes('آنتروپی')) return { type: 'entropy', fallback: false };
  if (value.includes('سرانه')) return { type: 'per_capita', fallback: false };
  if (value.includes('تراکم')) return { type: 'density', fallback: false };
  if (value.includes('فاصله')) return { type: 'distance', fallback: false };
  if (value.includes('منطبق با') && value.includes('÷')) return { type: 'field_compliance', fallback: false };
  if (value.includes('درصد') || value.includes('نسبت') || value.includes('÷')) return { type: 'ratio', fallback: false };
  if (value.includes('تعداد')) return { type: 'count', fallback: false };
  const templateType = FORMULA_TEMPLATE_TYPES[row.template];
  if (templateType) return { type: templateType, fallback: false };
  // The row is retained, but it is not promoted to a precise atomic measure:
  // method-owner review is mandatory before a connector can verify it.
  return { type: row.indicator.trim() ? 'composite_index' : 'unknown', fallback: true };
}

function inferMeasurementType(row: RegistryRow, value: string): IndicatorMeasurementType {
  if (row.code === 'PHY-112') return 'travel_rate';
  if (row.code === 'PHY-159') return 'service_capacity_rate';
  if (row.calc_family === 'network_access') {
    if (row.template === 'transport_access' || row.template === 'health_access') return 'network_access';
    if (row.template === 'travel') return 'travel_rate';
    return 'network_access';
  }
  if (row.calc_family === 'survey_or_assessment') {
    return value.includes('مقیاس ۱–۵') || value.includes('لیکرت') ? 'survey_likert' : 'perception_index';
  }
  if (row.calc_family === 'field_audit') return 'field_compliance';
  if (row.calc_family === 'composite') return 'composite_index';
  if (row.calc_family === 'per_capita_or_density') {
    if (row.template === 'density') return 'density';
    if (row.template === 'count') return 'count';
    return 'per_capita';
  }
  if (row.calc_family === 'ratio_rate_or_trend') {
    return hasAny(value, ['روند', 'تغییر درصدی', 'سه ساله']) ? 'trend' : 'ratio';
  }
  if (row.calc_family === 'spatial_statistic') {
    if (value.includes('آنتروپی')) return 'entropy';
    if (hasAny(value, ['در معرض', 'آلودگی', 'خطر', 'حریم'])) return 'exposure_rate';
    if (value.includes('فاصله')) return 'distance';
    return 'spatial_index';
  }
  if (row.template === 'existence') return 'binary_existence';
  if (row.template === 'count') return 'count';
  if (row.template === 'housing_area') return 'area_per_capita';
  if (row.template === 'housing_material') return 'categorical_composition';
  if (row.template === 'housing_diversity') return 'entropy';
  if (row.template === 'service_deficit') return 'target_gap';
  if (row.template === 'generic_percent') return 'ratio';
  if (row.template === 'generic_rate') return 'rate';
  if (row.template === 'generic_ratio') return 'ratio';
  if (row.template === 'safety' || row.template === 'transport_quality') return 'composite_index';
  if (row.template === 'congestion') return 'ratio';
  if (row.template === 'noise') return 'exposure_rate';
  if (row.template === 'percap') return 'per_capita';
  if (row.template === 'accessibility') return 'coverage_rate';
  if (row.calc_family === 'formula_specific') return inferFormulaSpecificMeasurement(row, value).type;
  // Unknown future calculation families remain usable only as explicitly
  // review-required composites; malformed empty rows remain unknown.
  return row.indicator.trim() ? 'composite_index' : 'unknown';
}

function inferRawUnit(row: RegistryRow, type: IndicatorMeasurementType, value: string): string {
  if (type === 'survey_likert') return 'Likert_1_5';
  if (type === 'field_compliance' || type === 'coverage_rate' || type === 'exposure_rate' || type === 'ratio' || type === 'rate') return 'percent';
  if (type === 'trend') return 'percent_change_or_rate_per_period';
  if (type === 'binary_existence') return 'binary_0_1';
  if (type === 'entropy') return 'normalized_entropy_0_1';
  if (type === 'composite_index' || type === 'perception_index' || type === 'transport_service_index' || type === 'network_accessibility_composite') return 'score_0_100';
  if (type === 'travel_rate') return 'trips_per_person_per_day';
  if (type === 'density') return value.includes('نفر در هکتار') ? 'persons_per_hectare' : 'units_per_hectare';
  if (type === 'per_capita') {
    if (value.includes('۱۰٬۰۰۰') || value.includes('10000')) return 'per_10000_residents';
    if (value.includes('۱۰۰٬۰۰۰') || value.includes('100000')) return 'per_100000_residents';
    return 'per_1000_residents';
  }
  if (type === 'area_per_capita') return 'square_meters_per_resident';
  if (type === 'distance' || type === 'network_access') {
    if (hasAny(value, ['زمان', 'دقیقه', 'سفر'])) return 'network_minutes_or_meters';
    return 'network_meters_or_minutes';
  }
  if (type === 'count') return 'count';
  if (type === 'target_gap') return 'percent_gap_to_target';
  if (type === 'categorical_composition') return 'category_share_percent';
  if (type === 'spatial_index') return 'index_0_100';
  return 'unspecified';
}

function parseScale(value: string): number | null {
  if (value.includes('۱۰۰٬۰۰۰') || value.includes('100000')) return 100000;
  if (value.includes('۱۰٬۰۰۰') || value.includes('10000')) return 10000;
  if (value.includes('۱۰۰۰') || value.includes('1000')) return 1000;
  if (value.includes('×۱۰۰') || value.includes('×100') || value.includes('درصد')) return 100;
  return null;
}

function genericRatio(row: RegistryRow, type: IndicatorMeasurementType, value: string): RatioSemantics {
  const scale = parseScale(value);
  if (type === 'survey_likert') {
    return { numerator: 'weighted_mean_response_minus_1', denominator: '4', scale: 100, time_basis: 'survey_wave', expression: '(mean - 1) / 4 * 100' };
  }
  if (type === 'field_compliance') {
    return { numerator: 'compliant_observations', denominator: 'assessed_observations', scale: 100, time_basis: 'audit_visit', expression: 'compliant / assessed * 100' };
  }
  if (type === 'network_access' || type === 'coverage_rate') {
    return { numerator: 'population_within_service_threshold', denominator: 'resident_population', scale: 100, time_basis: 'reference_period', expression: 'covered_population / resident_population * 100' };
  }
  if (type === 'exposure_rate') {
    return { numerator: 'population_or_area_exposed', denominator: 'resident_population_or_area', scale: 100, time_basis: 'reference_period', expression: 'exposed / total * 100' };
  }
  if (type === 'per_capita' || type === 'density') {
    const denominator = type === 'density' ? 'land_area' : 'resident_population';
    return { numerator: 'service_quantity_or_population', denominator, scale: scale ?? (type === 'per_capita' ? 1000 : 1), time_basis: 'reference_period', expression: 'numerator / denominator * scale' };
  }
  if (type === 'count') {
    return { numerator: 'active_units', denominator: null, scale: null, time_basis: 'reference_period', expression: 'count(active_units); derive per-capita rate for comparisons' };
  }
  if (type === 'target_gap') {
    return { numerator: 'max(0, target - observed)', denominator: 'target', scale: 100, time_basis: 'reference_period', expression: 'max(0, target - observed) / target * 100' };
  }
  if (type === 'entropy') {
    return { numerator: 'category_shares', denominator: 'ln(number_of_categories)', scale: 1, time_basis: 'reference_period', expression: '-sum(p_i * ln(p_i)) / ln(n)' };
  }
  if (type === 'travel_rate') {
    return { numerator: 'daily_person_trips', denominator: 'resident_population', scale: 1, time_basis: 'day', expression: 'daily_person_trips / resident_population' };
  }
  if (type === 'ratio' || type === 'rate' || type === 'trend') {
    const expression = value.includes('÷') ? value.split('؛')[0].trim() : 'defined numerator / defined denominator';
    return { numerator: 'defined_numerator', denominator: 'defined_denominator', scale: scale ?? 100, time_basis: value.includes('سال') ? 'year_or_multi_year' : 'reference_period', expression };
  }
  if (type === 'area_per_capita') {
    return { numerator: 'occupied_residential_floor_area', denominator: 'resident_population', scale: 1, time_basis: 'reference_period', expression: 'floor_area / resident_population' };
  }
  if (type === 'categorical_composition') {
    return { numerator: 'category_area_or_building_count', denominator: 'all_eligible_area_or_building_count', scale: 100, time_basis: 'reference_period', expression: 'category share * 100' };
  }
  return { numerator: null, denominator: null, scale: null, time_basis: null, expression: null };
}

function inferSpatialLevel(row: RegistryRow, value: string, type: IndicatorMeasurementType): SpatialLevel {
  if (type === 'network_access' || type === 'network_accessibility_composite') return 'network_block_to_service';
  if (type === 'survey_likert' || type === 'perception_index') return 'household_or_user_sample';
  if (type === 'field_compliance') return 'site_or_segment';
  if (value.includes('قطعه')) return 'parcel';
  if (hasAny(value, ['ساختمان', 'بنا', 'واحد مسکونی'])) return 'building';
  if (value.includes('خانوار')) return 'dwelling_or_household';
  if (value.includes('بلوک')) return 'block';
  if (value.includes('شهر') && !value.includes('محله')) return 'neighborhood_to_city';
  if (row.domain === 'normative' && type === 'composite_index') return 'neighborhood';
  return 'neighborhood';
}

function inferProxyPolicy(row: RegistryRow, value: string, type: IndicatorMeasurementType): ProxyPolicy {
  const organizational = value.includes('درخواست سازمانی');
  const field = value.includes('تولید میدانی');
  const online = value.includes('برخط');
  const allowedSources = online ? ['official_open_data', 'remote_sensing', 'osm_or_open_geodata'] : [];
  if (field && !organizational) {
    return {
      mode: 'forbidden', allowed: false, allowed_sources: [], requires_disclosure: true,
      max_unverified_coverage: 0, fallback: 'missing', rationale: 'A field or survey observation cannot be silently replaced by a geographic proxy.',
    };
  }
  if (organizational) {
    return {
      mode: 'bounded', allowed: true,
      allowed_sources: [...allowedSources, 'municipal_or_provider_official_data'],
      requires_disclosure: true, max_unverified_coverage: 0.8,
      fallback: online ? 'flagged_estimate' : 'missing',
      rationale: 'Only an explicitly labelled, bounded proxy may fill a gap while organizational data is pending; it cannot become verified evidence.',
    };
  }
  if (online) {
    return {
      mode: 'fallback_only', allowed: true, allowed_sources: allowedSources,
      requires_disclosure: true, max_unverified_coverage: 1,
      fallback: 'approved_connector', rationale: 'Use the approved online connector and retain source, date, coverage and checksum.',
    };
  }
  if (type === 'survey_likert' || type === 'field_compliance') {
    return {
      mode: 'forbidden', allowed: false, allowed_sources: [], requires_disclosure: true,
      max_unverified_coverage: 0, fallback: 'missing', rationale: 'Observed or perceived measures require their own collection protocol.',
    };
  }
  return {
    mode: 'none', allowed: false, allowed_sources: [], requires_disclosure: true,
    max_unverified_coverage: 0, fallback: 'missing', rationale: 'No proxy is permitted until a source-specific policy is configured.',
  };
}

function inferNormalization(type: IndicatorMeasurementType, polarity: IndicatorPolarity, ratio: RatioSemantics): SemanticNormalization {
  if (type === 'survey_likert') return { method: 'likert_1_5', score_range: [0, 100], formula: '(mean - 1) / 4 * 100', reference_cohort: 'none' };
  if (type === 'binary_existence') return { method: 'binary', score_range: [0, 100], formula: 'presence * 100', reference_cohort: 'none' };
  if (type === 'entropy') return { method: 'entropy', score_range: [0, 100], formula: 'normalized Shannon entropy * 100', reference_cohort: 'none' };
  if (type === 'target_gap') return { method: 'target_distance', score_range: [0, 100], formula: polarity === 'cost' ? '100 - gap_to_target' : '100 - gap_to_target', reference_cohort: 'standard' };
  if (type === 'per_capita' || type === 'density' || type === 'count' || type === 'travel_rate') return { method: 'per_capita', score_range: [0, 100], formula: ratio.expression ?? 'cohort-normalized rate', reference_cohort: 'city' };
  if (type === 'ratio' || type === 'rate' || type === 'coverage_rate' || type === 'exposure_rate' || type === 'field_compliance') return { method: 'percent_of_total', score_range: [0, 100], formula: ratio.expression ?? 'numerator / denominator * scale', reference_cohort: 'none' };
  if (type === 'composite_index' || type === 'transport_service_index' || type === 'network_accessibility_composite') return { method: 'composite_components', score_range: [0, 100], formula: 'weighted normalized components; retain component scores', reference_cohort: 'standard' };
  if (polarity === 'target') return { method: 'target_distance', score_range: [0, 100], formula: 'distance from approved target band', reference_cohort: 'standard' };
  return { method: 'z_score_cohort', score_range: [0, 100], formula: 'city-cohort robust normalization with polarity applied after normalization', reference_cohort: 'city' };
}

function inferKnownErrors(row: RegistryRow, value: string, type: IndicatorMeasurementType, ratio: RatioSemantics): string[] {
  const errors = new Set<string>();
  if (ratio.denominator) {
    errors.add('zero_or_missing_denominator');
    errors.add('numerator_denominator_boundary_mismatch');
    errors.add('temporal_reference_mismatch');
  }
  if (type === 'network_access' || type === 'distance') {
    errors.add('network_vs_euclidean_distance');
    errors.add('service_threshold_or_destination_class_not_defined');
    errors.add('edge_effect_at_neighborhood_boundary');
  }
  if (type === 'survey_likert' || type === 'perception_index') {
    errors.add('self_report_and_nonresponse_bias');
    errors.add('sampling_design_effect');
    errors.add('measurement_invariance_across_neighborhoods');
  }
  if (type === 'field_compliance') {
    errors.add('observer_reliability_and_checklist_drift');
    errors.add('seasonal_or_time_of_day_variation');
  }
  if (type === 'spatial_index' || type === 'entropy' || type === 'exposure_rate') {
    errors.add('modifiable_areal_unit_problem');
    errors.add('spatial_autocorrelation');
    errors.add('edge_effect_at_neighborhood_boundary');
  }
  if (type === 'composite_index' || type === 'transport_service_index' || type === 'network_accessibility_composite') {
    errors.add('component_missingness_and_weight_sensitivity');
    errors.add('double_counting_correlated_components');
  }
  if (type === 'count') errors.add('raw_count_is_scale_sensitive');
  if (hasAny(value, ['درصد', 'نرخ', 'سرانه', 'تراکم']) && !ratio.denominator) errors.add('denominator_not_explicit_in_registry_text');
  if (row.direction.includes('آستانه') && !hasAny(value, ['معیار', 'دامنه', 'استاندارد', 'حد'])) errors.add('target_band_not_defined');
  if (row.direction.includes('مستقیم') && hasAny(value, ['کمبود', 'فقدان', 'عدم', 'نازل', 'بی‌سوادی', 'بیکاری', 'آلودگی', 'جرم', 'مرگ'])) errors.add('direction_wording_may_conflict_with_negative_construct');
  return [...errors];
}

function applyOverride(base: IndicatorSemanticContract, override: SemanticOverride | undefined): IndicatorSemanticContract {
  if (!override) return base;
  const ratio = { ...base.ratio, ...(override.ratio ?? {}) };
  const proxy = { ...base.proxy_policy, ...(override.proxy_policy ?? {}) };
  const mergedErrors = [...new Set([...(base.known_errors ?? []), ...(override.known_errors ?? [])])];
  const inference = override.inference ?? base.inference;
  const measurementType = override.measurement_type ?? base.measurement_type;
  const spatialLevel = override.spatial_level ?? base.spatial_level;
  const rawUnit = override.raw_unit ?? base.raw_unit;
  return {
    ...base,
    ...override,
    measurement_type: measurementType,
    measureType: measurementType,
    raw_unit: rawUnit,
    rawUnit,
    numerator: override.numerator === undefined ? base.numerator : override.numerator,
    denominator: override.denominator === undefined ? base.denominator : override.denominator,
    ratio,
    spatial_level: spatialLevel,
    spatialLevel,
    proxy_policy: proxy,
    proxyPolicy: proxy,
    normalization: override.normalization ?? base.normalization,
    known_errors: mergedErrors,
    knownErrors: mergedErrors,
    inference,
  };
}

export function inferIndicatorSemantics(row: RegistryRow): IndicatorSemanticContract {
  const value = text(row);
  const type = inferMeasurementType(row, value);
  const semanticFallback = row.calc_family === 'formula_specific'
    ? inferFormulaSpecificMeasurement(row, value).fallback
    : !['network_access', 'survey_or_assessment', 'field_audit', 'composite', 'per_capita_or_density', 'ratio_rate_or_trend', 'spatial_statistic'].includes(row.calc_family);
  const polarity = semanticFallback ? 'contextual' : directionPolarity(row, value);
  const rawUnit = inferRawUnit(row, type, value);
  const ratio = genericRatio(row, type, value);
  const spatialLevel = inferSpatialLevel(row, value, type);
  const proxyPolicy = inferProxyPolicy(row, value, type);
  const normalization = inferNormalization(type, polarity, ratio);
  const knownErrors = inferKnownErrors(row, value, type, ratio);
  if (semanticFallback) knownErrors.push('semantic_review_required');
  const confidence: 'high' | 'medium' | 'low' = semanticFallback || type === 'unknown' || rawUnit === 'unspecified' ? 'low' : row.mapping_confidence === 'high' ? 'high' : 'medium';
  const base: IndicatorSemanticContract = {
    code: row.code,
    domain: row.domain,
    axis: row.axis,
    indicator: row.indicator,
    template: row.template,
    calc_family: row.calc_family,
    measurement_type: type,
    measureType: type,
    polarity,
    raw_unit: rawUnit,
    rawUnit,
    numerator: ratio.numerator,
    denominator: ratio.denominator,
    ratio,
    spatial_level: spatialLevel,
    spatialLevel,
    proxy_policy: proxyPolicy,
    proxyPolicy,
    normalization,
    known_errors: knownErrors,
    knownErrors,
    source_signals: row.access_mode.split(/[+؛]/).map((part) => part.trim()).filter(Boolean),
    inference: {
      confidence,
      rules: semanticFallback
        ? ['registry_template', 'registry_calc_family', 'semantic_fallback_pending_owner_review']
        : ['registry_template', 'registry_calc_family', 'formula_text', 'direction'],
    },
  };
  return applyOverride(base, SPECIAL_OVERRIDES[row.code]);
}

export function buildIndicatorSemanticContracts(rows: RegistryRow[] = loadRegistry().rows): IndicatorSemanticContract[] {
  return rows.map(inferIndicatorSemantics);
}

function issue(contract: IndicatorSemanticContract, severity: SemanticAuditIssue['severity'], field: string, rule: string, message: string): SemanticAuditIssue {
  return { code: contract.code, severity, field, rule, message };
}

export function auditIndicatorSemantics(
  rows: RegistryRow[] = loadRegistry().rows,
  registryVersion: string | null = null,
): IndicatorSemanticAudit {
  const contracts = buildIndicatorSemanticContracts(rows);
  const issues: SemanticAuditIssue[] = [];
  const codes = new Set<string>();
  for (const contract of contracts) {
    if (codes.has(contract.code)) issues.push(issue(contract, 'error', 'code', 'unique_code', 'duplicate indicator code'));
    codes.add(contract.code);
    if (!contract.code || !contract.measurement_type || contract.measurement_type === 'unknown') issues.push(issue(contract, 'error', 'measurement_type', 'known_measurement_type', 'measurement type could not be inferred'));
    if (!contract.polarity) issues.push(issue(contract, 'error', 'polarity', 'polarity_required', 'polarity is required'));
    if (!contract.raw_unit || contract.raw_unit === 'unspecified') issues.push(issue(contract, 'warning', 'raw_unit', 'unit_disclosure', 'raw unit is not explicit in the registry; connector must supply it'));
    if (!contract.spatial_level || contract.spatial_level === 'unknown') issues.push(issue(contract, 'warning', 'spatial_level', 'spatial_level_required', 'spatial aggregation level is not explicit'));
    if (!contract.proxy_policy || !contract.proxy_policy.fallback) issues.push(issue(contract, 'error', 'proxy_policy', 'proxy_policy_required', 'proxy policy is missing'));
    if (!contract.known_errors.length) issues.push(issue(contract, 'warning', 'known_errors', 'error_register_required', 'no known-error register supplied'));
    if (contract.known_errors.includes('semantic_review_required')) issues.push(issue(contract, 'warning', 'measurement_type', 'semantic_review_required', 'conservative composite fallback requires method-owner review before verified use'));
    if (['ratio', 'rate', 'trend', 'coverage_rate', 'exposure_rate', 'per_capita', 'density', 'travel_rate', 'field_compliance'].includes(contract.measurement_type) && !contract.numerator) {
      issues.push(issue(contract, 'error', 'numerator', 'ratio_operands_required', 'ratio-like measure has no numerator'));
    }
    if (['ratio', 'rate', 'trend', 'coverage_rate', 'exposure_rate', 'per_capita', 'density', 'travel_rate', 'field_compliance'].includes(contract.measurement_type) && !contract.denominator) {
      issues.push(issue(contract, 'warning', 'denominator', 'ratio_denominator_required', 'ratio-like measure has no denominator; confirm that it is intentionally a count'));
    }
  }
  if (contracts.length !== EXPECTED_INDICATOR_COUNT) {
    const pseudo = contracts[0] ?? ({ code: 'REGISTRY' } as IndicatorSemanticContract);
    issues.push(issue(pseudo, 'error', 'registry', 'approved_registry_size', `expected ${EXPECTED_INDICATOR_COUNT} rows, found ${contracts.length}`));
  }
  const prefixes: Record<string, number> = { PHY: 177, BEH: 209, NOR: 33 };
  for (const [prefix, expected] of Object.entries(prefixes)) {
    const actual = contracts.filter((contract) => contract.code.startsWith(`${prefix}-`)).length;
    if (actual !== expected) {
      const pseudo = contracts[0] ?? ({ code: 'REGISTRY' } as IndicatorSemanticContract);
      issues.push(issue(pseudo, 'error', 'registry', 'approved_domain_counts', `${prefix} expected ${expected}, found ${actual}`));
    }
  }
  const byMeasurement: Record<string, number> = {};
  const byPolarity: Record<IndicatorPolarity, number> = { benefit: 0, cost: 0, target: 0, contextual: 0 };
  const bySpatial: Record<string, number> = {};
  for (const contract of contracts) {
    byMeasurement[contract.measurement_type] = (byMeasurement[contract.measurement_type] ?? 0) + 1;
    byPolarity[contract.polarity] += 1;
    bySpatial[contract.spatial_level] = (bySpatial[contract.spatial_level] ?? 0) + 1;
  }
  const errorCount = issues.filter((item) => item.severity === 'error').length;
  const warningCount = issues.length - errorCount;
  const validCount = contracts.filter((contract) => contract.measurement_type !== 'unknown' && Boolean(contract.raw_unit) && Boolean(contract.spatial_level)).length;
  return {
    schema_version: SEMANTIC_SCHEMA_VERSION,
    registry_version: registryVersion,
    expected_count: EXPECTED_INDICATOR_COUNT,
    actual_count: contracts.length,
    audited_count: contracts.length,
    valid_count: validCount,
    error_count: errorCount,
    warning_count: warningCount,
    ok: errorCount === 0,
    coverage: EXPECTED_INDICATOR_COUNT > 0 ? contracts.length / EXPECTED_INDICATOR_COUNT : 0,
    issues,
    contracts,
    by_measurement_type: byMeasurement,
    by_polarity: byPolarity,
    by_spatial_level: bySpatial,
  };
}

export function getIndicatorSemantic(code: string, rows: RegistryRow[] = loadRegistry().rows): IndicatorSemanticContract | undefined {
  const row = rows.find((candidate) => candidate.code === code);
  return row ? inferIndicatorSemantics(row) : undefined;
}

export function assertIndicatorSemanticAudit(audit: IndicatorSemanticAudit): void {
  if (!audit.ok) {
    const details = audit.issues.filter((item) => item.severity === 'error').slice(0, 8).map((item) => `${item.code}:${item.rule}`).join(', ');
    throw new Error(`Indicator semantic audit failed (${audit.error_count} errors): ${details}`);
  }
}
