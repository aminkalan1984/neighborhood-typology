import type { DecisionCard } from './types';

export type DecisionEvidenceStatus = 'evidence_only' | 'measured' | 'validated' | 'missing' | 'suppressed' | 'not_recorded';
export type DecisionPublicationLevel =
  | 'EVIDENCE_ONLY'
  | 'PROVISIONAL_PUBLIC'
  | 'PROVISIONAL_REVIEW'
  | 'VERIFIED_OPEN_EO'
  | 'VERIFIED_CONTRACT'
  | 'VALIDATED';

export interface DecisionEvidenceSource {
  id: string;
  name: string;
  url?: string;
  datasetId?: string;
  license?: string;
  retrievedAt: string;
  dataVintage?: string;
  tier: 'official_authoritative' | 'official_derived' | 'open_verified' | 'field_verified' | 'survey_verified' | 'proxy' | 'unknown';
  geographyLevel: 'point' | 'buffer' | 'block' | 'neighborhood' | 'district' | 'city' | 'province' | 'national' | string;
  checksum?: string;
}

export interface DecisionEvidenceQuality {
  score: number;
  spatialCoverage?: number;
  temporalCoverage?: number;
  sourceReliability?: number;
  methodValidity?: number;
  validationScore?: number;
  flags: string[];
}

export interface DecisionEvidenceObservation {
  id: string;
  evidenceCode: string;
  label: string;
  indicatorCode?: string | null;
  relatedIndicatorCodes: string[];
  rawValue: number | string | null;
  normalizedScore?: number | null;
  unit?: string;
  numerator?: number | null;
  denominator?: number | null;
  observedAt?: string;
  boundaryVersion?: string;
  source: DecisionEvidenceSource;
  method: {
    name: string;
    formulaVersion: string;
    registryVersion?: string;
  };
  quality: DecisionEvidenceQuality;
  uncertainty?: Record<string, unknown> | null;
  status: DecisionEvidenceStatus;
  publicationLevel: DecisionPublicationLevel;
  scoreEligible?: boolean;
  missingReason?: string;
  nextAction?: string;
}

export interface DecisionIndicatorCoverage {
  total: number;
  evidenceRelated: number;
  measured: number;
  scoreEligible: number;
  evidenceCoverage: number;
  scoreCoverage: number;
}

export interface DecisionCapitalCoverage extends DecisionIndicatorCoverage {
  capital: string;
  label: string;
}

export interface DecisionEvidenceCoverage {
  registryTotal: number;
  core: DecisionIndicatorCoverage;
  all: DecisionIndicatorCoverage;
  byCapital: DecisionCapitalCoverage[];
  publishable: boolean;
  gateFailures: string[];
}

export interface DecisionMissingIndicator {
  code: string;
  name: string;
  engine: string;
  family: string;
  phase: string;
  allowedOutput: string;
  reason: string;
  nextAction: string;
}

export interface DecisionEvidenceAssessment {
  analysisId: string;
  neighborhoodName: string;
  assessedAt: string;
  status: 'EVIDENCE_ONLY' | 'INSUFFICIENT_COVERAGE' | 'READY_FOR_REVIEW' | 'COMPLETED';
  publicationLevel: DecisionPublicationLevel;
  registry: {
    version: string;
    indicatorCount: number;
    coreIndicatorCount: number;
    sourceFile: string;
  };
  coverage: DecisionEvidenceCoverage;
  evidenceLedger: DecisionEvidenceObservation[];
  missingIndicators: DecisionMissingIndicator[];
  warnings: string[];
  card: DecisionCard | null;
  honestyBoundary: {
    aiNumericGenerationAllowed: false;
    missingValuesAreZero: false;
    nationalProxyScoresNeighborhood: false;
    satelliteIndexEqualsLandCoverShare: false;
  };
}

export interface DecisionEvidenceAssessmentRequest {
  neighborhoodName: string;
  cityOrCounty?: string;
  province?: string;
  purpose?: 'baseline' | 'monitoring' | 'intervention_priority';
  boundary?: {
    geometry?: unknown;
    bbox?: [number, number, number, number];
    version?: string;
    source?: string;
    confidence?: number;
  };
  observations: DecisionEvidenceObservation[];
  groupValues?: Record<string, Record<string, number>>;
}
