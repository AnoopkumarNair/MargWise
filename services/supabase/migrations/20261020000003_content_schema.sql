-- content schema (04 §7). Every fact row references a provenance record.
-- Ranges carry low ≤ likely ≤ high checks so the release gate (05 §9) is
-- also enforced by the database. Writes come from the pipeline (service role)
-- and Studio review RPCs; Studio members may read. Families never read these
-- tables: they get immutable release bundles from Storage.
--
-- Reversible: yes. Down: drop every table in schema content (cascade) and the enums below.

create type content.provenance_status as enum ('sourced', 'assumption');
create type content.confidence as enum ('high', 'medium', 'low');
create type content.cluster_id as enum ('psychology', 'tech-ai', 'commerce-business', 'design', 'law');
create type content.gate_status as enum ('OPEN', 'BRIDGE', 'LOCKED');
create type content.policy_status as enum ('proposed', 'announced', 'in_force', 'amended', 'suspended_or_blocked', 'withdrawn');
create type content.exam_date_status as enum ('official', 'expected');

create table content.provenance (
  id uuid primary key default gen_random_uuid(),
  status content.provenance_status not null,
  unit text not null check (unit ~ '^[a-z0-9_]+$'),
  as_of date not null,
  valid_to date,
  confidence content.confidence not null,
  source_url text,
  quote text,
  snapshot_id uuid,
  locator text,
  rationale text,
  reviewer uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provenance_valid_to_after_as_of check (valid_to is null or valid_to >= as_of),
  -- Rule 2: a sourced fact has an https URL, a verbatim quote and a snapshot.
  constraint provenance_sourced_evidence check (
    status <> 'sourced' or (
      source_url ~ '^https://' and length(btrim(coalesce(quote, ''))) > 0 and snapshot_id is not null
    )
  ),
  -- Rule 2: an assumption has a written rationale.
  constraint provenance_assumption_rationale check (
    status <> 'assumption' or length(btrim(coalesce(rationale, ''))) > 0
  ),
  -- Forbidden sources (05 §4); mirrors FORBIDDEN_SOURCE_DOMAINS in packages/contracts.
  constraint provenance_not_forbidden_source check (
    source_url is null or source_url !~* '^https://([a-z0-9-]+\.)*(linkedin\.com|lnkd\.in|glassdoor\.com|glassdoor\.co\.in|ambitionbox\.com|naukri\.com|reddit\.com|redd\.it|quora\.com)(/|:|$)'
  )
);
create index provenance_snapshot_id_idx on content.provenance (snapshot_id);
create index provenance_valid_to_idx on content.provenance (valid_to) where valid_to is not null;

