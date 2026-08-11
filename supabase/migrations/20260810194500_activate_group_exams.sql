begin;

-- A small, server-scored exam layer.  The browser never receives answer keys
-- until submit_learning_exam() has finished grading the attempt.

create or replace function public.create_learning_exam(
  p_organization_id uuid,
  p_room_id uuid,
  p_title text,
  p_subject_code text,
  p_question_start integer,
  p_question_end integer,
  p_instructions text default '',
  p_time_limit_minutes integer default null,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_publish boolean default false
)
returns public.learning_exams
language plpgsql security definer set search_path = '' as $$
declare
  created public.learning_exams;
  actor uuid;
  normal_subject text := upper(trim(coalesce(p_subject_code, 'BIBLE_OT')));
  available_questions integer;
begin
  actor := public.require_learning_org_admin_(p_organization_id);
  if normal_subject not in ('BIBLE_OT', 'BIBLE_NT') then
    raise exception 'Choose BIBLE_OT or BIBLE_NT.';
  end if;
  if not exists (select 1 from public.learning_rooms where id = p_room_id and organization_id = p_organization_id and active) then
    raise exception 'Choose an active room belonging to this organization.';
  end if;
  if p_question_start is null or p_question_end is null or p_question_start < 1 or p_question_end < p_question_start then
    raise exception 'Enter a valid inclusive question-number range.';
  end if;
  if normal_subject = 'BIBLE_NT' then
    select count(*) into available_questions from public.bible_nt_questions where n between p_question_start and p_question_end;
  else
    select count(*) into available_questions from public.bible_questions where n between p_question_start and p_question_end;
  end if;
  if available_questions = 0 then
    raise exception 'No available questions were found in this range.';
  end if;
  insert into public.learning_exams (
    organization_id, room_id, title, instructions, subject_code, question_start,
    question_end, time_limit_minutes, opens_at, closes_at, status, created_by
  ) values (
    p_organization_id, p_room_id, nullif(trim(p_title), ''), coalesce(p_instructions, ''),
    normal_subject, p_question_start, p_question_end, p_time_limit_minutes,
    p_opens_at, p_closes_at, case when coalesce(p_publish, false) then 'published' else 'draft' end, actor
  ) returning * into created;
  return created;
end;
$$;

create or replace function public.list_learning_exams(p_organization_id uuid)
returns table (
  id uuid, room_id uuid, room_name text, title text, instructions text,
  subject_code text, question_start integer, question_end integer,
  question_count integer, time_limit_minutes integer, opens_at timestamptz,
  closes_at timestamptz, status text, created_at timestamptz,
  attempt_count bigint, graded_count bigint
)
language sql security definer set search_path = '' as $$
  select e.id, e.room_id, r.room_name, e.title, e.instructions, e.subject_code,
    e.question_start, e.question_end, coalesce(e.question_end - e.question_start + 1, 0),
    e.time_limit_minutes, e.opens_at, e.closes_at, e.status, e.created_at,
    count(a.id) as attempt_count,
    count(a.id) filter (where a.status = 'graded') as graded_count
  from public.learning_exams e
  join public.learning_rooms r on r.id = e.room_id
  left join public.learning_exam_attempts a on a.exam_id = e.id
  where e.organization_id = p_organization_id
    and public.require_learning_org_admin_(p_organization_id) is not null
  group by e.id, r.room_name
  order by e.created_at desc;
$$;

