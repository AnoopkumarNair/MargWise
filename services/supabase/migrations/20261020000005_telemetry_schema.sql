-- telemetry schema (04 §6–7). Insert-only through Edge Functions using the
-- service role. No client role can read or write these tables; the owner
-- will read aggregates through Studio views (Phase 8). No soft delete:
-- telemetry.delete_session() removes every row for a session.
--
-- Reversible: yes. Down: drop every table in schema telemetry (cascade) and telemetry.delete_session.

create table telemetry.sessions (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create table telemetry.consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references telemetry.sessions (id) on delete cascade,
  tier smallint not null check (tier in (1, 2)),
  notice_version text not null check (length(notice_version) between 1 and 32),
  teen_assent boolean not null,
  deletion_code_hash text not null check (deletion_code_hash ~ '^[0-9a-f]{64}$'),
  consented_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint consents_tier2_assent check (tier = 1 or teen_assent)
);
-- Latest consent per session decides the tier.
create index consents_session_latest_idx on telemetry.consents (session_id, received_at desc);

create table telemetry.events (
  event_id uuid primary key,
  session_id uuid not null references telemetry.sessions (id) on delete cascade,
  seq integer not null check (seq >= 0),
  type text not null check (type ~ '^[a-z_]+$'),
  occurred_at timestamptz not null,
  -- Validated against the closed TelemetryEvent schema before insert.
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object'),
  received_at timestamptz not null default now()
);
create index events_session_seq_idx on telemetry.events (session_id, seq);
create index events_type_occurred_idx on telemetry.events (type, occurred_at);

create table telemetry.item_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references telemetry.sessions (id) on delete cascade,
  arm text not null check (arm in ('game', 'plain')),
  item_values smallint[] not null,
  area_scores jsonb not null check (jsonb_typeof(area_scores) = 'object'),
  flags jsonb not null check (jsonb_typeof(flags) = 'object'),
  parent_present text not null check (parent_present in ('yes', 'no', 'unsure')),
  device_class text not null check (device_class in ('low', 'mid', 'high')),
  class_year smallint not null check (class_year in (11, 12)),
  subject_combination text not null,
  city_tier text not null check (city_tier in ('metro', 'tier-2', 'tier-3')),
  received_at timestamptz not null default now(),
  constraint item_responses_sixty check (cardinality(item_values) = 60),
  constraint item_responses_range check (0 <= all (item_values) and 4 >= all (item_values))
);
create index item_responses_session_idx on telemetry.item_responses (session_id);

create table telemetry.coverage_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references telemetry.sessions (id) on delete cascade,
  kind text not null check (kind in ('career', 'course', 'city', 'country')),
  label text not null check (length(btrim(label)) between 1 and 60),
  received_at timestamptz not null default now()
);
create index coverage_requests_session_idx on telemetry.coverage_requests (session_id);
create index coverage_requests_kind_label_idx on telemetry.coverage_requests (kind, lower(label));

create table telemetry.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references telemetry.sessions (id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  received_at timestamptz not null default now()
);
create index feedback_session_idx on telemetry.feedback (session_id);

-- Kept separately from the session rows it deletes, without a foreign key,
-- so the audit record survives the deletion it requested.
create table telemetry.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint deletion_requests_completed_after check (completed_at is null or completed_at >= requested_at)
);
create index deletion_requests_pending_idx on telemetry.deletion_requests (requested_at) where completed_at is null;

-- Global switch for minors' telemetry (04 §6.3): configuration, not code.
create table telemetry.settings (
  key text primary key check (key in ('minors_telemetry_enabled')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into telemetry.settings (key, value) values ('minors_telemetry_enabled', 'true');

create or replace function telemetry.delete_session(p_session_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Cascades to consents, events, item_responses, coverage_requests, feedback.
  delete from telemetry.sessions where id = p_session_id;
  update telemetry.deletion_requests set completed_at = now()
   where session_id = p_session_id and completed_at is null;
end;
$$;
revoke all on function telemetry.delete_session(uuid) from public, anon, authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'telemetry' loop
    execute format('alter table telemetry.%I enable row level security', t.tablename);
    execute format('alter table telemetry.%I force row level security', t.tablename);
  end loop;
end;
$$;
-- Deliberately no policies and no grants for anon/authenticated.
