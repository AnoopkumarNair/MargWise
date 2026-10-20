-- Subject-based eligibility (decision D-024, owner answer 2026-10-20).
-- Students record their actual Class 11–12 subjects (CBSE or CISCE); each
-- route's gate is a sourced rule over canonical subject keys that the engine
-- evaluates to OPEN / BRIDGE / LOCKED. Replaces the fixed stream list.
-- content.gates and telemetry.item_responses.subject_combination held no data
-- in any environment when this ran.
--
-- Reversible: yes, while gates hold no rule data. Down:
--   drop table content.gates; drop table content.subjects; drop type content.board;
--   recreate content.gates from 20261020000003; restore item_responses.subject_combination.

create type content.board as enum ('CBSE', 'CISCE');

create table content.subjects (
  key text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  board content.board not null,
  board_code text not null check (length(board_code) between 1 and 16),
  name text not null,
  kind text not null check (kind in ('language', 'core', 'elective', 'skill')),
  provenance_id uuid not null references content.provenance (id),
  primary key (board, key),
  unique (board, board_code)
);
create index subjects_key_idx on content.subjects (key);
create index subjects_provenance_idx on content.subjects (provenance_id);
create trigger subjects_require_sourced before insert or update on content.subjects
  for each row execute function private.require_sourced_provenance();

drop table content.gates;

create table content.gates (
  id uuid primary key default gen_random_uuid(),
  route_id text not null references content.routes (id) on delete cascade,
  -- NULL = applies to every board.
  board content.board,
  all_of text[] not null default '{}',
  -- Each inner group needs at least one subject; stored as jsonb array of arrays.
  any_of jsonb not null default '[]',
  min_aggregate_percent numeric(5, 2) check (min_aggregate_percent between 0 and 100),
  when_unmet content.gate_status not null check (when_unmet <> 'OPEN'),
  bridge_note text,
  reason text not null check (length(btrim(reason)) > 0),
  provenance_id uuid not null references content.provenance (id),
  constraint gates_any_of_shape check (
    jsonb_typeof(any_of) = 'array'
    and not jsonb_path_exists(any_of, 'strict $[*] ? (@.type() != "array" || @.size() == 0)')
  ),
  constraint gates_bridge_note check (when_unmet <> 'BRIDGE' or length(btrim(coalesce(bridge_note, ''))) > 0)
);
alter table content.gates add constraint gates_route_board_key unique nulls not distinct (route_id, board);
create index gates_provenance_idx on content.gates (provenance_id);
create trigger gates_require_sourced before insert or update on content.gates
  for each row execute function private.require_sourced_provenance();
alter table content.gates enable row level security;
alter table content.gates force row level security;
create policy gates_studio_read on content.gates for select to authenticated using ((select private.is_studio_member()));
grant select on content.gates, content.subjects to authenticated;
grant select, insert, update, delete on content.gates, content.subjects to service_role;

alter table content.subjects enable row level security;
alter table content.subjects force row level security;
create policy subjects_studio_read on content.subjects for select to authenticated using ((select private.is_studio_member()));

alter table telemetry.item_responses drop column subject_combination;
alter table telemetry.item_responses
  add column board text not null check (board in ('CBSE', 'CISCE')),
  add column subjects text[] not null check (cardinality(subjects) between 4 and 8);
