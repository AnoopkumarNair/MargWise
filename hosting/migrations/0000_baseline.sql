-- 0000_baseline.sql: the whole current schema in one file (schema.sql to schema12.sql, applied in numeric order).
--
-- WARNING: NEVER APPLY THIS FILE TO THE PRODUCTION DATABASE.
-- Production already has this schema. Every statement here is CREATE ... IF NOT EXISTS, so running it there would
-- change no table or row; the real risk is that it would hide schema drift: a production table that differs from
-- this file would be skipped silently and look "migrated". On production, compare the exported schema with this file,
-- then only record it as applied (see docs/PILOT_RUNBOOK.md, Adult section 2). It is for NEW databases: local,
-- preview and tests (BACKEND.md ADR-03).
--
-- Differences from the old files, none of which change the resulting tables, columns (in order) or indexes:
--   * columns that the old files added with ALTER TABLE are written inside CREATE TABLE, in the order they were added;
--   * schema10.sql (clean old audit rows) is left out, because a new database has no rows to clean.
-- A test (hosting/tests/adult/baseline.test.mjs) checks that the result equals the old files applied in order.

CREATE TABLE IF NOT EXISTS testers (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, ua TEXT, invite_id INTEGER, source TEXT, counsellor_id INTEGER, klass TEXT, consent_on TEXT, followup_ok INTEGER, ret_hash TEXT, tok_after INTEGER);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, tester_id TEXT NOT NULL, session_id TEXT, ts INTEGER NOT NULL, type TEXT NOT NULL, data TEXT, eid TEXT);
CREATE INDEX IF NOT EXISTS idx_events_tester ON events(tester_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_eid ON events(tester_id, eid);
CREATE TABLE IF NOT EXISTS joins (ip TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_joins ON joins(ip, ts);
CREATE TABLE IF NOT EXISTS invites (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, expires_at INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, run TEXT NOT NULL, batch INTEGER NOT NULL, field_key TEXT NOT NULL, statement TEXT NOT NULL, urls TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_claims_run ON claims(run, batch);
CREATE TABLE IF NOT EXISTS claim_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id TEXT NOT NULL, reviewer TEXT NOT NULL, verdict TEXT NOT NULL, says TEXT, checked_on TEXT, created_at INTEGER NOT NULL, applied INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_cr_claim ON claim_reviews(claim_id);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS admin_fail (ip TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_admin_fail ON admin_fail(ip, ts);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT);
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, tester_id TEXT NOT NULL UNIQUE, code TEXT NOT NULL, counsellor TEXT NOT NULL, baseline TEXT NOT NULL, baseline_at INTEGER NOT NULL, app_top TEXT, overlap INTEGER, overlap6 INTEGER, missed TEXT, wrong TEXT, wrong_field TEXT, use_it TEXT, notes TEXT, reviewed_at INTEGER, counsellor_id INTEGER, blind INTEGER, career_note TEXT, sure TEXT, sections TEXT, view_after TEXT);
CREATE INDEX IF NOT EXISTS idx_reviews_code ON reviews(code);
CREATE TABLE IF NOT EXISTS counsellors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, invite_id INTEGER NOT NULL, key_hash TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_used INTEGER);
CREATE TABLE IF NOT EXISTS followups (id INTEGER PRIMARY KEY AUTOINCREMENT, tester_id TEXT NOT NULL, months INTEGER NOT NULL, stream TEXT, used TEXT, note TEXT, counsellor_id INTEGER, created_at INTEGER NOT NULL, UNIQUE(tester_id, months));
CREATE INDEX IF NOT EXISTS testers_ret ON testers (ret_hash);
