import type { Geometry } from 'geojson';

export type SettlementType = 'urban' | 'rural';
export type RunPurpose = 'baseline' | 'monitoring' | 'intervention_priority';

export type RunStatus =
  | 'CREATED'
  | 'LOCATION_AMBIGUOUS'
  | 'BOUNDARY_CONFIRMED'
  | 'COLLECTING'
  | 'WAITING_FOR_RESTRICTED_DATA'
  | 'COMPUTING'
  | 'QA_REVIEW'
  | 'PROVISIONAL'
  | 'VERIFIED'
  | 'REJECTED';

export type IndicatorStatus =
  | 'PLANNED'
  | 'DOWNLOADING_PUBLIC_DATA'
  | 'WAITING_FOR_ORGANIZATIONAL_DATA'
  | 'WAITING_FOR_SURVEY'
  | 'WAITING_FOR_FIELD_AUDIT'
  | 'COMPUTABLE'
  | 'COMPUTED'
  | 'FAILED_QA'
  | 'NOT_AVAILABLE'
  | 'APPROVED';

export interface TypologyRequest {
  neighborhood_name: string;
  city_or_county?: string;
  province?: string;
  settlement_type: SettlementType;
  reference_year: number;
  optional_boundary_geojson?: Geometry | null;
  purpose: RunPurpose;
  selected_location?: LocationSearchResult | null;
  official_context?: {
    hazardDesignation?: boolean;
    historicDesignation?: boolean;
    informalDesignation?: boolean;
    physicalInefficiencyDesignation?: boolean;
    designationSources?: Partial<Record<'hazard' | 'historic' | 'informal' | 'physical', string[]>>;
  };
}

export interface LocationSearchResult {
  candidate_id: string;
  canonical_name: string;
  alternative_names: string[];
  province: string;
  province_id?: string;
  city_or_county: string;
  settlement_type: SettlementType | string;
  confidence: number;
  source: string;
  center: { lat: number; lng: number };
  boundary_available: boolean;
  boundary_geojson?: Geometry | null;
  boundary_quality?: 'authoritative' | 'confirmed_osm' | 'provisional';
  administrative_id?: string;
  match_reason: string;
}

export interface RegistryRow {
  code: string;
  domain: string;
  domain_fa: string;
  axis: string;
  source_order: string;
  indicator: string;
  coefficient: string;
  coefficient_label: string;
  direction: string;
  category_weight_percent: string;
  domain_weight_percent: string;
  driver_id: string;
  mapping_confidence: string;
  template: string;
  calc_family: string;
  access_mode: string;
  playbook_codes: string;
  source_requirements: string;
  formula_text: string;
  registry_status: string;
  [key: string]: string;
}

export interface Candidate {
  id: string;
  candidate_id?: string;
  name: string;
  canonical_name?: string;
  province: string;
  city_or_county: string;
  settlement_type: SettlementType;
  hierarchy: {
    province_code?: string;
    county_code?: string;
    district_code?: string;
    locality_code?: string;
  };
  center: { lat: number; lon: number } | null;
  confidence: number;
  requires_confirmation: true;
  boundary_available: boolean;
  boundary_geojson?: Geometry | null;
  sources: Array<{ type: string; id: string }>;
  source?: string;
  notes: string[];
}

export type BoundarySource =
  | 'municipal'
  | 'census_block'
  | 'planning'
  | 'participatory'
  | 'osm_temporary'
  | 'user_supplied';

export interface BoundaryRecord {
  geojson: Geometry;
  source: BoundarySource;
  source_id?: string;
  version: string;
  crs?: string;
  area_km2?: number;
  approved_at?: string;
  confidence: number;
  area_change_percent?: number;
  validation: {
    structurally_valid: boolean;
    topology_valid?: boolean;
    polygon_count?: number;
    position_count?: number;
    warnings: string[];
  };
}

export interface IndicatorTask {
  code: string;
  domain: string;
  axis: string;
  indicator: string;
  driver_id: string;
  coefficient: number;
  domain_weight_percent: number;
  direction: string;
  calc_family: string;
  access_mode: string;
  playbooks: string[];
  source_requirements: string;
  formula_text: string;
  formula_version: string;
  mapping_confidence: string;
  status: IndicatorStatus;
  next_action: string;
  missing_reason?: string;
  measurement_ids: string[];
}

