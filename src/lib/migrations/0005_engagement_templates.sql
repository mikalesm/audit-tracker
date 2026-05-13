-- 0005_engagement_templates.sql
-- A template engagement is a normal engagement row with is_template=true.
-- It holds the standard PBC checklist (and access/walkthroughs/entities/sampling
-- if you want them), and is hidden from the regular engagement picker. New
-- engagements can be created with `fromTemplateId` to copy the template's rows.

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_engagements_is_template ON engagements(is_template);