create table content.clusters (
  id content.cluster_id primary key,
  title text not null,
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table content.careers (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cluster_id content.cluster_id not null references content.clusters (id),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index careers_cluster_id_idx on content.careers (cluster_id);

create table content.career_onet_map (
  career_id text not null references content.careers (id) on delete cascade,
  onet_soc text not null check (onet_soc ~ '^\d{2}-\d{4}\.\d{2}$'),
  onet_release text not null,
  note text,
  -- O*NET OI ratings 1.B.1.a–f (rule 3: only from the Interests file).
  oi_r numeric(3, 2) check (oi_r between 1 and 7),
  oi_i numeric(3, 2) check (oi_i between 1 and 7),
  oi_a numeric(3, 2) check (oi_a between 1 and 7),
  oi_s numeric(3, 2) check (oi_s between 1 and 7),
  oi_e numeric(3, 2) check (oi_e between 1 and 7),
  oi_c numeric(3, 2) check (oi_c between 1 and 7),
  provenance_id uuid references content.provenance (id),
  primary key (career_id, onet_soc),
  constraint career_onet_vector_complete check (
    num_nulls(oi_r, oi_i, oi_a, oi_s, oi_e, oi_c) in (0, 6)
    and (oi_r is null or provenance_id is not null)
  )
);
create index career_onet_map_provenance_idx on content.career_onet_map (provenance_id);

create table content.dossier_sections (
  career_id text not null references content.careers (id) on delete cascade,
  kind text not null check (kind in (
    'the_work', 'career_ladder', 'where_they_work', 'routes', 'eligibility_gates', 'licensing', 'colleges',
    'skills', 'ai_exposure', 'abroad', 'quests', 'honest_notes', 'sources'
  )),
  body text not null check (length(body) > 0),
  source_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (career_id, kind)
);

create table content.career_levels (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references content.careers (id) on delete cascade,
  level_order smallint not null check (level_order between 1 and 5),
  title text not null,
  typical_years_from numeric(4, 1) not null check (typical_years_from >= 0),
  typical_years_to numeric(4, 1) not null,
  country char(2) not null default 'IN',
  stage text check (stage in ('entry', 'mid')),
  pay_p10 numeric(14, 2) not null check (pay_p10 >= 0),
  pay_p50 numeric(14, 2) not null,
  pay_p90 numeric(14, 2) not null,
  currency char(3) not null,
  provenance_id uuid not null references content.provenance (id),
  constraint career_levels_years check (typical_years_to >= typical_years_from),
  constraint career_levels_percentiles check (pay_p10 <= pay_p50 and pay_p50 <= pay_p90),
  unique (career_id, level_order, country)
);
create index career_levels_provenance_idx on content.career_levels (provenance_id);

create table content.routes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  career_id text not null references content.careers (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('main', 'backup', 'adjacent'))
);
create index routes_career_id_idx on content.routes (career_id);

create table content.route_stages (
  route_id text not null references content.routes (id) on delete cascade,
  stage_order smallint not null check (stage_order >= 1),
  kind text not null check (kind in ('ug', 'pg', 'bridge', 'professional', 'exam', 'internship', 'registration')),
  title text not null,
  duration_years numeric(3, 1) not null check (duration_years > 0),
  entrance_tests text[] not null default '{}',
  country char(2) not null,
  official_url text check (official_url ~ '^https://'),
  provenance_id uuid not null references content.provenance (id),
  primary key (route_id, stage_order)
);
create index route_stages_provenance_idx on content.route_stages (provenance_id);

create table content.gates (
  route_id text not null references content.routes (id) on delete cascade,
  subject_combination text not null check (subject_combination in (
    'pcm', 'pcb', 'pcmb', 'commerce-maths', 'commerce', 'humanities-maths', 'humanities'
  )),
  status content.gate_status not null,
  reason text not null check (length(btrim(reason)) > 0),
  provenance_id uuid not null references content.provenance (id),
  primary key (route_id, subject_combination)
);
create index gates_provenance_idx on content.gates (provenance_id);

-- Eligibility is never assumed (mirrors Gate in packages/contracts).
create or replace function private.require_sourced_provenance() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from content.provenance p where p.id = new.provenance_id and p.status = 'sourced') then
    raise exception '% requires sourced provenance', tg_table_name using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger gates_require_sourced before insert or update on content.gates
  for each row execute function private.require_sourced_provenance();