create or replace function public.list_my_learning_exams()
returns table (
  id uuid, organization_name text, room_name text, title text, instructions text,
  subject_code text, question_start integer, question_end integer,
  question_count integer, time_limit_minutes integer, opens_at timestamptz,
  closes_at timestamptz, status text, attempt_status text, score numeric,
  submitted_at timestamptz
)
language sql security definer set search_path = '' as $$
  select e.id, o.organization_name, r.room_name, e.title, e.instructions,
    e.subject_code, e.question_start, e.question_end,
    coalesce(e.question_end - e.question_start + 1, 0), e.time_limit_minutes,
    e.opens_at, e.closes_at, e.status, a.status, a.score, a.submitted_at
  from public.learning_exams e
  join public.learning_rooms r on r.id = e.room_id and r.active
  join public.learning_organizations o on o.id = e.organization_id and o.active
  join public.learning_room_members rm on rm.room_id = r.id
  join public.learning_organization_members m on m.id = rm.member_id and m.active
  left join public.learning_exam_attempts a on a.exam_id = e.id and a.member_id = m.id
  where m.auth_user_id = auth.uid() and e.status = 'published'
    and (e.opens_at is null or e.opens_at <= now())
    and (e.closes_at is null or e.closes_at >= now())
  order by e.opens_at nulls first, e.created_at desc;
$$;

create or replace function public.start_learning_exam(p_exam_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  exam public.learning_exams;
  learner public.learning_organization_members;
  attempt public.learning_exam_attempts;
  questions jsonb;
begin
  select * into exam from public.learning_exams where id = p_exam_id;
  if exam.id is null or exam.status <> 'published' or (exam.opens_at is not null and exam.opens_at > now()) or (exam.closes_at is not null and exam.closes_at < now()) then
    raise exception 'This test is not available.';
  end if;
  select m.* into learner from public.learning_organization_members m
  join public.learning_room_members rm on rm.member_id = m.id
  where rm.room_id = exam.room_id and m.auth_user_id = auth.uid() and m.active;
  if learner.id is null then raise exception 'You are not assigned to this test room.' using errcode = '42501'; end if;
  insert into public.learning_exam_attempts (exam_id, member_id, question_count)
  values (exam.id, learner.id, 0)
  on conflict (exam_id, member_id) do update set started_at = public.learning_exam_attempts.started_at
  returning * into attempt;
  if attempt.status in ('submitted', 'graded') then
    raise exception 'This test was already submitted.';
  end if;
  if exam.subject_code = 'BIBLE_NT' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'n', n, 'source_code', source_code, 'question_en', q_en, 'question_ko', q_ko,
      'passage_en', passage_en, 'passage_ko', passage_ko,
      'options_en', jsonb_build_array(option_1_en, option_2_en, option_3_en, option_4_en),
      'options_ko', jsonb_build_array(option_1_ko, option_2_ko, option_3_ko, option_4_ko)
    ) order by n), '[]'::jsonb) into questions from public.bible_nt_questions
      where n between exam.question_start and exam.question_end;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'n', n, 'source_code', source_code, 'question_en', q_en, 'question_ko', q_ko,
      'passage_en', passage_en, 'passage_ko', passage_ko,
      'options_en', jsonb_build_array(option_1_en, option_2_en, option_3_en, option_4_en),
      'options_ko', jsonb_build_array(option_1_ko, option_2_ko, option_3_ko, option_4_ko)
    ) order by n), '[]'::jsonb) into questions from public.bible_questions
      where n between exam.question_start and exam.question_end;
  end if;
  if jsonb_array_length(questions) = 0 then raise exception 'No questions are available for this test.'; end if;
  update public.learning_exam_attempts set question_count = jsonb_array_length(questions) where id = attempt.id;
  return jsonb_build_object('attempt_id', attempt.id, 'title', exam.title, 'time_limit_minutes', exam.time_limit_minutes, 'questions', questions);
end;
$$;

