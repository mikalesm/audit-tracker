-- 0008_pbc_entity_scope.sql
-- PBC items become entity-aware. A group audit covers several legal entities
-- (HQ + subsidiaries); genuinely per-entity requests (network maps, app
-- inventories, access reviews) should be asked once *per in-scope entity*
-- rather than once for the whole engagement.
--
--   * entity_id NULL          → group-wide item (the default).
--   * entity_id = entities.id → an instance scoped to one legal entity.
--
-- ON DELETE SET NULL (never CASCADE): deleting an entity converts its PBC
-- rows back to group-wide rather than destroying evidence-bearing rows.
--
-- template_key is a stable slug linking a row back to the library item it was
-- seeded from, so the re-sync routine (syncPbcEntityScope) can tell which
-- template a row came from without fuzzy text matching.
--
-- No new RLS policy is needed — the existing engagement_isolation policy on
-- pbc_items keys on engagement_id and already covers per-entity rows. This
-- migration is pure additive DDL and is idempotent.

ALTER TABLE pbc_items ADD COLUMN IF NOT EXISTS entity_id BIGINT
  REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE pbc_items ADD COLUMN IF NOT EXISTS template_key TEXT;

CREATE INDEX IF NOT EXISTS idx_pbc_eng_entity ON pbc_items(engagement_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_pbc_eng_tplkey ON pbc_items(engagement_id, template_key);
