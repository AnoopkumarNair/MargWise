-- Hardening from the independent review of PR #1.
--   #5  Two-person rule (05 §8): critical changes need the stream reviewer AND
--       the owner; low-severity changes are the owner's; decisions only on
--       pending tasks; one decision per person per task.
--   #10 Rule 2 evidence: provenance.snapshot_id must reference a real snapshot;
--       a sourced provenance row cannot be downgraded while sourced-only facts
--       use it; O*NET vectors need sourced provenance.
--   #14 Forbidden sources checked on the parsed host (trailing dots, userinfo,
--       regional Glassdoor domains), mirroring isForbiddenSource() in contracts.
--
-- Reversible: yes. Down: restore policy review_decisions_insert and
-- private.apply_review_decision() from 20261020000004; drop the triggers,
-- functions and constraints created here; restore provenance_not_forbidden_source.

-- #10 snapshot FK (pipeline is created after content, hence here).
alter table content.provenance
  add constraint provenance_snapshot_fk foreign key (snapshot_id) references pipeline.snapshots (id) on delete restrict;

-- #10 O*NET vectors: sourced provenance whenever a vector is present.
create or replace function private.require_sourced_provenance_if_set() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provenance_id is not null
     and not exists (select 1 from content.provenance p where p.id = new.provenance_id and p.status = 'sourced') then
    raise exception '% requires sourced provenance', tg_table_name using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger career_onet_map_require_sourced before insert or update on content.career_onet_map
  for each row execute function private.require_sourced_provenance_if_set();

-- #10 no downgrade of provenance that sourced-only facts depend on.
create or replace function private.guard_provenance_downgrade() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'sourced' and new.status <> 'sourced' and (
       exists (select 1 from content.gates g where g.provenance_id = old.id)
    or exists (select 1 from content.cutoffs c where c.provenance_id = old.id)
    or exists (select 1 from content.subjects s where s.provenance_id = old.id)
    or exists (select 1 from content.career_onet_map m where m.provenance_id = old.id)
  ) then
    raise exception 'provenance % is used by sourced-only facts and cannot become an assumption', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger provenance_guard_downgrade before update on content.provenance
  for each row execute function private.guard_provenance_downgrade();

-- #14 forbidden source host check.
create or replace function private.is_forbidden_source(p_url text) returns boolean
language sql immutable
set search_path = ''
as $$
  with h as (
    select rtrim(lower(substring(p_url from '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/?#@]*@)?([^/:?#]+)')), '.') as host
  )
  select host is null
      or host ~ '(^|\.)(linkedin\.com|lnkd\.in|glassdoor\.com|glassdoor\.co\.in|ambitionbox\.com|naukri\.com|reddit\.com|redd\.it|quora\.com)$'
      or host ~ '(^|\.)(glassdoor|ambitionbox|naukri|linkedin|quora|reddit)(\.[a-z]{1,3}){1,2}$'
  from h;
$$;
alter table content.provenance drop constraint provenance_not_forbidden_source;
alter table content.provenance
  add constraint provenance_not_forbidden_source check (source_url is null or not private.is_forbidden_source(source_url));

-- #5 two-person rule.
drop policy review_decisions_insert on pipeline.review_decisions;
create policy review_decisions_insert on pipeline.review_decisions
  for insert to authenticated
  with check (
    reviewer = (select auth.uid())
    and exists (
      select 1 from pipeline.review_tasks t
       where t.id = task_id
         and t.status = 'pending'
         and case when t.severity = 'low' then (select private.studio_role()) = 'owner'
                  else (select private.can_review(t.stream)) end
    )
  );
-- One decision per person per task (a constraint, not a policy subquery,
-- which would recurse into this table's own policies).
alter table pipeline.review_decisions add constraint review_decisions_one_per_reviewer unique (task_id, reviewer);

create or replace function private.apply_review_decision() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  t pipeline.review_tasks%rowtype;
  owner_ok boolean;
  stream_ok boolean;
  any_edit boolean;
begin
  select * into t from pipeline.review_tasks where id = new.task_id for update;
  if t.status <> 'pending' then
    raise exception 'task % is already %', t.id, t.status using errcode = 'check_violation';
  end if;

  if new.decision = 'reject' then
    update pipeline.review_tasks set status = 'rejected', updated_at = now() where id = t.id;
    return new;
  end if;

  if t.severity = 'critical' then
    select
      bool_or(m.role = 'owner'),
      bool_or(m.role = 'reviewer' and t.stream = any (m.streams)),
      bool_or(d.decision = 'edit')
      into owner_ok, stream_ok, any_edit
      from pipeline.review_decisions d
      join private.studio_members m on m.user_id = d.reviewer
     where d.task_id = t.id and d.decision in ('approve', 'edit');
    if not (coalesce(owner_ok, false) and coalesce(stream_ok, false)) then
      return new; -- still waiting for the second person
    end if;
  else
    any_edit := new.decision = 'edit';
  end if;

  update pipeline.review_tasks
     set status = case when any_edit then 'edited'::pipeline.review_status else 'approved'::pipeline.review_status end,
         updated_at = now()
   where id = t.id;
  return new;
end;
$$;
revoke all on function private.apply_review_decision() from public, anon, authenticated;