create or replace function public.submit_learning_exam(p_exam_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  exam public.learning_exams;
  learner public.learning_organization_members;
  attempt public.learning_exam_attempts;
  total_count integer := 0;
  correct_total integer := 0;
begin
  select * into exam from public.learning_exams where id = p_exam_id;
  if exam.id is null then raise exception 'The test was not found.'; end if;
  select m.* into learner from public.learning_organization_members m
    join public.learning_room_members rm on rm.member_id = m.id
    where rm.room_id = exam.room_id and m.auth_user_id = auth.uid() and m.active;
  if learner.id is null then raise exception 'You are not assigned to this test room.' using errcode = '42501'; end if;
  select * into attempt from public.learning_exam_attempts where exam_id = exam.id and member_id = learner.id;
  if attempt.id is null or attempt.status <> 'in_progress' then raise exception 'Start this test before submitting it.'; end if;
  if exam.time_limit_minutes is not null and attempt.started_at + make_interval(mins => exam.time_limit_minutes) < now() then
    raise exception 'The time limit has expired.';
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'Answers must be an array.'; end if;
  if exam.subject_code = 'BIBLE_NT' then
    with submitted as (
      select (item->>'n')::integer as n, nullif(item->>'answer','')::smallint as selected_answer
      from jsonb_array_elements(p_answers) item
    ), graded as (
      select q.n, s.selected_answer, (s.selected_answer = q.answer) as is_correct
      from public.bible_nt_questions q left join submitted s on s.n = q.n
      where q.n between exam.question_start and exam.question_end
    )
    insert into public.learning_exam_answers(attempt_id, question_number, selected_answer, is_correct)
    select attempt.id, n, selected_answer, coalesce(is_correct, false) from graded
    on conflict (attempt_id, question_number) do update set selected_answer = excluded.selected_answer, is_correct = excluded.is_correct, answered_at = now();
    select count(*), count(*) filter (where is_correct) into total_count, correct_total from public.learning_exam_answers where attempt_id = attempt.id;
  else
    with submitted as (
      select (item->>'n')::integer as n, nullif(item->>'answer','')::smallint as selected_answer
      from jsonb_array_elements(p_answers) item
    ), graded as (
      select q.n, s.selected_answer, (s.selected_answer = q.answer) as is_correct
      from public.bible_questions q left join submitted s on s.n = q.n
      where q.n between exam.question_start and exam.question_end
    )
    insert into public.learning_exam_answers(attempt_id, question_number, selected_answer, is_correct)
    select attempt.id, n, selected_answer, coalesce(is_correct, false) from graded
    on conflict (attempt_id, question_number) do update set selected_answer = excluded.selected_answer, is_correct = excluded.is_correct, answered_at = now();
    select count(*), count(*) filter (where is_correct) into total_count, correct_total from public.learning_exam_answers where attempt_id = attempt.id;
  end if;
  update public.learning_exam_attempts
    set correct_count = correct_total, question_count = total_count,
      score = case when total_count > 0 then round((correct_total::numeric * 100) / total_count, 2) else 0 end,
      submitted_at = now(), status = 'graded'
    where id = attempt.id
    returning * into attempt;
  return jsonb_build_object('correct_count', attempt.correct_count, 'question_count', attempt.question_count, 'score', attempt.score, 'status', attempt.status);
end;
$$;

create or replace function public.list_learning_exam_scores(p_exam_id uuid)
returns table (
  registration_number integer, member_name text, login_email text,
  status text, correct_count integer, question_count integer, score numeric,
  submitted_at timestamptz
)
language sql security definer set search_path = '' as $$
  select m.registration_number, m.member_name, m.login_email, a.status,
    a.correct_count, a.question_count, a.score, a.submitted_at
  from public.learning_exam_attempts a
  join public.learning_organization_members m on m.id = a.member_id
  join public.learning_exams e on e.id = a.exam_id
  where a.exam_id = p_exam_id and public.require_learning_org_admin_(e.organization_id) is not null
  order by m.registration_number nulls last, lower(m.member_name);
$$;

grant execute on function public.create_learning_exam(uuid, uuid, text, text, integer, integer, text, integer, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.list_learning_exams(uuid) to authenticated;
grant execute on function public.list_my_learning_exams() to authenticated;
grant execute on function public.start_learning_exam(uuid) to authenticated;
grant execute on function public.submit_learning_exam(uuid, jsonb) to authenticated;
grant execute on function public.list_learning_exam_scores(uuid) to authenticated;

commit;
