-- RLS and constraint tests. Each block raises on failure; ON_ERROR_STOP aborts the run.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_denied(p_role text, p_sql text, p_uid text default '') returns void
language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute format('set local role %I', p_role);
    perform set_config('request.jwt.claim.sub', p_uid, true);
    execute p_sql;
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  reset role;
  if not ok then raise exception 'expected % to be denied: %', p_role, p_sql; end if;
end $$;

create or replace function pg_temp.expect_rows(p_role text, p_sql text, p_expected bigint, p_uid text default '') returns void
language plpgsql as $$
declare n bigint;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claim.sub', p_uid, true);
  execute format('select count(*) from (%s) q', p_sql) into n;
  reset role;
  if n <> p_expected then raise exception 'expected % rows for % but got %: %', p_expected, p_role, n, p_sql; end if;
end $$;

create or replace function pg_temp.expect_violation(p_sql text, p_constraint text) returns void
language plpgsql as $$
declare ok boolean := false; msg text;
begin
  begin
    execute p_sql;
  exception when check_violation or not_null_violation or foreign_key_violation or unique_violation then
    get stacked diagnostics msg = constraint_name;
    if msg is distinct from p_constraint and p_constraint <> '*' then
      raise exception 'expected constraint % but % fired for: %', p_constraint, msg, p_sql;
    end if;
    ok := true;
  end;
  if not ok then raise exception 'expected % to fail: %', p_constraint, p_sql; end if;
end $$;

begin;

-- 1. Every table in the application schemas has RLS enabled and forced.
do $$
declare bad text;
begin
  select string_agg(n.nspname || '.' || c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind = 'r' and n.nspname in ('content', 'pipeline', 'telemetry', 'private')
     and not (c.relrowsecurity and (c.relforcerowsecurity or n.nspname = 'private'));
  if bad is not null then raise exception 'tables without RLS: %', bad; end if;
end $$;

-- 1b. Every foreign key in the application schemas has a covering index
-- (mirrors the Supabase performance advisor "unindexed foreign keys").
do $$
declare bad text;
begin
  select string_agg(c.conrelid::regclass || '.' || c.conname, ', ') into bad
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where c.contype = 'f' and n.nspname in ('content', 'pipeline', 'telemetry', 'private')
     and not exists (
       select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] = c.conkey
     );
  if bad is not null then raise exception 'foreign keys without a covering index: %', bad; end if;
end $$;

-- Fixtures (as superuser, i.e. the migration owner).
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),  -- owner
  ('00000000-0000-4000-8000-000000000002'),  -- psychology reviewer
  ('00000000-0000-4000-8000-000000000003'),  -- viewer
  ('00000000-0000-4000-8000-000000000004');  -- signed-in non-member
insert into private.studio_members (user_id, role, streams) values
  ('00000000-0000-4000-8000-000000000001', 'owner', '{}'),
  ('00000000-0000-4000-8000-000000000002', 'reviewer', '{psychology}'),
  ('00000000-0000-4000-8000-000000000003', 'viewer', '{}');

insert into content.clusters (id, title, summary) values ('psychology', 'Psychology', 'fixture');
insert into content.provenance (id, status, unit, as_of, confidence, source_url, quote, snapshot_id)
  values ('10000000-0000-4000-8000-000000000001', 'sourced', 'gate_status', '2026-10-15', 'high', 'https://example.gov.in/x', 'fixture quote', gen_random_uuid());
insert into content.provenance (id, status, unit, as_of, confidence, rationale)
  values ('10000000-0000-4000-8000-000000000002', 'assumption', 'ratio', '2026-10-15', 'low', 'fixture rationale');

insert into pipeline.sources (id, title, owner_domain, url, type, schedule, extractor, entities, severity_default, terms_note)
  values ('fixture-source', 'Fixture', 'loans', 'https://example.gov.in/rates', 'html', 'weekly', 'fixture-parser@1', '{loan_schemes}', 'high', 'fixture');
insert into pipeline.snapshots (id, source_id, sha256, storage_path, content_type, bytes)
  values ('20000000-0000-4000-8000-000000000001', 'fixture-source', repeat('a', 64), 'snapshots/x', 'text/html', 10);
insert into pipeline.extractions (id, snapshot_id, extractor, method, fields, quotes, confidence)
  values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'fixture-parser@1', 'parser', '{}', '{}', 'high');
insert into pipeline.change_events (id, source_id, extraction_id, kind, entity, entity_key, field, severity)
  values ('20000000-0000-4000-8000-000000000003', 'fixture-source', '20000000-0000-4000-8000-000000000002', 'value_changed', 'gates', 'k', 'status', 'critical');
