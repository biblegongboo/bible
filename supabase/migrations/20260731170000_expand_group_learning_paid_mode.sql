begin;

-- Paid organization learning foundation.  A member occupies one organization
-- seat and may join more than one room without consuming another seat.

alter table public.learning_organizations
  add column if not exists room_limit integer not null default 5
    check (room_limit between 1 and 100),
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'suspended', 'expired')),
  add column if not exists subscription_ends_at timestamptz;

alter table public.learning_organization_members
  add column if not exists registration_number integer,
  add column if not exists login_email text,
  add column if not exists password_reset_required boolean not null default false;

create unique index if not exists learning_organization_members_registration_unique
  on public.learning_organization_members (organization_id, registration_number)
  where registration_number is not null;
create unique index if not exists learning_organization_members_login_email_unique
  on public.learning_organization_members (lower(login_email))
  where login_email is not null;

create table if not exists public.learning_organization_admins (
  organization_id uuid not null references public.learning_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists learning_organization_admins_user_idx
  on public.learning_organization_admins (user_id, active);

create table if not exists public.learning_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.learning_organizations(id) on delete cascade,
  room_name text not null,
  memo text not null default '',
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists learning_rooms_name_unique
  on public.learning_rooms (organization_id, lower(room_name));
create index if not exists learning_rooms_org_idx
  on public.learning_rooms (organization_id, active, created_at);
drop trigger if exists touch_learning_room_updated_at on public.learning_rooms;
create trigger touch_learning_room_updated_at before update on public.learning_rooms
  for each row execute procedure public.touch_learning_organization_updated_at();

create table if not exists public.learning_room_members (
  room_id uuid not null references public.learning_rooms(id) on delete cascade,
  member_id uuid not null references public.learning_organization_members(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, member_id)
);
create index if not exists learning_room_members_member_idx
  on public.learning_room_members (member_id, room_id);

create table if not exists public.learning_exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.learning_organizations(id) on delete cascade,
  room_id uuid not null references public.learning_rooms(id) on delete restrict,
  title text not null,
  instructions text not null default '',
  subject_code text not null default 'BIBLE_OT',
  question_start integer,
  question_end integer,
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes between 1 and 600),
  opens_at timestamptz,
  closes_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (question_start is null or question_start >= 1),
  check (question_end is null or question_end >= question_start)
);
create index if not exists learning_exams_room_status_idx
  on public.learning_exams (room_id, status, opens_at, closes_at);
drop trigger if exists touch_learning_exam_updated_at on public.learning_exams;
create trigger touch_learning_exam_updated_at before update on public.learning_exams
  for each row execute procedure public.touch_learning_organization_updated_at();

create table if not exists public.learning_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.learning_exams(id) on delete cascade,
  member_id uuid not null references public.learning_organization_members(id) on delete restrict,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  correct_count integer not null default 0 check (correct_count >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  score numeric(5,2),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded', 'void')),
  unique (exam_id, member_id)
);
create index if not exists learning_exam_attempts_member_idx
  on public.learning_exam_attempts (member_id, submitted_at desc);
create index if not exists learning_exam_attempts_exam_idx
  on public.learning_exam_attempts (exam_id, status, submitted_at desc);

create table if not exists public.learning_exam_answers (
  attempt_id uuid not null references public.learning_exam_attempts(id) on delete cascade,
  question_number integer not null check (question_number >= 1),
  selected_answer smallint check (selected_answer between 1 and 4),
  is_correct boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_number)
);

alter table public.learning_organization_admins enable row level security;
alter table public.learning_rooms enable row level security;
alter table public.learning_room_members enable row level security;
alter table public.learning_exams enable row level security;
alter table public.learning_exam_attempts enable row level security;
alter table public.learning_exam_answers enable row level security;
revoke all on public.learning_organization_admins, public.learning_rooms, public.learning_room_members,
  public.learning_exams, public.learning_exam_attempts, public.learning_exam_answers from anon, authenticated;
grant select, insert, update, delete on public.learning_organization_admins, public.learning_rooms,
  public.learning_room_members, public.learning_exams, public.learning_exam_attempts,
  public.learning_exam_answers to service_role;

create or replace function public.require_learning_org_admin_(p_organization_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.member_profiles
    where id = current_user_id and active = true and account_type = 'admin'
  ) or exists (
    select 1 from public.learning_organization_admins
    where organization_id = p_organization_id and user_id = current_user_id and active = true
  ) then
    return current_user_id;
  end if;
  raise exception 'Organization administrator access is required.' using errcode = '42501';
end;
$$;

create or replace function public.create_learning_room(
  p_organization_id uuid, p_room_name text, p_memo text default ''
)
returns public.learning_rooms language plpgsql security definer set search_path = '' as $$
declare created public.learning_rooms;
declare allowed_rooms integer;
declare active_rooms integer;
declare actor uuid;
begin
  actor := public.require_learning_org_admin_(p_organization_id);
  select room_limit into allowed_rooms from public.learning_organizations
    where id = p_organization_id and active = true and subscription_status in ('trial', 'active');
  if allowed_rooms is null then raise exception 'The organization is unavailable.'; end if;
  select count(*) into active_rooms from public.learning_rooms
    where organization_id = p_organization_id and active = true;
  if active_rooms >= allowed_rooms then raise exception 'The organization room limit has been reached.'; end if;
  insert into public.learning_rooms (organization_id, room_name, memo, created_by)
  values (p_organization_id, nullif(trim(p_room_name), ''), coalesce(p_memo, ''), actor)
  returning * into created;
  return created;
end;
$$;

create or replace function public.archive_learning_room(p_room_id uuid)
returns public.learning_rooms language plpgsql security definer set search_path = '' as $$
declare updated public.learning_rooms;
begin
  select * into updated from public.learning_rooms where id = p_room_id;
  if updated.id is null then raise exception 'The room was not found.'; end if;
  perform public.require_learning_org_admin_(updated.organization_id);
  update public.learning_rooms set active = false, archived_at = now() where id = p_room_id returning * into updated;
  return updated;
end;
$$;

create or replace function public.assign_learning_room_member(p_room_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare org_id uuid;
begin
  select organization_id into org_id from public.learning_rooms where id = p_room_id and active = true;
  if org_id is null then raise exception 'The room is unavailable.'; end if;
  perform public.require_learning_org_admin_(org_id);
  if not exists (select 1 from public.learning_organization_members where id = p_member_id and organization_id = org_id and active = true) then
    raise exception 'The member does not belong to this organization.';
  end if;
  insert into public.learning_room_members (room_id, member_id) values (p_room_id, p_member_id) on conflict do nothing;
end;
$$;

grant execute on function public.create_learning_room(uuid, text, text) to authenticated;
grant execute on function public.archive_learning_room(uuid) to authenticated;
grant execute on function public.assign_learning_room_member(uuid, uuid) to authenticated;

commit;
