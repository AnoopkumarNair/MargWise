-- 0001_adult.sql: the adult product's tables, exactly as docs/adult/SPEC.md section 10 (T3.1).
-- Additive only (BACKEND ADR-03): new nullable columns and new tables. Old code keeps working after this runs.
-- The student code with the track filters (T3.2) reads testers.track and invites.track, so APPLY THIS MIGRATION BEFORE DEPLOYING THAT CODE.
-- The owner applies it: preview first, then production (docs/PILOT_RUNBOOK.md, Adult section 2). Agents never apply it to a remote database.

ALTER TABLE testers ADD COLUMN track TEXT;              -- NULL = student, 'adult'
ALTER TABLE testers ADD COLUMN age_band TEXT;
ALTER TABLE testers ADD COLUMN email TEXT;              -- normalised (ADR-04); adults only
ALTER TABLE testers ADD COLUMN email_hash TEXT;         -- HMAC(EMAIL_KEY, 'em:v1:' + email)
ALTER TABLE testers ADD COLUMN research_ok INTEGER;
ALTER TABLE testers ADD COLUMN key_v INTEGER;           -- session key version (ADR-04)
CREATE UNIQUE INDEX IF NOT EXISTS testers_email ON testers(email_hash) WHERE email_hash IS NOT NULL;
ALTER TABLE invites ADD COLUMN track TEXT;              -- NULL = student, 'adult'
CREATE TABLE IF NOT EXISTS email_codes (email_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL, link_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, invite_id INTEGER, age_band TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS email_sends (email_hash TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (email_hash, day));
CREATE TABLE IF NOT EXISTS profiles (tester_id TEXT PRIMARY KEY, v INTEGER NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL,
  job_release TEXT, matcher_version TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS under18 (invite_id INTEGER, day TEXT, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (invite_id, day));
CREATE TABLE IF NOT EXISTS ai_calls (tester_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0,
  prompt_version TEXT, PRIMARY KEY (tester_id, day));        -- prompt_version: the extraction prompt of the latest call that day, e.g. 'extract_v1' (ADR-17)
CREATE TABLE IF NOT EXISTS ops_daily (day TEXT NOT NULL, metric TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, metric));
