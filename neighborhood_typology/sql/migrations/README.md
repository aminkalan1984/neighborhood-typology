# Migration policy

Run `001_harden_typology.sql` and then `002_rls_audit.sql` with a PostgreSQL/PostGIS migration runner. Each file is transactional and records its version in `schema_migration`; a runner must execute a version only when it is not already present.

The application must set `SET LOCAL app.actor_id = '...'` and `SET LOCAL app.actor_role = 'viewer|analyst|reviewer|admin'` for every transaction. Database roles used by the API should not have `BYPASSRLS`. A separate controlled migration role may own the tables and apply schema changes.

Certification is deliberately constrained at the database boundary: a verified result requires an approval identity, approval time, label stability, valid score ranges, and evidence-linked active measurements. The API still performs semantic and GIS checks before writing.
