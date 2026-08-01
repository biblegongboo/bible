begin;

-- System deletion is a recoverable deactivation. Keep records but hide it
-- from the live system-administrator list.
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
  where o.active = true
  group by o.id
  order by lower(o.organization_name);
$$;
grant execute on function public.list_learning_organizations() to authenticated;

commit;
