-- pipeline schema (04 §7, 05 §2–8). The pipeline (service role, GitHub
-- Actions) writes sources, runs, snapshots, extractions and change events.
-- Studio members read everything; owners and stream reviewers record
-- decisions. A decision updates its task through a trigger, so reviewers
-- never need UPDATE on review_tasks.
--
-- Reversible: yes. Down: drop every table in schema pipeline (cascade) and the enums below.

create type pipeline.severity as enum ('critical', 'high', 'medium', 'low');
create type pipeline.review_status as enum ('pending', 'approved', 'edited', 'rejected');
create type pipeline.decision as enum ('approve', 'edit', 'reject');

create table pipeline.sources (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  owner_domain text not null,
  url text not null check (url ~ '^https://'),
  type text not null check (type in ('html', 'pdf', 'csv', 'xlsx', 'json-api')),
  schedule text not null check (schedule ~ '^(daily|weekly|monthly|manual|yearly:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))$'),
  extractor text not null check (extractor ~ '^[a-z0-9:-]+@\d+$'),
  entities text[] not null check (cardinality(entities) > 0),
  severity_default pipeline.severity not null,
  terms_note text not null,
  reviewers text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pipeline.fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references pipeline.sources (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text check (outcome in ('unchanged', 'changed', 'failed', 'unreachable')),
  http_status smallint,
  error text,
  constraint fetch_runs_finished_after_start check (finished_at is null or finished_at >= started_at)
);
create index fetch_runs_source_started_idx on pipeline.fetch_runs (source_id, started_at desc);

create table pipeline.snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references pipeline.sources (id) on delete restrict,
  fetch_run_id uuid references pipeline.fetch_runs (id) on delete set null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null,
  content_type text not null,
  bytes integer not null check (bytes >= 0),
  fetched_at timestamptz not null default now(),
  unique (source_id, sha256)
);
create index snapshots_source_fetched_idx on pipeline.snapshots (source_id, fetched_at desc);
create index snapshots_fetch_run_idx on pipeline.snapshots (fetch_run_id);

create table pipeline.extractions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references pipeline.snapshots (id) on delete cascade,
  extractor text not null check (extractor ~ '^[a-z0-9:-]+@\d+$'),
  method text not null check (method in ('parser', 'llm')),
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  quotes jsonb not null check (jsonb_typeof(quotes) = 'object'),
  page_refs jsonb not null default '{}' check (jsonb_typeof(page_refs) = 'object'),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  -- 05 §6.3: LLM extractions are at most medium confidence until approved.
  constraint extractions_llm_confidence check (method <> 'llm' or confidence <> 'high')
);
create index extractions_snapshot_idx on pipeline.extractions (snapshot_id);

create table pipeline.change_events (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references pipeline.sources (id) on delete restrict,
  extraction_id uuid not null references pipeline.extractions (id) on delete restrict,
  kind text not null,
  entity text not null check (entity ~ '^[a-z_]+$'),
  entity_key text not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  severity pipeline.severity not null,
  detected_at timestamptz not null default now()
);
create index change_events_source_idx on pipeline.change_events (source_id, detected_at desc);
create index change_events_extraction_idx on pipeline.change_events (extraction_id);
create index change_events_entity_idx on pipeline.change_events (entity, entity_key);

create table pipeline.review_tasks (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null unique references pipeline.change_events (id) on delete cascade,
  stream text not null check (stream in ('psychology', 'tech-ai', 'commerce-business', 'design', 'law', 'finance', 'abroad', 'general')),
  severity pipeline.severity not null,
  status pipeline.review_status not null default 'pending',
  due_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_tasks_queue_idx on pipeline.review_tasks (status, severity, due_by) where status = 'pending';

create table pipeline.review_decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references pipeline.review_tasks (id) on delete cascade,
  decision pipeline.decision not null,
  note text,
  edited_value jsonb,
  reviewer uuid not null references auth.users (id) on delete restrict,
  decided_at timestamptz not null default now(),
  constraint review_decisions_note_required check (decision = 'approve' or length(btrim(coalesce(note, ''))) > 0),
  constraint review_decisions_edit_value check (decision <> 'edit' or edited_value is not null)
);
create index review_decisions_task_idx on pipeline.review_decisions (task_id, decided_at desc);
create index review_decisions_reviewer_idx on pipeline.review_decisions (reviewer);

create or replace function private.apply_review_decision() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update pipeline.review_tasks
     set status = case new.decision
                    when 'approve' then 'approved'::pipeline.review_status
                    when 'edit' then 'edited'::pipeline.review_status
                    else 'rejected'::pipeline.review_status
                  end,
         updated_at = now()
   where id = new.task_id;
  return new;
end;
$$;
revoke all on function private.apply_review_decision() from public, anon, authenticated;
create trigger review_decisions_apply after insert on pipeline.review_decisions
  for each row execute function private.apply_review_decision();

create trigger sources_touch before update on pipeline.sources for each row execute function private.touch_updated_at();
create trigger review_tasks_touch before update on pipeline.review_tasks for each row execute function private.touch_updated_at();

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'pipeline' loop
    execute format('alter table pipeline.%I enable row level security', t.tablename);
    execute format('alter table pipeline.%I force row level security', t.tablename);
    execute format(
      'create policy %I on pipeline.%I for select to authenticated using ((select private.is_studio_member()))',
      t.tablename || '_studio_read', t.tablename
    );
  end loop;
end;
$$;

-- Owners and the stream's reviewers may decide; viewers may not. The
-- reviewer column must be the caller (no deciding on someone else's behalf).
create policy review_decisions_insert on pipeline.review_decisions
  for insert to authenticated
  with check (
    reviewer = (select auth.uid())
    and (select private.can_review((select t.stream from pipeline.review_tasks t where t.id = task_id)))
  );

grant usage on schema pipeline to authenticated;
grant select on all tables in schema pipeline to authenticated;
grant insert on pipeline.review_decisions to authenticated;