insert into pipeline.review_tasks (id, change_event_id, stream, severity)
  values ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'psychology', 'critical');
insert into pipeline.change_events (id, source_id, extraction_id, kind, entity, entity_key, field, severity)
  values ('20000000-0000-4000-8000-000000000005', 'fixture-source', '20000000-0000-4000-8000-000000000002', 'value_changed', 'loan_schemes', 'k', 'rate', 'high');
insert into pipeline.review_tasks (id, change_event_id, stream, severity)
  values ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005', 'finance', 'high');

insert into telemetry.sessions (id) values ('30000000-0000-4000-8000-000000000001');

-- 0. Meta: the helpers fail when they should (guards against vacuous tests).
do $$
declare caught boolean;
begin
  caught := false;
  begin perform pg_temp.expect_denied('authenticated', 'select * from content.clusters', '00000000-0000-4000-8000-000000000001');
  exception when raise_exception then caught := true; end;
  if not caught then raise exception 'meta: expect_denied accepted a permitted read'; end if;
  caught := false;
  begin perform pg_temp.expect_violation($q$select 1$q$, 'any');
  exception when raise_exception then caught := true; end;
  if not caught then raise exception 'meta: expect_violation accepted a statement that succeeded'; end if;
  caught := false;
  begin perform pg_temp.expect_rows('authenticated', 'select * from content.clusters', 99, '00000000-0000-4000-8000-000000000001');
  exception when raise_exception then caught := true; end;
  if not caught then raise exception 'meta: expect_rows accepted a wrong count'; end if;
end $$;

-- 2. anon can read or write nothing anywhere.
select pg_temp.expect_denied('anon', 'select * from content.clusters');
select pg_temp.expect_denied('anon', 'select * from pipeline.sources');
select pg_temp.expect_denied('anon', 'select * from telemetry.events');
select pg_temp.expect_denied('anon', $$insert into telemetry.sessions (id) values (gen_random_uuid())$$);
select pg_temp.expect_denied('anon', $$insert into content.clusters (id, title, summary) values ('law', 'x', 'y')$$);

-- 3. authenticated: Studio members read content/pipeline; non-members see nothing.
select pg_temp.expect_rows('authenticated', 'select * from content.clusters', 1, '00000000-0000-4000-8000-000000000003');
select pg_temp.expect_rows('authenticated', 'select * from content.clusters', 0, '00000000-0000-4000-8000-000000000004');
select pg_temp.expect_rows('authenticated', 'select * from pipeline.review_tasks', 2, '00000000-0000-4000-8000-000000000002');
select pg_temp.expect_rows('authenticated', 'select * from pipeline.review_tasks', 0, '00000000-0000-4000-8000-000000000004');

-- 4. Nobody but the service role touches telemetry — not even the owner.
select pg_temp.expect_denied('authenticated', 'select * from telemetry.events', '00000000-0000-4000-8000-000000000001');
select pg_temp.expect_denied('authenticated', $$insert into telemetry.sessions (id) values (gen_random_uuid())$$, '00000000-0000-4000-8000-000000000001');
select pg_temp.expect_denied('authenticated', $$select telemetry.delete_session('30000000-0000-4000-8000-000000000001')$$, '00000000-0000-4000-8000-000000000001');

-- 5. Content is written by the service role only.
select pg_temp.expect_denied('authenticated', $$insert into content.clusters (id, title, summary) values ('law', 'x', 'y')$$, '00000000-0000-4000-8000-000000000001');
select pg_temp.expect_denied('authenticated', $$update content.clusters set title = 'x'$$, '00000000-0000-4000-8000-000000000001');

-- 6. Review decisions: stream reviewer yes, other stream no, viewer no, impersonation no.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
insert into pipeline.review_decisions (task_id, decision, reviewer)
  values ('20000000-0000-4000-8000-000000000004', 'approve', '00000000-0000-4000-8000-000000000002');
reset role;
do $$ begin
  if (select status from pipeline.review_tasks where id = '20000000-0000-4000-8000-000000000004') <> 'approved' then
    raise exception 'decision trigger did not approve the task';
  end if;
end $$;
select pg_temp.expect_denied('authenticated', $$insert into pipeline.review_decisions (task_id, decision, reviewer)
  values ('20000000-0000-4000-8000-000000000006', 'approve', '00000000-0000-4000-8000-000000000002')$$, '00000000-0000-4000-8000-000000000002');
