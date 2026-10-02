-- Role-aware row security and append-only audit trail.
BEGIN;

CREATE TABLE IF NOT EXISTS typology_audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES analysis_run(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  from_status typology_run_status,
  to_status typology_run_status,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  previous_hash text,
  event_hash text NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (run_id, event_hash)
);

CREATE INDEX IF NOT EXISTS typology_audit_run_time_idx ON typology_audit_event (run_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION typology_actor_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.actor_id', true), '') $$;

CREATE OR REPLACE FUNCTION typology_actor_role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('app.actor_role', true), ''), 'viewer') $$;

CREATE OR REPLACE FUNCTION deny_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'typology_audit_event is append-only';
END $$;

DROP TRIGGER IF EXISTS typology_audit_immutable ON typology_audit_event;
CREATE TRIGGER typology_audit_immutable
  BEFORE UPDATE OR DELETE ON typology_audit_event
  FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

ALTER TABLE neighborhood ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_measurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE typology_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE typology_audit_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS neighborhood_read ON neighborhood;
CREATE POLICY neighborhood_read ON neighborhood FOR SELECT USING (typology_actor_role() IN ('viewer', 'analyst', 'reviewer', 'admin'));
DROP POLICY IF EXISTS neighborhood_write ON neighborhood;
CREATE POLICY neighborhood_write ON neighborhood FOR INSERT, UPDATE WITH CHECK (typology_actor_role() IN ('analyst', 'reviewer', 'admin'));

DROP POLICY IF EXISTS run_read ON analysis_run;
CREATE POLICY run_read ON analysis_run FOR SELECT USING (typology_actor_role() IN ('viewer', 'analyst', 'reviewer', 'admin'));
DROP POLICY IF EXISTS run_write ON analysis_run;
CREATE POLICY run_write ON analysis_run FOR INSERT, UPDATE WITH CHECK (typology_actor_role() IN ('analyst', 'reviewer', 'admin'));

DROP POLICY IF EXISTS evidence_read ON evidence;
CREATE POLICY evidence_read ON evidence FOR SELECT USING (typology_actor_role() IN ('viewer', 'analyst', 'reviewer', 'admin'));
DROP POLICY IF EXISTS evidence_write ON evidence;
CREATE POLICY evidence_write ON evidence FOR INSERT, UPDATE WITH CHECK (typology_actor_role() IN ('analyst', 'reviewer', 'admin'));

DROP POLICY IF EXISTS measurement_read ON indicator_measurement;
CREATE POLICY measurement_read ON indicator_measurement FOR SELECT USING (typology_actor_role() IN ('viewer', 'analyst', 'reviewer', 'admin'));
DROP POLICY IF EXISTS measurement_write ON indicator_measurement;
CREATE POLICY measurement_write ON indicator_measurement FOR INSERT, UPDATE WITH CHECK (typology_actor_role() IN ('analyst', 'reviewer', 'admin'));

DROP POLICY IF EXISTS result_read ON typology_result;
CREATE POLICY result_read ON typology_result FOR SELECT USING (typology_actor_role() IN ('viewer', 'analyst', 'reviewer', 'admin'));
DROP POLICY IF EXISTS result_write ON typology_result;
CREATE POLICY result_write ON typology_result FOR INSERT, UPDATE WITH CHECK (typology_actor_role() IN ('reviewer', 'admin'));

DROP POLICY IF EXISTS audit_read ON typology_audit_event;
CREATE POLICY audit_read ON typology_audit_event FOR SELECT USING (typology_actor_role() IN ('reviewer', 'admin'));
DROP POLICY IF EXISTS audit_append ON typology_audit_event;
CREATE POLICY audit_append ON typology_audit_event FOR INSERT WITH CHECK (typology_actor_id() IS NOT NULL AND actor_id = typology_actor_id());

INSERT INTO schema_migration(version, name) VALUES (2, 'rls_audit') ON CONFLICT (version) DO NOTHING;
COMMIT;
