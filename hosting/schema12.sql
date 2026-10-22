-- revocation: tokens issued before this time stop working for the tester (admin ?revoke=<id>)
ALTER TABLE testers ADD COLUMN tok_after INTEGER;
