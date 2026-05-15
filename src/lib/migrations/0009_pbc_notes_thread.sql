-- 0009_pbc_notes_thread.sql
-- A first-class threaded notes table on PBC items, replacing the single TEXT
-- `notes` column on pbc_items in the UI. The legacy column stays in place for
-- backwards compatibility (and the activity log still references it) but is
-- no longer surfaced in the detail panel.
--
-- Each note carries author + created/updated/edited timestamps so the UI can
-- render the full history. ON DELETE CASCADE on pbc_item_id and engagement_id
-- so notes follow the lifecycle of their parent rows. RLS mirrors every other
-- domain table — engagement_id-scoped, FORCE'd.

CREATE TABLE IF NOT EXISTS pbc_notes (
  id BIGSERIAL PRIMARY KEY,
  engagement_id BIGINT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  pbc_item_id BIGINT NOT NULL REFERENCES pbc_items(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pbc_notes_eng_item_created
  ON pbc_notes(engagement_id, pbc_item_id, created_at);

ALTER TABLE pbc_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pbc_notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_isolation ON pbc_notes;
CREATE POLICY engagement_isolation ON pbc_notes
  USING (
    engagement_id = nullif(current_setting('app.engagement_id', true), '')::bigint
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    engagement_id = nullif(current_setting('app.engagement_id', true), '')::bigint
    OR current_setting('app.bypass_rls', true) = 'on'
  );
