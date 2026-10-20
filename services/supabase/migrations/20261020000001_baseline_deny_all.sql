-- Baseline: deny by default (04 §6.4, §8; CLAUDE.md rule 10).
-- Creates the three application schemas plus a private helper schema and
-- revokes every default grant from the client roles. Tables added later get
-- RLS enabled in the migration that creates them; nothing is readable by
-- `anon` or `authenticated` unless a policy says so.
--
-- Reversible: yes. Down:
--   drop schema if exists private, telemetry, pipeline, content cascade;

create schema if not exists content;
create schema if not exists pipeline;
create schema if not exists telemetry;
create schema if not exists private;

comment on schema content is 'Reviewed facts with provenance; source of release bundles. Never served directly to families.';
comment on schema pipeline is 'Sources, snapshots, extractions, change events and review workflow.';
comment on schema telemetry is 'Consented telemetry. Insert-only via Edge Functions (service role). Real deletion, no soft delete.';
comment on schema private is 'Security-definer helpers. Never exposed through the Data API.';

revoke all on schema content, pipeline, telemetry, private from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema content revoke all on tables from public, anon, authenticated;
alter default privileges in schema pipeline revoke all on tables from public, anon, authenticated;
alter default privileges in schema telemetry revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;

-- Shared trigger to maintain updated_at.
create or replace function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
