begin;

create table if not exists public.learning_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  seat_limit integer not null default 30 check (seat_limit between 1 and 100000),
  memo text not null default '',
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists learning_organizations_name_unique
  on public.learning_organizations (lower(organization_name));

create table if not exists public.learning_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.learning_organizations(id) on delete cascade,
  member_name text not null,
  memo text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists learning_organization_members_name_unique
  on public.learning_organization_members (organization_id, lower(member_name));
create index if not exists learning_organization_members_org_idx
  on public.learning_organization_members (organization_id, active, created_at);

create or replace function public.touch_learning_organization_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_learning_organization_updated_at on public.learning_organizations;
create trigger touch_learning_organization_updated_at
  before update on public.learning_organizations
  for each row execute procedure public.touch_learning_organization_updated_at();

drop trigger if exists touch_learning_organization_member_updated_at on public.learning_organization_members;
create trigger touch_learning_organization_member_updated_at
  before update on public.learning_organization_members
  for each row execute procedure public.touch_learning_organization_updated_at();

alter table public.learning_organizations enable row level security;
alter table public.learning_organization_members enable row level security;
revoke all on public.learning_organizations, public.learning_organization_members from anon, authenticated;
grant select, insert, update, delete on public.learning_organizations, public.learning_organization_members to service_role;

create or replace function public.require_bible_admin_()
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not exists (
    select 1 from public.member_profiles
    where id = current_user_id and active = true and account_type = 'admin'
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return current_user_id;
end;
$$;

create or replace function public.list_learning_organizations()
returns table (
  id uuid, organization_name text, seat_limit integer, memo text, active boolean,
  member_count bigint, created_at timestamptz
)
language sql security definer set search_path = '' as $$
  with allowed as (select public.require_bible_admin_())
  select o.id, o.organization_name, o.seat_limit, o.memo, o.active,
    count(m.id) filter (where m.active) as member_count, o.created_at
  from public.learning_organizations o
  left join public.learning_organization_members m on m.organization_id = o.id
  cross join allowed
  group by o.id
  order by lower(o.organization_name);
$$;

create or replace function public.create_learning_organization(
  p_organization_name text, p_seat_limit integer default 30, p_memo text default ''
)
returns public.learning_organizations
language plpgsql security definer set search_path = '' as $$
declare created public.learning_organizations;
begin
  insert into public.learning_organizations (organization_name, seat_limit, memo, created_by)
  values (nullif(trim(p_organization_name), ''), greatest(1, least(coalesce(p_seat_limit, 30), 100000)), coalesce(p_memo, ''), public.require_bible_admin_())
  returning * into created;
  return created;
end;
$$;

create or replace function public.list_learning_organization_members(p_organization_id uuid)
returns table (id uuid, member_name text, memo text, active boolean, created_at timestamptz)
language sql security definer set search_path = '' as $$
  with allowed as (select public.require_bible_admin_())
  select m.id, m.member_name, m.memo, m.active, m.created_at
  from public.learning_organization_members m cross join allowed
  where m.organization_id = p_organization_id
  order by lower(m.member_name);
$$;

create or replace function public.add_learning_organization_member(
  p_organization_id uuid, p_member_name text, p_memo text default ''
)
returns public.learning_organization_members
language plpgsql security definer set search_path = '' as $$
declare added public.learning_organization_members;
declare allowed_seats integer;
declare active_members integer;
begin
  perform public.require_bible_admin_();
  select seat_limit into allowed_seats from public.learning_organizations where id = p_organization_id and active = true;
  if allowed_seats is null then raise exception 'The organization is unavailable.'; end if;
  select count(*) into active_members from public.learning_organization_members where organization_id = p_organization_id and active = true;
  if active_members >= allowed_seats then raise exception 'The organization seat limit has been reached.'; end if;
  insert into public.learning_organization_members (organization_id, member_name, memo)
  values (p_organization_id, nullif(trim(p_member_name), ''), coalesce(p_memo, ''))
  returning * into added;
  return added;
end;
$$;

create or replace function public.update_learning_organization_member(
  p_member_id uuid, p_member_name text, p_memo text, p_active boolean
)
returns public.learning_organization_members
language plpgsql security definer set search_path = '' as $$
declare updated public.learning_organization_members;
begin
  perform public.require_bible_admin_();
  update public.learning_organization_members
  set member_name = nullif(trim(p_member_name), ''), memo = coalesce(p_memo, ''), active = coalesce(p_active, true)
  where id = p_member_id returning * into updated;
  if updated.id is null then raise exception 'The member was not found.'; end if;
  return updated;
end;
$$;

grant execute on function public.list_learning_organizations() to authenticated;
grant execute on function public.create_learning_organization(text, integer, text) to authenticated;
grant execute on function public.list_learning_organization_members(uuid) to authenticated;
grant execute on function public.add_learning_organization_member(uuid, text, text) to authenticated;
grant execute on function public.update_learning_organization_member(uuid, text, text, boolean) to authenticated;

commit;
