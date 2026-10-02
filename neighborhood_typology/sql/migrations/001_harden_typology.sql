-- Neighborhood typology database hardening.
-- PostgreSQL 14+ / PostGIS 3+. Execute through a migration runner in one transaction.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migration (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE typology_run_status AS ENUM (
    'CREATED', 'LOCATION_AMBIGUOUS', 'BOUNDARY_CONFIRMED', 'COLLECTING',
    'WAITING_FOR_RESTRICTED_DATA', 'COMPUTING', 'QA_REVIEW', 'PROVISIONAL',
    'VERIFIED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE typology_publication_level AS ENUM ('EXPLORATORY', 'PROVISIONAL', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS neighborhood (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL CHECK (length(btrim(canonical_name)) BETWEEN 1 AND 200),
  province text NOT NULL CHECK (length(btrim(province)) BETWEEN 1 AND 120),
  city_or_county text NOT NULL CHECK (length(btrim(city_or_county)) BETWEEN 1 AND 120),
  settlement_type text NOT NULL CHECK (settlement_type IN ('urban', 'rural')),
  boundary geometry(MultiPolygon, 4326) NOT NULL,
  boundary_source text NOT NULL CHECK (boundary_source IN ('municipal', 'census_block', 'planning', 'participatory', 'user_supplied', 'osm_temporary')),
  boundary_version text NOT NULL CHECK (length(btrim(boundary_version)) BETWEEN 1 AND 120),
  boundary_confidence numeric(5,4) NOT NULL CHECK (boundary_confidence BETWEEN 0 AND 1),
  boundary_sha256 text NOT NULL CHECK (boundary_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_SRID(boundary) = 4326),
  CHECK (NOT ST_IsEmpty(boundary)),
  CHECK (ST_IsValid(boundary))
);

CREATE INDEX IF NOT EXISTS neighborhood_boundary_gix ON neighborhood USING gist (boundary);
CREATE INDEX IF NOT EXISTS neighborhood_admin_idx ON neighborhood (province, city_or_county, settlement_type);

CREATE TABLE IF NOT EXISTS analysis_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id uuid NOT NULL REFERENCES neighborhood(id) ON DELETE RESTRICT,
  reference_date date NOT NULL,
  registry_version text NOT NULL CHECK (length(btrim(registry_version)) BETWEEN 1 AND 200),
  code_version text NOT NULL DEFAULT 'unknown',
  status typology_run_status NOT NULL DEFAULT 'CREATED',
  publication_level typology_publication_level NOT NULL DEFAULT 'EXPLORATORY',
  requested_by text NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (id, neighborhood_id)
);

CREATE INDEX IF NOT EXISTS analysis_run_status_idx ON analysis_run (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS analysis_run_neighborhood_idx ON analysis_run (neighborhood_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES analysis_run(id) ON DELETE CASCADE,
  indicator_code text NOT NULL CHECK (length(btrim(indicator_code)) BETWEEN 1 AND 64),
  source_url text,
  source_org text,
  dataset_id text,
  source_version text,
  retrieved_at timestamptz,
  license text,
  checksum text CHECK (checksum IS NULL OR checksum ~ '^[A-Za-z0-9:_-]{8,256}$'),
  raw_object_uri text,
  spatial_coverage numeric(6,5) CHECK (spatial_coverage IS NULL OR spatial_coverage BETWEEN 0 AND 1),
  temporal_coverage numeric(6,5) CHECK (temporal_coverage IS NULL OR temporal_coverage BETWEEN 0 AND 1),
  quality_score numeric(6,5) CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 1),
  access_mode text,
  privacy_class text,
  review_status text NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED')),
  evidence_sha256 text CHECK (evidence_sha256 IS NULL OR evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, run_id, indicator_code),
  CHECK (
    review_status IN ('PENDING', 'REJECTED') OR
    (dataset_id IS NOT NULL AND source_version IS NOT NULL AND retrieved_at IS NOT NULL AND license IS NOT NULL AND checksum IS NOT NULL AND (source_url IS NOT NULL OR source_org IS NOT NULL))
  )
);

