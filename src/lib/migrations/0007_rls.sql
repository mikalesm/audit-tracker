-- 0007_rls.sql
-- Row-Level Security as a belt-and-braces backstop behind the application-side
-- `WHERE engagement_id = $N` filtering.
--
-- How it works:
--   * Every domain table gets RLS ENABLED and FORCED. FORCE is required because
--     the application connects as the same Postgres principal that owns the
--     tables (it runs the migrations) — without FORCE, the owner bypasses RLS.
--   * The policy lets a row through only when its engagement_id equals the
--     `app.engagement_id` session variable. Every request sets that variable
--     for the duration of one transaction via withEngagement() in src/lib/db.ts.
--   * When `app.engagement_id` is unset, current_setting(..., true) returns NULL,
--     nullif() keeps it NULL, and `engagement_id = NULL` is NULL (false) — so a
--     query that forgot to establish a scope sees ZERO rows. Fail-closed: a
--     missing scope is a visible bug, never a cross-engagement leak.
--   * `app.bypass_rls = 'on'` is an explicit escape hatch for genuinely
--     cross-engagement work — creating an engagement (which reads a template
--     and writes a new engagement) and platform-admin aggregates. Set by
--     withBypassRls() and by the migration runners. Never set on a request path.
--
-- This migration is pure DDL, so it is unaffected by the RLS it installs.

DO $$
DECLARE
  t TEXT;
  domain_tables TEXT[] := ARRAY[
    'pbc_items', 'access_requests', 'walkthroughs', 'entities', 'sampling_items',
    'evidence_files', 'settings', 'saved_views', 'activity_log', 'access_log'
  ];
BEGIN
  FOREACH t IN ARRAY domain_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS engagement_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY engagement_isolation ON %I
        USING (
          engagement_id = nullif(current_setting('app.engagement_id', true), '')::bigint
          OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
          engagement_id = nullif(current_setting('app.engagement_id', true), '')::bigint
          OR current_setting('app.bypass_rls', true) = 'on'
        )
    $f$, t);
  END LOOP;
END$$;
