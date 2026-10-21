-- Service-role access to the application schemas.
-- Supabase grants service_role on `public` only; custom schemas need explicit
-- grants. Found in review: the DB tests previously granted these in a test-only
-- file, which would have hidden their absence in a real project.
-- service_role (Edge Functions, pipeline jobs) has BYPASSRLS; client roles get nothing here.
--
-- Reversible: yes. Down:
--   revoke all on all tables in schema content, pipeline, telemetry from service_role;
--   revoke usage on schema content, pipeline, telemetry from service_role;

grant usage on schema content, pipeline, telemetry to service_role;
grant select, insert, update, delete on all tables in schema content, pipeline, telemetry to service_role;
grant usage, select on all sequences in schema content, pipeline, telemetry to service_role;
grant execute on function telemetry.delete_session(uuid) to service_role;

alter default privileges in schema content grant select, insert, update, delete on tables to service_role;
alter default privileges in schema pipeline grant select, insert, update, delete on tables to service_role;
alter default privileges in schema telemetry grant select, insert, update, delete on tables to service_role;
