-- remove student identifiers that earlier versions wrote into the audit log
UPDATE audit SET detail = '{}' WHERE action IN ('student_added', 'student_removed');
