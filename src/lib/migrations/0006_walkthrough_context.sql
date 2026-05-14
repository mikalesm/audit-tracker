-- 0006_walkthrough_context.sql
-- Walkthroughs previously only carried `key_topics` + `attendees` + `notes`,
-- which meant the audit team had no place to record *what the walkthrough is for*
-- (the objective the auditor needs to confirm) or to write a paragraph of
-- context for the client. Both are now first-class columns so the redesigned
-- UI can surface them as labelled sections.
--
-- Both columns are nullable and have no backfill — existing rows render with
-- a placeholder in the UI until an auditor fills them in.

ALTER TABLE walkthroughs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE walkthroughs ADD COLUMN IF NOT EXISTS objective   TEXT;