select pg_temp.expect_denied('authenticated', $$insert into pipeline.review_decisions (task_id, decision, reviewer)
  values ('20000000-0000-4000-8000-000000000006', 'approve', '00000000-0000-4000-8000-000000000003')$$, '00000000-0000-4000-8000-000000000003');
select pg_temp.expect_denied('authenticated', $$insert into pipeline.review_decisions (task_id, decision, reviewer)
  values ('20000000-0000-4000-8000-000000000006', 'approve', '00000000-0000-4000-8000-000000000002')$$, '00000000-0000-4000-8000-000000000001');
select pg_temp.expect_rows('authenticated', $$select 1 where (select private.can_review('finance'))$$, 1, '00000000-0000-4000-8000-000000000001');
select pg_temp.expect_denied('authenticated', $$update pipeline.review_tasks set status = 'approved'$$, '00000000-0000-4000-8000-000000000001');

-- 7. Constraints mirror the contracts and the release gate.
select pg_temp.expect_violation($$insert into content.provenance (status, unit, as_of, confidence, source_url, snapshot_id)
  values ('sourced', 'x', '2026-10-15', 'high', 'https://a.gov.in', gen_random_uuid())$$, 'provenance_sourced_evidence');
select pg_temp.expect_violation($$insert into content.provenance (status, unit, as_of, confidence, rationale)
  values ('assumption', 'x', '2026-10-15', 'low', '  ')$$, 'provenance_assumption_rationale');
select pg_temp.expect_violation($$insert into content.provenance (status, unit, as_of, confidence, source_url, quote, snapshot_id)
  values ('sourced', 'x', '2026-10-15', 'high', 'https://www.glassdoor.co.in/x', 'q', gen_random_uuid())$$, 'provenance_not_forbidden_source');
select pg_temp.expect_violation($$insert into content.provenance (status, unit, as_of, valid_to, confidence, rationale)
  values ('assumption', 'x', '2026-10-15', '2026-01-01', 'low', 'r')$$, 'provenance_valid_to_after_as_of');
insert into content.careers (id, cluster_id, title) values ('psy-1', 'psychology', 'Fixture');
insert into content.routes (id, career_id, title, kind) values ('psy-1-ma', 'psy-1', 'Fixture', 'main');
select pg_temp.expect_violation($$insert into content.gates (route_id, all_of, when_unmet, reason, provenance_id)
  values ('psy-1-ma', '{psychology}', 'LOCKED', 'r', '10000000-0000-4000-8000-000000000002')$$, '*');
select pg_temp.expect_violation($$insert into content.gates (route_id, when_unmet, reason, provenance_id)
  values ('psy-1-ma', 'BRIDGE', 'r', '10000000-0000-4000-8000-000000000001')$$, 'gates_bridge_note');
select pg_temp.expect_violation($$insert into content.gates (route_id, any_of, when_unmet, reason, provenance_id)
  values ('psy-1-ma', '[[]]', 'LOCKED', 'r', '10000000-0000-4000-8000-000000000001')$$, 'gates_any_of_shape');
select pg_temp.expect_violation($$insert into content.gates (route_id, when_unmet, reason, provenance_id)
  values ('psy-1-ma', 'OPEN', 'r', '10000000-0000-4000-8000-000000000001')$$, 'gates_when_unmet_check');
insert into content.gates (route_id, all_of, any_of, when_unmet, bridge_note, reason, provenance_id)
  values ('psy-1-ma', '{psychology}', '[["english"]]', 'BRIDGE', 'bridge', 'r', '10000000-0000-4000-8000-000000000001');
select pg_temp.expect_violation($$insert into content.subjects (key, board, board_code, name, kind, provenance_id)
  values ('psychology', 'CBSE', '037', 'Psychology', 'elective', '10000000-0000-4000-8000-000000000002')$$, '*');
insert into content.subjects (key, board, board_code, name, kind, provenance_id)
  values ('psychology', 'CBSE', '037', 'Psychology', 'elective', '10000000-0000-4000-8000-000000000001');
insert into content.cities (id, name, tier, kind) values ('pune', 'Pune', 'metro', 'covered');
select pg_temp.expect_violation($$insert into content.city_costs (city_id, item, low, likely, high, provenance_id)
  values ('pune', 'food', 3, 2, 4, '10000000-0000-4000-8000-000000000002')$$, 'city_costs_range');
