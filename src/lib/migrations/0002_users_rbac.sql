-- Multi-user dataroom additions: identity, RBAC, and read-side audit trail.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  entra_object_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'client_reviewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Attribution columns on existing tables (nullable so migration is non-breaking)
ALTER TABLE activity_log    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE evidence_files  ADD COLUMN IF NOT EXISTS uploaded_by_id BIGINT REFERENCES users(id);
ALTER TABLE saved_views     ADD COLUMN IF NOT EXISTS created_by_id BIGINT REFERENCES users(id);

-- Read-side audit log (every authenticated request to a sensitive resource)
CREATE TABLE IF NOT EXISTS access_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  resource_type TEXT NOT NULL,    -- 'pbc' | 'evidence' | 'walkthrough' | ...
  resource_id BIGINT,
  action TEXT NOT NULL,           -- 'view' | 'download' | 'list' | ...
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_log_user_ts ON access_log(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_resource ON access_log(resource_type, resource_id);

-- Per-user saved views: tighten the unique constraint scope so the same name
-- can be reused across users without collision.
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views(created_by_id, scope);