create table content.institutions (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  type text not null check (type in ('public', 'private')),
  city_id text not null,
  country char(2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table content.programmes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  institution_id text not null references content.institutions (id) on delete cascade,
  course_code text not null,
  normalised_code text not null,
  campus text not null,
  name text not null,
  department text,
  year smallint not null check (year between 2000 and 2100),
  intake integer check (intake >= 0),
  intake_provenance_id uuid references content.provenance (id),
  status text not null check (status in ('active', 'dropped', 'new')),
  entrance_tests text[] not null default '{}',
  -- Programme registry key (05 §5.2).
  unique (institution_id, normalised_code, campus, year),
  constraint programmes_intake_sourced check (intake is null or intake_provenance_id is not null)
);
create index programmes_course_code_idx on content.programmes (course_code, year);
create index programmes_intake_provenance_idx on content.programmes (intake_provenance_id);

create table content.programme_fees (
  programme_id text not null references content.programmes (id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  -- NULL = "not reported" (01 §5.2), never zero-filled.
  annual_inr numeric(12, 2) check (annual_inr >= 0),
  provenance_id uuid references content.provenance (id),
  primary key (programme_id, year),
  constraint programme_fees_reported_has_source check (annual_inr is null or provenance_id is not null)
);
create index programme_fees_provenance_idx on content.programme_fees (provenance_id);

create table content.cutoffs (
  programme_id text not null references content.programmes (id) on delete cascade,
  year smallint not null,
  round smallint not null check (round >= 1),
  quota text not null,
  category text not null,
  seat_pool text not null,
  opening_rank integer not null check (opening_rank > 0),
  closing_rank integer not null,
  provenance_id uuid not null references content.provenance (id),
  primary key (programme_id, year, round, quota, category, seat_pool),
  constraint cutoffs_rank_order check (opening_rank <= closing_rank)
);
create index cutoffs_provenance_idx on content.cutoffs (provenance_id);
create trigger cutoffs_require_sourced before insert or update on content.cutoffs
  for each row execute function private.require_sourced_provenance();

create table content.nirf_metrics (
  institution_id text not null references content.institutions (id) on delete cascade,
  year smallint not null check (year >= 2016),
  metric text not null check (metric in ('rank', 'band', 'median_salary_ug', 'median_salary_pg', 'intake', 'placement_rate')),
  value_numeric numeric,
  value_text text,
  provenance_id uuid references content.provenance (id),
  primary key (institution_id, year, metric),
  constraint nirf_value_single check (num_nonnulls(value_numeric, value_text) <= 1),
  constraint nirf_reported_has_source check (num_nonnulls(value_numeric, value_text) = 0 or provenance_id is not null)
);
create index nirf_metrics_provenance_idx on content.nirf_metrics (provenance_id);

create table content.cities (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  tier text not null check (tier in ('metro', 'tier-2', 'tier-3')),
  kind text not null check (kind in ('home', 'covered', 'other'))
);

create table content.city_costs (
  city_id text not null references content.cities (id) on delete cascade,
  item text not null check (item in ('rent_shared', 'food', 'transport', 'utilities', 'misc', 'health_cover', 'total')),
  low numeric(12, 2) not null,
  likely numeric(12, 2) not null,
  high numeric(12, 2) not null,
  provenance_id uuid not null references content.provenance (id),
  primary key (city_id, item),
  constraint city_costs_range check (low >= 0 and low <= likely and likely <= high)
);
create index city_costs_provenance_idx on content.city_costs (provenance_id);

create table content.countries (
  code char(2) primary key check (code in ('US', 'GB', 'DE', 'CA', 'AU', 'IE')),
  name text not null,
  currency char(3) not null check (currency in ('USD', 'GBP', 'EUR', 'CAD', 'AUD'))
);

create table content.country_costs (
  id uuid primary key default gen_random_uuid(),
  country char(2) not null references content.countries (code) on delete cascade,
  item text not null check (item in ('tuition_ug', 'tuition_pg', 'living', 'proof_of_funds', 'health_cover', 'visa_fee', 'travel', 'post_study_visa_fee')),
  field text,
  low numeric(12, 2) not null,
  likely numeric(12, 2) not null,
  high numeric(12, 2) not null,
  one_time boolean not null,
  provenance_id uuid not null references content.provenance (id),
  constraint country_costs_range check (low >= 0 and low <= likely and likely <= high)
);
create unique index country_costs_key on content.country_costs (country, item, coalesce(field, ''));
create index country_costs_provenance_idx on content.country_costs (provenance_id);

create table content.country_policies (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  country char(2) not null,
  title text not null,
  kind text not null check (kind in ('student_visa', 'post_study_work', 'work_visa', 'pr_route', 'fees', 'regulation')),
  status content.policy_status not null,
  effect jsonb not null check (jsonb_typeof(effect) = 'object' and effect ? 'kind'),
  updated_at timestamptz not null default now()
);
create index country_policies_country_idx on content.country_policies (country, status);

create table content.country_policy_transitions (
  policy_id text not null references content.country_policies (id) on delete cascade,
  status content.policy_status not null,
  on_date date not null,
  provenance_id uuid not null references content.provenance (id),
  primary key (policy_id, on_date, status)
);
create index country_policy_transitions_provenance_idx on content.country_policy_transitions (provenance_id);

create table content.career_country_fit (
  career_id text not null references content.careers (id) on delete cascade,
  country char(2) not null references content.countries (code) on delete cascade,
  on_shortage_list boolean,
  shortage_provenance_id uuid references content.provenance (id),
  common_route boolean not null,
  recognition_notes text not null,
  post_study_prospects text not null,
  primary key (career_id, country),
  constraint career_country_fit_shortage_sourced check (on_shortage_list is null or shortage_provenance_id is not null)
);
create index career_country_fit_country_idx on content.career_country_fit (country);
create index career_country_fit_provenance_idx on content.career_country_fit (shortage_provenance_id);

create table content.loan_schemes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lender text not null,
  title text not null,
  applies text not null check (applies in ('india', 'abroad', 'both')),
  -- Annual rate as a ratio (0.0690 = 6.90%).
  rate_low numeric(6, 5) not null,
  rate_likely numeric(6, 5) not null,
  rate_high numeric(6, 5) not null,
  rate_provenance_id uuid not null references content.provenance (id),
  terms jsonb not null default '{}' check (jsonb_typeof(terms) = 'object'),
  user_confirm_url text not null check (user_confirm_url ~ '^https://'),
  updated_at timestamptz not null default now(),
  constraint loan_schemes_rate_range check (rate_low >= 0 and rate_low <= rate_likely and rate_likely <= rate_high and rate_high <= 0.5)
);
create index loan_schemes_rate_provenance_idx on content.loan_schemes (rate_provenance_id);

create table content.tax_rules (
  tax_year text not null check (tax_year ~ '^\d{4}-\d{2}$'),
  regime text not null check (regime in ('new', 'old')),
  rules jsonb not null check (jsonb_typeof(rules) = 'object' and rules ? 'slabs'),
  provenance_id uuid not null references content.provenance (id),
  primary key (tax_year, regime)
);
create index tax_rules_provenance_idx on content.tax_rules (provenance_id);

create table content.ai_exposure (
  career_id text not null references content.careers (id) on delete cascade,
  lens text not null check (lens in ('ilo-2025', 'anthropic-economic-index')),
  release_label text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  provenance_id uuid not null references content.provenance (id),
  primary key (career_id, lens, release_label)
);
create index ai_exposure_provenance_idx on content.ai_exposure (provenance_id);

create table content.quests (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  career_id text not null references content.careers (id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
create index quests_career_id_idx on content.quests (career_id);

create table content.exam_calendar (
  exam_id text not null,
  event text not null check (event in ('registration_opens', 'registration_closes', 'exam', 'result', 'counselling', 'application_opens', 'application_closes')),
  event_date date not null,
  status content.exam_date_status not null,
  basis text,
  provenance_id uuid references content.provenance (id),
  primary key (exam_id, event, event_date),
  constraint exam_calendar_official_sourced check (status <> 'official' or provenance_id is not null),
  constraint exam_calendar_expected_basis check (status <> 'expected' or length(btrim(coalesce(basis, ''))) > 0)
);
create index exam_calendar_provenance_idx on content.exam_calendar (provenance_id);

create table content.releases (
  id text primary key check (id ~ '^\d{4}-\d{2}-\d{2}\.\d+$'),
  content_date date not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  is_current boolean not null default false,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now()
);
-- Exactly one current release at a time.
create unique index releases_single_current on content.releases (is_current) where is_current;

create table content.release_items (
  release_id text not null references content.releases (id) on delete cascade,
  entity text not null,
  entity_key text not null,
  provenance_id uuid references content.provenance (id),
  primary key (release_id, entity, entity_key)
);
create index release_items_provenance_idx on content.release_items (provenance_id);

-- updated_at triggers
create trigger provenance_touch before update on content.provenance for each row execute function private.touch_updated_at();
create trigger clusters_touch before update on content.clusters for each row execute function private.touch_updated_at();
create trigger careers_touch before update on content.careers for each row execute function private.touch_updated_at();
create trigger institutions_touch before update on content.institutions for each row execute function private.touch_updated_at();

-- RLS: deny by default; Studio members read; writes only via service role.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'content' loop
    execute format('alter table content.%I enable row level security', t.tablename);
    execute format('alter table content.%I force row level security', t.tablename);
    execute format(
      'create policy %I on content.%I for select to authenticated using ((select private.is_studio_member()))',
      t.tablename || '_studio_read', t.tablename
    );
  end loop;
end;
$$;
grant usage on schema content to authenticated;
grant select on all tables in schema content to authenticated;
