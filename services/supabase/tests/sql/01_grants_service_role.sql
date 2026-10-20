-- Mirrors Supabase: service_role (Edge Functions, pipeline) may use every schema.
grant usage on schema content, pipeline, telemetry, private to service_role;
grant all on all tables in schema content, pipeline, telemetry to service_role;
grant execute on function telemetry.delete_session(uuid) to service_role;
