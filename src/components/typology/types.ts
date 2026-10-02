export type SettlementType = 'urban' | 'rural';

export type TypologyPurpose = 'baseline' | 'monitoring' | 'intervention_priority';

export type TypologyRunStatus =
  | 'CREATED'
  | 'LOCATION_AMBIGUOUS'
  | 'WAITING_FOR_LOCATION_RESOLUTION'
  | 'BOUNDARY_CONFIRMED'
  | 'COLLECTING'
  | 'WAITING_FOR_RESTRICTED_DATA'
  | 'COMPUTING'
  | 'QA_REVIEW'
  | 'EXPLORATORY'
  | 'PROVISIONAL'
  | 'VERIFIED'
  | 'REJECTED'
  | string;

export interface CreateTypologyRunRequest {
  neighborhood_name: string;
  city_or_county: string;
  province: string;
  settlement_type: SettlementType;
  reference_year: number;
  optional_boundary_geojson: Record<string, unknown> | null;
  purpose: TypologyPurpose;
  selected_location?: LocationSearchResult | null;
}

export interface TypologyRunSummary {
  run_id: string;
  status: TypologyRunStatus;
  created_at?: string;
  updated_at?: string;
  registry?: {
    version?: string;
    indicator_count?: number;
  };
  request?: Partial<CreateTypologyRunRequest>;
  coverage?: Partial<CoverageSummary>;
  boundary?: BoundarySummary | null;
  candidate_count?: number;
}

export interface LocationCandidate {
  candidate_id: string;
  canonical_name: string;
  alternative_names?: string[];
  province: string;
  province_id?: string;
  city_or_county: string;
  settlement_type?: SettlementType | string;
  confidence: number;
  source: string;
  center?: { lat: number; lng: number } | [number, number] | null;
  boundary_available?: boolean;
  boundary_geojson?: Record<string, unknown> | null;
  boundary_quality?: 'authoritative' | 'confirmed_osm' | 'provisional';
  municipality_region?: number;
  municipality_region_name?: string;
  district_name?: string;
  area_km2?: number | null;
  perimeter_km?: number | null;
  source_detail?: string;
  data_quality_note?: string;
  tentative_match?: boolean;
  administrative_id?: string;
  match_reason?: string;
}

export interface NeighborhoodBoundaryFeature {
  type: 'Feature';
  geometry: Record<string, unknown>;
  properties: LocationSearchResult;
}

export interface LocationSearchResult extends LocationCandidate {
  match_reason: string;
}

export interface BoundarySummary {
  boundary_id?: string;
  candidate_id?: string;
  source?: string;
  version?: string;
  confidence?: number | null;
  crs?: string;
  area_km2?: number | null;
  approved_at?: string;
  geojson?: Record<string, unknown> | null;
}

export interface CoverageSummary {
  total: number;
  computed: number;
  approved: number;
  missing: number;
  failed_qa: number;
  waiting_public: number;
  waiting_organizational: number;
  waiting_survey: number;
  waiting_field: number;
  weighted?: number | null;
}

export type DomainKey = 'physical' | 'behavioral' | 'normative';

export interface DomainResult {
  key: DomainKey;
  score: number | null;
  label: string;
  coverage: number | null;
  confidence: number | null;
}

export interface DriverResult {
  code: string;
  title: string;
  domain: DomainKey;
  score: number | null;
  coverage: number | null;
  confidence?: number | null;
}

export interface IndicatorResultRow {
  code: string;
  indicator: string;
  domain: DomainKey | string;
  driver_id?: string;
  raw_value?: number | string | null;
  unit?: string | null;
  score?: number | null;
  coverage?: number | null;
  confidence?: number | null;
  status: string;
  flags?: string[];
  evidence_ids?: string[];
  reference_date?: string | null;
}

export interface EvidenceRow {
  evidence_id: string;
  indicator_code?: string;
  organization?: string;
  dataset_id?: string;
  version?: string;
  retrieved_at?: string;
  license?: string;
  checksum?: string;
  coverage?: number | null;
  quality_score?: number | null;
  url?: string;
  status?: string;
}

export interface MissingDataRow {
  indicator_code: string;
  indicator?: string;
  reason: string;
  status: string;
  access_mode?: string;
  next_action: string;
  owner?: string;
}

export interface VerificationGates {
  eligible: boolean;
  failures: string[];
}

export interface TypologyAuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  from_status?: string;
  to_status?: string;
  details?: Record<string, unknown>;
}

export interface TypologyReviewer {
  id?: string;
  name?: string;
  decision?: 'approve' | 'reject' | string;
  reason?: string;
  at?: string;
}

