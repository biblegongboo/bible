begin;

alter table public.learning_organization_members
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists learning_organization_members_auth_user_idx
  on public.learning_organization_members (auth_user_id)
  where auth_user_id is not null;

drop function if exists public.list_learning_organization_members(uuid);

create function public.list_learning_organization_members(p_organization_id uuid)
returns table (id uuid, member_name text, memo text, active boolean, auth_ready boolean, created_at timestamptz)
language sql security definer set search_path = '' as $$
  with allowed as (select public.require_bible_admin_())
  select m.id, m.member_name, m.memo, m.active, (m.auth_user_id is not null) as auth_ready, m.created_at
  from public.learning_organization_members m cross join allowed
  where m.organization_id = p_organization_id
  order by lower(m.member_name);
$$;

grant execute on function public.list_learning_organization_members(uuid) to authenticated;

commit;
