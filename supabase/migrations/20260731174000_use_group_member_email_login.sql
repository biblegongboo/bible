begin;

drop function if exists public.list_learning_organization_members(uuid);

create function public.list_learning_organization_members(p_organization_id uuid)
returns table (
  id uuid,
  member_name text,
  login_email text,
  registration_number integer,
  memo text,
  active boolean,
  auth_ready boolean,
  created_at timestamptz
)
language sql security definer set search_path = '' as $$
  with allowed as (select public.require_bible_admin_())
  select m.id, m.member_name, m.login_email, m.registration_number, m.memo,
    m.active, (m.auth_user_id is not null) as auth_ready, m.created_at
  from public.learning_organization_members m cross join allowed
  where m.organization_id = p_organization_id
  order by m.registration_number nulls last, lower(m.member_name);
$$;

grant execute on function public.list_learning_organization_members(uuid) to authenticated;

commit;
