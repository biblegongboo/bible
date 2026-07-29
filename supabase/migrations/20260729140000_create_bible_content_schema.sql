begin;

create extension if not exists pgcrypto;

create table if not exists public.bible_sources (
  source_id text primary key,
  title text not null,
  version_label text,
  license_note text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bible_verses (
  source_code text primary key,
  testament text not null check (testament in ('OT', 'NT')),
  book_code text not null,
  chapter smallint not null check (chapter > 0),
  verse smallint not null check (verse > 0),
  kjv_text text,
  web_text text,
  ko_web_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (testament, book_code, chapter, verse)
);

create index if not exists bible_verses_book_chapter_idx
  on public.bible_verses (testament, book_code, chapter, verse);

create table if not exists public.bible_people (
  person_id text primary key,
  canonical_name_en text not null,
  canonical_name_ko text,
  gender text,
  description_en text,
  description_ko text,
  roles jsonb not null default '[]'::jsonb,
  tribe_id text,
  source_dataset text,
  source_record_id text,
  theographic_id text,
  status text not null default 'source_provided',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bible_people_name_en_idx
  on public.bible_people (lower(canonical_name_en));

create table if not exists public.bible_person_aliases (
  alias_id bigint generated always as identity primary key,
  person_id text not null references public.bible_people(person_id) on delete cascade,
  language text not null default 'en',
  alias text not null,
  source_dataset text,
  source_record_id text,
  unique (person_id, language, alias)
);

create index if not exists bible_person_aliases_lookup_idx
  on public.bible_person_aliases (lower(alias));

create table if not exists public.bible_person_references (
  reference_id bigint generated always as identity primary key,
  person_id text not null references public.bible_people(person_id) on delete cascade,
  source_code text not null,
  reference_kind text,
  is_key boolean not null default false,
  source_dataset text,
  source_record_id text,
  unique (person_id, source_code, reference_kind, source_dataset)
);

create index if not exists bible_person_references_person_idx
  on public.bible_person_references (person_id);
create index if not exists bible_person_references_source_idx
  on public.bible_person_references (source_code);

create table if not exists public.bible_relationships (
  relation_id text primary key,
  from_id text not null references public.bible_people(person_id) on delete cascade,
  to_id text not null references public.bible_people(person_id) on delete cascade,
  relationship_type text not null,
  evidence_source_codes jsonb not null default '[]'::jsonb,
  evidence_status text,
  confidence numeric,
  source_dataset text,
  source_record_id text,
  status text not null default 'source_provided',
  created_at timestamptz not null default now()
);

create index if not exists bible_relationships_from_idx
  on public.bible_relationships (from_id);
create index if not exists bible_relationships_to_idx
  on public.bible_relationships (to_id);

create table if not exists public.bible_places (
  place_id text primary key,
  canonical_name_en text not null,
  canonical_name_ko text,
  aliases jsonb not null default '[]'::jsonb,
  feature_type text,
  feature_subtype text,
  latitude double precision,
  longitude double precision,
  precision_label text,
  description_en text,
  source_dataset text,
  source_record_id text,
  coordinate_status text,
  status text not null default 'source_provided',
  created_at timestamptz not null default now()
);

create index if not exists bible_places_name_en_idx
  on public.bible_places (lower(canonical_name_en));
create index if not exists bible_places_coordinates_idx
  on public.bible_places (latitude, longitude);

create table if not exists public.bible_events (
  event_id text primary key,
  title_en text not null,
  title_ko text,
  start_date_candidate text,
  duration_candidate text,
  predecessor_id text,
  part_of_id text,
  source_codes jsonb not null default '[]'::jsonb,
  participant_source_ids jsonb not null default '[]'::jsonb,
  location_source_ids jsonb not null default '[]'::jsonb,
  source_dataset text,
  source_record_id text,
  chronology_status text,
  status text not null default 'source_provided',
  created_at timestamptz not null default now()
);

create table if not exists public.bible_journeys (
  journey_id text primary key,
  title text,
  person_id text references public.bible_people(person_id) on delete set null,
  sequence_no integer,
  geometry jsonb not null,
  properties jsonb not null default '{}'::jsonb,
  source_dataset text,
  created_at timestamptz not null default now()
);

create table if not exists public.bible_question_catalog (
  catalog_code text primary key,
  testament text not null check (testament in ('OT', 'NT')),
  book_code text not null,
  chapter smallint not null check (chapter > 0),
  start_n integer not null check (start_n > 0),
  last_n integer not null check (last_n >= start_n),
  question_count integer generated always as (last_n - start_n + 1) stored,
  status text not null default 'draft',
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_questions (
  n integer primary key,
  source_code text not null,
  point_code text,
  q_en text not null,
  q_ko text,
  passage_en text,
  passage_ko text,
  option_1_en text not null,
  option_1_ko text,
  option_2_en text not null,
  option_2_ko text,
  option_3_en text not null,
  option_3_ko text,
  option_4_en text not null,
  option_4_ko text,
  answer smallint not null check (answer between 1 and 4),
  explanation_en text,
  explanation_ko text,
  catalog_code text references public.bible_question_catalog(catalog_code),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bible_questions_source_idx
  on public.bible_questions (source_code);
create index if not exists bible_questions_catalog_idx
  on public.bible_questions (catalog_code, n);

alter table public.bible_sources enable row level security;
alter table public.bible_verses enable row level security;
alter table public.bible_people enable row level security;
alter table public.bible_person_aliases enable row level security;
alter table public.bible_person_references enable row level security;
alter table public.bible_relationships enable row level security;
alter table public.bible_places enable row level security;
alter table public.bible_events enable row level security;
alter table public.bible_journeys enable row level security;
alter table public.bible_question_catalog enable row level security;
alter table public.bible_questions enable row level security;

grant select on public.bible_sources,
  public.bible_verses,
  public.bible_people,
  public.bible_person_aliases,
  public.bible_person_references,
  public.bible_relationships,
  public.bible_places,
  public.bible_events,
  public.bible_journeys
to anon, authenticated;

create policy "Public can read Bible sources"
  on public.bible_sources for select to anon, authenticated using (true);
create policy "Public can read Bible verses"
  on public.bible_verses for select to anon, authenticated using (true);
create policy "Public can read Bible people"
  on public.bible_people for select to anon, authenticated using (true);
create policy "Public can read Bible person aliases"
  on public.bible_person_aliases for select to anon, authenticated using (true);
create policy "Public can read Bible person references"
  on public.bible_person_references for select to anon, authenticated using (true);
create policy "Public can read Bible relationships"
  on public.bible_relationships for select to anon, authenticated using (true);
create policy "Public can read Bible places"
  on public.bible_places for select to anon, authenticated using (true);
create policy "Public can read Bible events"
  on public.bible_events for select to anon, authenticated using (true);
create policy "Public can read Bible journeys"
  on public.bible_journeys for select to anon, authenticated using (true);

-- Question-bank tables intentionally have RLS enabled and no public policy.
-- They are available only through service-role administration until a paid-content
-- RPC or Edge Function is introduced.

commit;