CREATE INDEX IF NOT EXISTS evidence_run_indicator_idx ON evidence (run_id, indicator_code, created_at DESC);
CREATE INDEX IF NOT EXISTS evidence_review_idx ON evidence (review_status, created_at DESC);

CREATE TABLE IF NOT EXISTS indicator_measurement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES analysis_run(id) ON DELETE CASCADE,
  indicator_code text NOT NULL CHECK (length(btrim(indicator_code)) BETWEEN 1 AND 64),
  value numeric,
  unit text,
  numerator numeric,
  denominator numeric CHECK (denominator IS NULL OR denominator <> 0),
  score_1_5 numeric CHECK (score_1_5 IS NULL OR score_1_5 BETWEEN 1 AND 5),
  uncertainty_low numeric CHECK (uncertainty_low IS NULL OR uncertainty_low BETWEEN 1 AND 5),
  uncertainty_high numeric CHECK (uncertainty_high IS NULL OR uncertainty_high BETWEEN 1 AND 5),
  formula_version text,
  reference_date date,
  evidence_id uuid,
  status text NOT NULL CHECK (status IN ('MEASURED', 'VALIDATED', 'COMPUTED', 'APPROVED', 'MISSING', 'WAITING_FOR_ORGANIZATIONAL_DATA', 'WAITING_FOR_SURVEY', 'WAITING_FOR_FIELD_AUDIT', 'NOT_AVAILABLE', 'FAILED_QA')),
  superseded_at timestamptz,
  superseded_by uuid REFERENCES indicator_measurement(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (evidence_id, run_id, indicator_code) REFERENCES evidence(id, run_id, indicator_code) ON DELETE RESTRICT,
  CHECK (status IN ('MISSING', 'NOT_AVAILABLE', 'FAILED_QA') OR (score_1_5 IS NOT NULL AND formula_version IS NOT NULL AND evidence_id IS NOT NULL)),
  CHECK (superseded_at IS NULL OR superseded_by IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS measurement_one_active_per_indicator
  ON indicator_measurement (run_id, indicator_code)
  WHERE superseded_at IS NULL AND status NOT IN ('MISSING', 'NOT_AVAILABLE', 'FAILED_QA');
CREATE INDEX IF NOT EXISTS measurement_run_status_idx ON indicator_measurement (run_id, status, indicator_code);
CREATE INDEX IF NOT EXISTS measurement_evidence_idx ON indicator_measurement (evidence_id);

CREATE TABLE IF NOT EXISTS typology_result (
  run_id uuid PRIMARY KEY REFERENCES analysis_run(id) ON DELETE CASCADE,
  p_score numeric CHECK (p_score IS NULL OR p_score BETWEEN 1 AND 5),
  b_score numeric CHECK (b_score IS NULL OR b_score BETWEEN 1 AND 5),
  n_score numeric CHECK (n_score IS NULL OR n_score BETWEEN 1 AND 5),
  sustainability_index numeric CHECK (sustainability_index IS NULL OR sustainability_index BETWEEN 1 AND 5),
  physical_type text,
  behavioral_type text,
  normative_type text,
  scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
  weighted_coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  label_stability numeric CHECK (label_stability IS NULL OR label_stability BETWEEN 0 AND 1),
  certification_status typology_publication_level NOT NULL DEFAULT 'EXPLORATORY',
  verification_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_by text,
  approved_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(scenario) = 'object'),
  CHECK (jsonb_typeof(weighted_coverage) = 'object'),
  CHECK (jsonb_typeof(verification_failures) = 'array'),
  CHECK (certification_status <> 'VERIFIED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND label_stability >= 0.8))
);

INSERT INTO schema_migration(version, name) VALUES (1, 'harden_typology') ON CONFLICT (version) DO NOTHING;
COMMIT;
