CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE neighborhood (
 id uuid PRIMARY KEY, canonical_name text NOT NULL, province text NOT NULL,
 city_or_county text NOT NULL, settlement_type text NOT NULL,
 boundary geometry(MultiPolygon,4326) NOT NULL, boundary_source text NOT NULL,
 boundary_version text NOT NULL, boundary_confidence numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE analysis_run (
 id uuid PRIMARY KEY, neighborhood_id uuid REFERENCES neighborhood(id),
 reference_date date NOT NULL, registry_version text NOT NULL,
 status text NOT NULL, requested_by text, created_at timestamptz DEFAULT now()
);
CREATE TABLE evidence (
 id uuid PRIMARY KEY, run_id uuid REFERENCES analysis_run(id), indicator_code text NOT NULL,
 source_url text, source_org text, dataset_id text, source_version text,
 retrieved_at timestamptz, license text, checksum text, raw_object_uri text,
 spatial_coverage numeric, temporal_coverage numeric, quality_score numeric,
 access_mode text, privacy_class text, review_status text NOT NULL
);
CREATE TABLE indicator_measurement (
 run_id uuid REFERENCES analysis_run(id), indicator_code text NOT NULL,
 value numeric, unit text, numerator numeric, denominator numeric,
 score_1_5 numeric, uncertainty_low numeric, uncertainty_high numeric,
 formula_version text, reference_date date, evidence_id uuid REFERENCES evidence(id),
 status text NOT NULL, PRIMARY KEY(run_id,indicator_code,evidence_id)
);
CREATE TABLE typology_result (
 run_id uuid PRIMARY KEY REFERENCES analysis_run(id), p_score numeric, b_score numeric,
 n_score numeric, sustainability_index numeric, physical_type text,
 behavioral_type text, normative_type text, scenario text,
 weighted_coverage jsonb, label_stability numeric, certification_status text,
 approved_by text, approved_at timestamptz
);