export interface TypologyReport {
  run_id: string;
  status: TypologyRunStatus;
  publication_level: 'EXPLORATORY' | 'PROVISIONAL' | 'VERIFIED' | 'REJECTED' | string;
  registry_version?: string;
  code_version?: string;
  reference_year?: number;
  created_at?: string;
  updated_at?: string;
  location: {
    neighborhood_id?: string;
    official_name: string;
    alternative_names?: string[];
    province: string;
    province_id?: string;
    city_or_county: string;
    settlement_type?: string;
  };
  boundary: BoundarySummary | null;
  coverage: CoverageSummary;
  domains: Record<DomainKey, DomainResult>;
  si: number | null;
  label_stability: number | null;
  scenario: {
    pattern?: string;
    label: string;
    explanation?: string;
    requires_review: boolean;
  };
  drivers: DriverResult[];
  indicators: IndicatorResultRow[];
  evidence: EvidenceRow[];
  missing_data: MissingDataRow[];
  verification_gates: VerificationGates;
  audit_events: TypologyAuditEvent[];
  positive_factors?: string[];
  bottlenecks?: string[];
  reviewer?: TypologyReviewer | null;

  /**
   * Optional dual-layer output.  The legacy report contract remains valid;
   * consumers can progressively adopt this richer, multi-label view.
   */
  dual_layer_typology?: DualLayerTypologySummary | null;
  /** camelCase alias accepted while older clients migrate. */
  dualLayerTypology?: DualLayerTypologySummary | null;
  /** Optional top-level aliases used by early API clients. */
  official_typologies?: OfficialTypologyMembership[];
  analytical_profile?: AnalyticalTypologyProfile | null;
  fuzzy_memberships?: FuzzyTypologyMembership[];
}

/** A formal Iranian typology label. Labels are intentionally multi-valued. */
export interface OfficialTypologyMembership {
  code: string;
  label?: string;
  label_fa?: string;
  eligible?: boolean;
  reason?: string;
  intervention?: string;
  membership?: number | null;
  confidence?: number | null;
  score?: number | null;
  selected?: boolean;
  priority?: number | null;
  overlap?: boolean;
  evidence_count?: number;
  evidenceCount?: number;
  rationale?: string;
  source?: string;
}

export type TypologyBand = 'low' | 'medium' | 'high' | 'critical' | 'transitional' | string;

export interface TypologyUncertaintySummary {
  low?: number | null;
  high?: number | null;
  width?: number | null;
  label_stability?: number | null;
  labelStability?: number | null;
  samples?: number | null;
  method?: string | null;
}

/** Quality metadata is kept separate from the substantive score. */
export interface TypologyCoverageQualitySummary {
  coverage?: number | null;
  quality?: number | null;
  confidence?: number | null;
  total?: number | null;
  computed?: number | null;
  weighted?: number | null;
  source?: string | null;
}

export interface AnalyticalDomainProfile {
  key: DomainKey;
  label?: string;
  score?: number | null;
  normalized_score?: number | null;
  normalizedScore?: number | null;
  band?: TypologyBand | null;
  coverage?: number | null;
  quality?: number | null;
  confidence?: number | null;
  uncertainty?: TypologyUncertaintySummary | null;
}

/** Continuous P/B/N profile used alongside the formal rule labels. */
export interface AnalyticalTypologyProfile {
  P?: number | null;
  B?: number | null;
  N?: number | null;
  SI?: number | null;
  physical?: number | AnalyticalDomainProfile | null;
  behavioral?: number | AnalyticalDomainProfile | null;
  normative?: number | AnalyticalDomainProfile | null;
  domains?: Partial<Record<DomainKey, AnalyticalDomainProfile | null>>;
  si?: number | null;
  label?: string | null;
  scenario?: string | null;
  dominant_domain?: string | null;
}

export interface FuzzyTypologyMembership {
  code: string;
  label?: string;
  label_fa?: string;
  membership: number | null;
  confidence?: number | null;
  domain?: DomainKey | string;
  description?: string;
  source?: string;
}

/**
 * Rich result for the independent dual-layer summary component. Snake_case
 * fields mirror persisted JSON; camelCase aliases are backward-compatible.
 */
export interface DualLayerTypologySummary {
  official_labels?: OfficialTypologyMembership[];
  officialLabels?: OfficialTypologyMembership[];
  analytical_profile?: AnalyticalTypologyProfile | null;
  analyticalProfile?: AnalyticalTypologyProfile | null;
  fuzzy_memberships?: FuzzyTypologyMembership[];
  fuzzyMemberships?: FuzzyTypologyMembership[];
  coverage?: number | Record<string, number> | TypologyCoverageQualitySummary | null;
  quality?: number | null;
  confidence?: number | null;
  uncertainty?: TypologyUncertaintySummary | null;
  provisional?: boolean;
  publication_level?: TypologyRunStatus | string;
  publicationLevel?: TypologyRunStatus | string;
  warnings?: string[];
  generated_at?: string;
  version?: string;
}

export interface TypologyExplanation {
  text: string;
  generated_by: 'ai' | 'deterministic' | 'disabled' | string;
  caveats?: string[];
}

export interface TypologyCatalogIndicatorLink {
  source_tags: string[];
  direct_local_candidate: boolean;
  availability: string;
  candidate_paths: string[];
}

export interface TypologyDataCatalogSummary {
  schema_version: string;
  generated_at: string;
  file_count: number;
  total_bytes: number;
  extension_counts: Record<string, number>;
  theme_counts: Record<string, number>;
  province_count: number;
  indicator_count: number;
  indicator_links: Record<string, TypologyCatalogIndicatorLink>;
}
