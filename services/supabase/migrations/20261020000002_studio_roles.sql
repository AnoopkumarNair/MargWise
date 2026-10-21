-- Studio roles (04 §5.3): owner, reviewer (per stream), viewer.
-- Membership lives in private.studio_members; policies call the helpers
-- below wrapped in (select …) so they are evaluated once per statement.
--
-- Reversible: yes. Down:
--   drop function if exists private.studio_role(), private.is_studio_member(), private.can_review(text);
--   drop table if exists private.studio_members; drop type if exists private.studio_role;

create type private.studio_role as enum ('owner', 'reviewer', 'viewer');

create table private.studio_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role private.studio_role not null,
  -- Streams a reviewer may decide on (01 §3). Owners may decide on all.
  streams text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_members_streams_known check (
    streams <@ array['psychology', 'tech-ai', 'commerce-business', 'design', 'law', 'finance', 'abroad', 'general']
  ),
  constraint studio_members_reviewer_has_stream check (role <> 'reviewer' or cardinality(streams) > 0)
);
alter table private.studio_members enable row level security;
create trigger studio_members_touch before update on private.studio_members
  for each row execute function private.touch_updated_at();

create or replace function private.studio_role() returns private.studio_role
language sql stable security definer
set search_path = ''
as $$
  select m.role from private.studio_members m where m.user_id = (select auth.uid());
$$;

create or replace function private.is_studio_member() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from private.studio_members m where m.user_id = (select auth.uid()));
$$;

create or replace function private.can_review(p_stream text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.studio_members m
    where m.user_id = (select auth.uid())
      and (m.role = 'owner' or (m.role = 'reviewer' and p_stream = any (m.streams)))
  );
$$;

revoke all on function private.studio_role(), private.is_studio_member(), private.can_review(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.studio_role(), private.is_studio_member(), private.can_review(text) to authenticated;