select pg_temp.expect_violation($$insert into content.loan_schemes (id, lender, title, applies, rate_low, rate_likely, rate_high, rate_provenance_id, user_confirm_url)
  values ('x', 'b', 't', 'india', 7, 7.5, 8, '10000000-0000-4000-8000-000000000002', 'https://x.in')$$, 'loan_schemes_rate_range');
select pg_temp.expect_violation($$insert into pipeline.extractions (snapshot_id, extractor, method, fields, quotes, confidence)
  values ('20000000-0000-4000-8000-000000000001', 'llm:x@1', 'llm', '{}', '{}', 'high')$$, 'extractions_llm_confidence');
select pg_temp.expect_violation($$insert into pipeline.review_decisions (task_id, decision, reviewer)
  values ('20000000-0000-4000-8000-000000000006', 'reject', '00000000-0000-4000-8000-000000000001')$$, 'review_decisions_note_required');
select pg_temp.expect_violation($$insert into telemetry.consents (session_id, tier, notice_version, teen_assent, deletion_code_hash, consented_at)
  values ('30000000-0000-4000-8000-000000000001', 2, 'v', false, repeat('f', 64), now())$$, 'consents_tier2_assent');
select pg_temp.expect_violation($$insert into telemetry.item_responses (session_id, arm, item_values, area_scores, flags, parent_present, device_class, class_year, board, subjects, city_tier)
  values ('30000000-0000-4000-8000-000000000001', 'game', array_fill(2::smallint, array[59]), '{}', '{}', 'no', 'mid', 11, 'CBSE', '{english,physics,chemistry,mathematics}', 'metro')$$, 'item_responses_sixty');
select pg_temp.expect_violation($$insert into telemetry.item_responses (session_id, arm, item_values, area_scores, flags, parent_present, device_class, class_year, board, subjects, city_tier)
  values ('30000000-0000-4000-8000-000000000001', 'game', array_fill(5::smallint, array[60]), '{}', '{}', 'no', 'mid', 11, 'CBSE', '{english,physics,chemistry,mathematics}', 'metro')$$, 'item_responses_range');
select pg_temp.expect_violation($$insert into content.releases (id, content_date, manifest_sha256, is_current) values
  ('2026-10-20.1', '2026-10-20', repeat('a', 64), true), ('2026-10-20.2', '2026-10-20', repeat('b', 64), true)$$, 'releases_single_current');

-- 8. Deletion removes every row for the session and completes the request.
set local role service_role;
insert into telemetry.consents (session_id, tier, notice_version, teen_assent, deletion_code_hash, consented_at)
  values ('30000000-0000-4000-8000-000000000001', 2, 'v', true, repeat('f', 64), now());
insert into telemetry.events (event_id, session_id, seq, type, occurred_at, actor) values (gen_random_uuid(), '30000000-0000-4000-8000-000000000001', 0, 'reveal_viewed', now(), 'teen');
insert into telemetry.item_responses (session_id, arm, item_values, area_scores, flags, parent_present, device_class, class_year, board, subjects, city_tier)
  values ('30000000-0000-4000-8000-000000000001', 'plain', array_fill(2::smallint, array[60]), '{}', '{}', 'no', 'mid', 11, 'CBSE', '{english,physics,chemistry,mathematics}', 'metro');
insert into telemetry.coverage_requests (session_id, kind, label) values ('30000000-0000-4000-8000-000000000001', 'country', 'France');
insert into telemetry.feedback (session_id, answers) values ('30000000-0000-4000-8000-000000000001', '{"recommend": 9}');
insert into telemetry.deletion_requests (session_id) values ('30000000-0000-4000-8000-000000000001');
select telemetry.delete_session('30000000-0000-4000-8000-000000000001');
reset role;
do $$ begin
  if exists (select 1 from telemetry.consents where session_id = '30000000-0000-4000-8000-000000000001')
     or exists (select 1 from telemetry.events where session_id = '30000000-0000-4000-8000-000000000001')
     or exists (select 1 from telemetry.item_responses where session_id = '30000000-0000-4000-8000-000000000001')
     or exists (select 1 from telemetry.coverage_requests where session_id = '30000000-0000-4000-8000-000000000001')
     or exists (select 1 from telemetry.feedback where session_id = '30000000-0000-4000-8000-000000000001')
     or exists (select 1 from telemetry.sessions where id = '30000000-0000-4000-8000-000000000001') then
    raise exception 'delete_session left rows behind';
  end if;
  if exists (select 1 from telemetry.deletion_requests where completed_at is null) then
    raise exception 'deletion request not marked complete';
  end if;
end $$;

rollback;
\echo 'db tests: all passed'
