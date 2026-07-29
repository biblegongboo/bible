begin;

alter table public.bible_people
  add column if not exists non_biblical boolean not null default false,
  add column if not exists apocrypha_only boolean not null default false,
  add column if not exists birth_year integer,
  add column if not exists death_year integer,
  add column if not exists source_version text;

alter table public.bible_places
  add column if not exists description_ko text,
  add column if not exists source_status text;

alter table public.bible_question_catalog
  add column if not exists book_name_en text,
  add column if not exists book_name_ko text;

create table if not exists public.bible_related_entities (
  entity_id text primary key,
  entity_type text not null,
  name_en text not null,
  name_ko text,
  source_dataset text,
  status text not null default 'source_provided',
  created_at timestamptz not null default now()
);

create index if not exists bible_related_entities_type_idx
  on public.bible_related_entities (entity_type, lower(name_en));

create table if not exists public.bible_content_catalog (
  sheet_name text primary key,
  content_type text not null,
  row_count integer not null check (row_count >= 0),
  id_column text,
  first_id text,
  last_id text,
  source_dataset text,
  file_name text,
  sha256 text,
  max_cell_length integer,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.bible_related_entities enable row level security;
alter table public.bible_content_catalog enable row level security;

grant select on public.bible_related_entities,
  public.bible_content_catalog
to anon, authenticated;

create policy "Public can read Bible related entities"
  on public.bible_related_entities for select to anon, authenticated using (true);
create policy "Public can read Bible content catalog"
  on public.bible_content_catalog for select to anon, authenticated using (true);

commit;
