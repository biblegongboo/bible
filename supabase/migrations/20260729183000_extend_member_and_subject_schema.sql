begin;

alter table public.member_profiles
  add column if not exists amount numeric,
  add column if not exists payment_date timestamptz,
  add column if not exists last_login timestamptz,
  add column if not exists memo text,
  add column if not exists max_sessions integer not null default 1
    check (max_sessions > 0);

create table if not exists public.study_subjects (
  code text primary key,
  name text not null,
  category text,
  sheet_name text,
  set_size integer not null default 120 check (set_size > 0),
  data_format text,
  active boolean not null default true,
  version text,
  question_count integer not null default 0 check (question_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.study_subjects enable row level security;

grant select on public.study_subjects to authenticated;
grant select, insert, update, delete on public.study_subjects to service_role;

create policy "Authenticated members can read study subjects"
  on public.study_subjects
  for select
  to authenticated
  using (true);

commit;
