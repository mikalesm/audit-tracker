-- Baseline schema for Postgres. Mirrors the old SQLite schema in db.ts:initSchema()
-- but uses native Postgres types. Date columns become DATE; created_at/updated_at/ts
-- become TIMESTAMPTZ; AUTOINCREMENT becomes BIGSERIAL.

CREATE TABLE IF NOT EXISTS pbc_items (
  id BIGSERIAL PRIMARY KEY,
  num INTEGER UNIQUE NOT NULL,
  category TEXT NOT NULL,
  item_requested TEXT NOT NULL,
  why_purpose TEXT NOT NULL DEFAULT '',
  format_expected TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  owner_client TEXT,
  status TEXT NOT NULL DEFAULT 'Not Started',
  date_requested DATE,
  date_received DATE,
  notes TEXT,
  tsc_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_comments TEXT,
  linked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id BIGSERIAL PRIMARY KEY,
  num INTEGER UNIQUE NOT NULL,
  system TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT '',
  role_permissions TEXT NOT NULL DEFAULT '',
  recommended_method TEXT NOT NULL DEFAULT '',
  justification TEXT NOT NULL DEFAULT '',
  owner_client TEXT,
  status TEXT NOT NULL DEFAULT 'Not Requested',
  provisioned_date DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS walkthroughs (
  id BIGSERIAL PRIMARY KEY,
  num INTEGER UNIQUE NOT NULL,
  process_area TEXT NOT NULL,
  key_topics TEXT NOT NULL DEFAULT '',
  attendees TEXT NOT NULL DEFAULT '',
  proposed_date DATE,
  duration_min INTEGER,
  status TEXT NOT NULL DEFAULT 'Not Scheduled',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entities (
  id BIGSERIAL PRIMARY KEY,
  num INTEGER UNIQUE NOT NULL,
  legal_entity TEXT,
  country_location TEXT,
  it_model TEXT,
  key_applications TEXT,
  hosting TEXT,
  headcount INTEGER,
  in_scope TEXT,
  rationale TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sampling_items (
  id BIGSERIAL PRIMARY KEY,
  num INTEGER UNIQUE NOT NULL,
  control_area TEXT NOT NULL,
  control_description TEXT NOT NULL DEFAULT '',
  population_source TEXT NOT NULL DEFAULT '',
  population_size INTEGER,
  sample_size INTEGER,
  sampling_method TEXT NOT NULL DEFAULT '',
  test_status TEXT NOT NULL DEFAULT 'Not Started',
  findings_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log(ts);

CREATE TABLE IF NOT EXISTS evidence_files (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES pbc_items(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  stored_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_item ON evidence_files(item_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_views (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'pbc',
  name TEXT NOT NULL,
  filters_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_views_scope ON saved_views(scope);

-- Seed default engagement settings (idempotent)
INSERT INTO settings (key, value) VALUES
  ('clientName',   'Client Name'),
  ('auditPeriod',  'FY2026'),
  ('leadAuditor',  'Lead Auditor'),
  ('sponsor',      'Audit Sponsor'),
  ('projectTitle', 'IT Audit — PBC Tracker')
ON CONFLICT (key) DO NOTHING;
