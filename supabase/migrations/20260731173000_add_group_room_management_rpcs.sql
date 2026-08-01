begin;

create or replace function public.list_learning_rooms(p_organization_id uuid)
returns table (id uuid, room_name text, memo text, active boolean, member_count bigint, created_at timestamptz)
language sql security definer set search_path = '' as $$
  with allowed as (select public.require_learning_org_admin_(p_organization_id))
  select r.id, r.room_name, r.memo, r.active,
    count(rm.member_id) as member_count, r.created_at
  from public.learning_rooms r
  left join public.learning_room_members rm on rm.room_id = r.id
  cross join allowed
  where r.organization_id = p_organization_id
  group by r.id
  order by r.active desc, lower(r.room_name);
$$;

create or replace function public.list_learning_room_members(p_room_id uuid)
returns table (member_id uuid, member_name text, registration_number integer, memo text, active boolean)
language sql security definer set search_path = '' as $$
  with room as (select organization_id from public.learning_rooms where id = p_room_id),
  allowed as (select public.require_learning_org_admin_(organization_id) from room)
  select m.id, m.member_name, m.registration_number, m.memo, m.active
  from public.learning_room_members rm
  join public.learning_organization_members m on m.id = rm.member_id
  cross join allowed
  where rm.room_id = p_room_id
  order by m.registration_number nulls last, lower(m.member_name);
$$;

create or replace function public.remove_learning_room_member(p_room_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare org_id uuid;
begin
  select organization_id into org_id from public.learning_rooms where id = p_room_id;
  if org_id is null then raise exception 'The room was not found.'; end if;
  perform public.require_learning_org_admin_(org_id);
  delete from public.learning_room_members where room_id = p_room_id and member_id = p_member_id;
end;
$$;

grant execute on function public.list_learning_rooms(uuid) to authenticated;
grant execute on function public.list_learning_room_members(uuid) to authenticated;
grant execute on function public.remove_learning_room_member(uuid, uuid) to authenticated;

commit;
