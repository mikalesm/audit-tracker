-- 0004_multitenant.sql
-- Introduces engagement-scoped multi-tenancy.
--
-- This migration is deliberately ADDITIVE:
--   * New tables: engagements, engagement_memberships.
--   * New column: engagement_id on every domain table, backfilled to the
--     "audit1" default engagement so existing rows remain visible.
--   * `users` gains a `system_role` column (platform_admin | member); the
--     per-engagement role lives on engagement_memberships from now on. The
--     legacy users.role column stays in place for the duration of this
--     migration and is dropped in a later migration.
--
-- Strict Row-Level Security policies are added in 0005_rls.sql, paired with
-- the application-side request scoping (every request sets app.engagement_id
-- before the first query). They are deliberately kept separate so this
-- migration can land without any code change being required.

-- =====================================================================
-- 1. engagements + memberships
-- =====================================================================

CREATE TABLE IF NOT EXISTS engagements (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  fiscal_year TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','closed','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id BIGINT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status);

-- Bootstrap a default engagement so existing data has a home.
INSERT INTO engagements (slug, name, client_name, fiscal_year)
  VALUES ('audit1', 'Audit 1', 'Client Name', 'FY2026')
  ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS engagement_memberships (
  id BIGSERIAL PRIMARY KEY,
  engagement_id BIGINT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL
    CHECK (role IN ('auditor_lead','auditor','client_owner','client_reviewer')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(engagement_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON engagement_memberships(user_id);

-- =====================================================================
-- 2. Promote system role + migrate existing users into the default engagement
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS system_role TEXT NOT NULL DEFAULT 'member'
    CHECK (system_role IN ('platform_admin','member'));

-- Anyone who was auditor_lead pre-multitenant becomes the platform admin.
UPDATE users SET system_role = 'platform_admin' WHERE role = 'auditor_lead';

-- Every existing user becomes a member of the default engagement with their
-- existing per-engagement role.
INSERT INTO engagement_memberships (engagement_id, user_id, role)
  SELECT e.id, u.id, u.role
  FROM users u
  CROSS JOIN engagements e
  WHERE e.slug = 'audit1'
  ON CONFLICT (engagement_id, user_id) DO NOTHING;

-- =====================================================================
-- 3. engagement_id column on every domain table, backfilled to 'audit1'
-- =====================================================================

ALTER TABLE pbc_items       ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE walkthroughs    ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE entities        ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE sampling_items  ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE activity_log    ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE evidence_files  ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE settings        ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE saved_views     ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);
ALTER TABLE access_log      ADD COLUMN IF NOT EXISTS engagement_id BIGINT REFERENCES engagements(id);

DO $$
DECLARE def_id BIGINT;
BEGIN
  SELECT id INTO def_id FROM engagements WHERE slug = 'audit1';
  UPDATE pbc_items       SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE access_requests SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE walkthroughs    SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE entities        SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE sampling_items  SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE activity_log    SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE evidence_files  SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE settings        SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE saved_views     SET engagement_id = def_id WHERE engagement_id IS NULL;
  UPDATE access_log      SET engagement_id = def_id WHERE engagement_id IS NULL;
END$$;

ALTER TABLE pbc_items       ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE access_requests ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE walkthroughs    ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE entities        ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE sampling_items  ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE activity_log    ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE evidence_files  ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE settings        ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE saved_views     ALTER COLUMN engagement_id SET NOT NULL;
ALTER TABLE access_log      ALTER COLUMN engagement_id SET NOT NULL;

-- =====================================================================
-- 4. Replace global UNIQUE(num) with per-engagement uniqueness
-- =====================================================================

ALTER TABLE pbc_items       DROP CONSTRAINT IF EXISTS pbc_items_num_key;
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_num_key;
ALTER TABLE walkthroughs    DROP CONSTRAINT IF EXISTS walkthroughs_num_key;
ALTER TABLE entities        DROP CONSTRAINT IF EXISTS entities_num_key;
ALTER TABLE sampling_items  DROP CONSTRAINT IF EXISTS sampling_items_num_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pbc_eng_num          ON pbc_items(engagement_id, num);
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_eng_num       ON access_requests(engagement_id, num);
CREATE UNIQUE INDEX IF NOT EXISTS uq_walkthroughs_eng_num ON walkthroughs(engagement_id, num);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entities_eng_num     ON entities(engagement_id, num);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sampling_eng_num     ON sampling_items(engagement_id, num);

-- Settings was keyed by (key) — now (engagement_id, key).
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (engagement_id, key);

-- Saved views: re-scope the per-user index to also include engagement.
DROP INDEX IF EXISTS idx_saved_views_user;
CREATE INDEX IF NOT EXISTS idx_saved_views_user
  ON saved_views(engagement_id, created_by_id, scope);

-- =====================================================================
-- 5. Indexes on the new FK columns
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_pbc_eng         ON pbc_items(engagement_id);
CREATE INDEX IF NOT EXISTS idx_access_eng      ON access_requests(engagement_id);
CREATE INDEX IF NOT EXISTS idx_walk_eng        ON walkthroughs(engagement_id);
CREATE INDEX IF NOT EXISTS idx_entities_eng    ON entities(engagement_id);
CREATE INDEX IF NOT EXISTS idx_sampling_eng    ON sampling_items(engagement_id);
CREATE INDEX IF NOT EXISTS idx_activity_eng_ts ON activity_log(engagement_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_eng    ON evidence_files(engagement_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_eng ON saved_views(engagement_id);
CREATE INDEX IF NOT EXISTS idx_access_log_eng  ON access_log(engagement_id, ts DESC);