export interface EvidenceSource {
  organization?: string;
  url?: string;
  device?: string;
  dataset_id?: string;
  version?: string;
  retrieved_at?: string;
  license?: string;
  checksum?: string;
  coverage?: number;
  source_tier?: 'official_authoritative' | 'official_derived' | 'open_verified' | 'field_verified' | 'survey_verified' | 'proxy' | 'unknown';
  geography_level?: 'parcel' | 'building' | 'block' | 'neighborhood' | 'district' | 'city' | 'province' | 'national' | string;
  data_vintage?: string;
}

export interface MeasurementQuality {
  spatial_coverage?: number;
  temporal_coverage?: number;
  score?: number;
  source_reliability?: number;
  method_validity?: number;
  validation_score?: number;
  flags: string[];
}

export interface MeasurementRecord {
  id: string;
  indicator_code: string;
  neighborhood_id: string;
  raw_value: number | string | null;
  cleaned_value: number | string | null;
  unit?: string;
  numerator?: number | null;
  denominator?: number | null;
  reference_date?: string;
  geography?: string;
  source: EvidenceSource;
  method: {
    formula_version: string;
    code_commit?: string;
  };
  quality: MeasurementQuality;
  score_1_5: number | null;
  /** Absolute score against an approved standard, and relative score against a versioned cohort. */
  score_absolute_0_1?: number | null;
  score_relative_0_1?: number | null;
  reference_cohort_id?: string;
  boundary_version?: string;
  uncertainty: Record<string, unknown> | null;
  status: 'measured' | 'validated' | 'missing' | 'suppressed' | 'not_recorded';
  missing_reason?: string;
  next_action?: string;
  created_at: string;
  superseded_by?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  from_status?: RunStatus;
  to_status?: RunStatus;
  details?: Record<string, unknown>;
}

/**
 * A durable receipt for an idempotent evidence upload.  The payload
 * fingerprint prevents accidentally reusing a key for a different batch,
 * while the record ids let the API replay the original response safely.
 */
export interface EvidenceIdempotencyRecord {
  fingerprint: string;
  record_ids: string[];
  accepted_at: string;
}

export interface ScoreResult {
  domain_scores: Record<string, number | null>;
  domain_labels: Record<string, string | null>;
  domain_labels_fa: Record<string, string | null>;
  weighted_coverage: Record<string, number>;
  driver_scores: Record<string, number | null>;
  driver_coverage: Record<string, number>;
  SI: number | null;
  scenario: {
    pattern: string;
    code: string;
    label: string;
    label_fa: string;
    requires_review: boolean;
    rationale: string;
  } | null;
  invalid_measurements: Array<{ code: string; reason: string }>;
  confidence: Record<string, number | null>;
  label_stability: number | null;
  status: 'provisional' | 'certified';
  computed_at: string;
}

export interface TypologyRun {
  run_id: string;
  created_at: string;
  updated_at: string;
  registry_version: string;
  code_version: string;
  status: RunStatus;
  publication_level: 'EXPLORATORY' | 'PROVISIONAL' | 'VERIFIED' | 'REJECTED';
  request: TypologyRequest;
  candidates: Candidate[];
  selected_candidate_id?: string;
  boundary?: BoundaryRecord;
  reference_cohort_id?: string;
  tasks: IndicatorTask[];
  measurements: MeasurementRecord[];
  evidence_idempotency?: Record<string, EvidenceIdempotencyRecord>;
  score?: ScoreResult;
  dual_layer_typology?: import('./typologyDualLayer').DualLayerTypologyResult;
  missing: Array<{
    indicator_code: string;
    status: IndicatorStatus | 'MISSING';
    reason: string;
    next_action: string;
  }>;
  audit: AuditEvent[];
  reviewer?: { id: string; name?: string; decision: 'approve' | 'reject'; reason?: string; at: string };
}

export interface TypologyStore {
  create(run: TypologyRun): Promise<void>;
  get(runId: string): Promise<TypologyRun | null>;
  update(run: TypologyRun): Promise<void>;
  list(): Promise<TypologyRun[]>;
}
