begin;

-- System administrators provision organizations. Organization administrators
-- are limited to the organizations explicitly assigned to them.
drop function if exists public.list_learning_organization_members(uuid);
create function public.list_learning_organization_members(p_organization_id uuid)
returns table (id uuid, member_name text, login_email text, registration_number integer, memo text, active boolean, auth_ready boolean, created_at timestamptz)
language sql security definer set search_path = '' as $$
  with allowed as (select public.require_learning_org_admin_(p_organization_id))
  select m.id, m.member_name, m.login_email, m.registration_number, m.memo, m.active, (m.auth_user_id is not null), m.created_at
  from public.learning_organization_members m cross join allowed
  where m.organization_id = p_organization_id
  order by m.registration_number nulls last, lower(m.member_name);
$$;
grant execute on function public.list_learning_organization_members(uuid) to authenticated;

create or replace function public.list_my_learning_organizations()
returns table (id uuid, organization_name text, seat_limit integer, member_count bigint, room_limit integer)
language sql security definer set search_path = '' as $$
  select o.id, o.organization_name, o.seat_limit,
    (select count(*) from public.learning_organization_members m where m.organization_id=o.id and m.active), o.room_limit
  from public.learning_organizations o
  where o.active and (exists(select 1 from public.member_profiles p where p.id=auth.uid() and p.active and p.account_type='admin')
    or exists(select 1 from public.learning_organization_admins a where a.organization_id=o.id and a.user_id=auth.uid() and a.active))
  order by lower(o.organization_name);
$$;
grant execute on function public.list_my_learning_organizations() to authenticated;

commit;
