begin;

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  phone text,
  account_type text not null default 'personal'
    check (account_type in ('personal', 'admin')),
  payment_status text not null default 'trial',
  expired_date date,
  access_subjects jsonb not null default '["BIBLE_OT","BIBLE_NT"]'::jsonb,
  is_trial boolean not null default true,
  trial_start integer not null default 1 check (trial_start > 0),
  trial_limit integer not null default 20 check (trial_limit > 0),
  set_size integer not null default 120 check (set_size > 0),
  active boolean not null default true,
  legacy_source text,
  legacy_row_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_profiles_email_idx
  on public.member_profiles (lower(email));
create index if not exists member_profiles_status_idx
  on public.member_profiles (active, account_type, payment_status, expired_date);

create or replace function public.handle_new_bible_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_profiles (
    id,
    email,
    display_name,
    phone
  )
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_bible_auth_user_created on auth.users;
create trigger on_bible_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_bible_member();

create or replace function public.touch_member_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_member_profile_updated_at
  on public.member_profiles;
create trigger touch_member_profile_updated_at
  before update on public.member_profiles
  for each row execute procedure public.touch_member_profile_updated_at();

alter table public.member_profiles enable row level security;

revoke all on public.member_profiles from anon, authenticated;
grant select on public.member_profiles to authenticated;
grant select, insert, update, delete on public.member_profiles to service_role;

create policy "Members can read their own profile"
  on public.member_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.get_my_bible_membership()
returns table (
  id uuid,
  email text,
  display_name text,
  phone text,
  account_type text,
  payment_status text,
  expired_date date,
  access_subjects jsonb,
  is_trial boolean,
  trial_start integer,
  trial_limit integer,
  set_size integer,
  active boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.email,
    p.display_name,
    p.phone,
    p.account_type,
    p.payment_status,
    p.expired_date,
    p.access_subjects,
    p.is_trial,
    p.trial_start,
    p.trial_limit,
    p.set_size,
    p.active
  from public.member_profiles p
  where p.id = (select auth.uid());
$$;

grant execute on function public.get_my_bible_membership() to authenticated;

create or replace function public.update_my_bible_profile(
  new_display_name text,
  new_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_profiles
  set
    display_name = nullif(trim(new_display_name), ''),
    phone = nullif(trim(new_phone), '')
  where id = (select auth.uid());
end;
$$;

grant execute on function public.update_my_bible_profile(text, text)
  to authenticated;

commit;
