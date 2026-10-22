ALTER TABLE testers ADD COLUMN source TEXT;
ALTER TABLE testers ADD COLUMN counsellor_id INTEGER;
ALTER TABLE testers ADD COLUMN klass TEXT;
ALTER TABLE testers ADD COLUMN consent_on TEXT;
ALTER TABLE reviews ADD COLUMN career_note TEXT;
ALTER TABLE reviews ADD COLUMN sure TEXT;
ALTER TABLE reviews ADD COLUMN sections TEXT;
ALTER TABLE reviews ADD COLUMN view_after TEXT;
CREATE TABLE IF NOT EXISTS followups (id INTEGER PRIMARY KEY AUTOINCREMENT, tester_id TEXT NOT NULL, months INTEGER NOT NULL, stream TEXT, used TEXT, note TEXT, counsellor_id INTEGER, created_at INTEGER NOT NULL, UNIQUE(tester_id, months));
