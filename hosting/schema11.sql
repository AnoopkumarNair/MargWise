-- return code for self-signup testers: lets a returning tester find their last result on a new device
ALTER TABLE testers ADD COLUMN ret_hash TEXT;
CREATE INDEX IF NOT EXISTS testers_ret ON testers (ret_hash);
