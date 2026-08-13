begin;

create table if not exists public.license_products (
  product_code text primary key check (product_code in ('realestate','insurance','mortgage','notary')),
  title text not null,
  active boolean not null default true,
  sample_limit smallint not null default 20 check (sample_limit between 1 and 100),
  set_size smallint not null check (set_size between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.license_products (product_code, title, set_size) values
  ('realestate','Real Estate',150), ('insurance','Insurance',150),
  ('mortgage','Mortgage NMLS',120), ('notary','Notary',45)
on conflict (product_code) do nothing;

create table if not exists public.license_questions (
  question_id text primary key,
  product_code text not null references public.license_products(product_code),
  sequence_number integer not null check (sequence_number > 0),
  subject text,
  category text,
  answer smallint not null check (answer between 1 and 4),
  graphic jsonb,
  is_sample boolean not null default false,
  sample_order smallint,
  status text not null default 'draft',
  source_id text,
  source_n integer,
  source_sheet text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_code, sequence_number),
  unique(product_code, sample_order)
);

create table if not exists public.license_question_translations (
  question_id text not null references public.license_questions(question_id) on delete cascade,
  language_code text not null,
  question_text text not null,
  passage_text text,
  option_1 text not null,
  option_2 text not null,
  option_3 text not null,
  option_4 text not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(question_id, language_code)
);

create table if not exists public.license_question_reviews (
  question_id text primary key references public.license_questions(question_id) on delete cascade,
  source_quality text,
  source_issue text,
  answer_check text,
  ambiguity_check text,
  translation_check text,
  translation_issue text,
  concept_summary text,
  change_summary text,
  batch_id text,
  custom_id text,
  generated_at timestamptz,
  raw_metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

create table if not exists public.license_entitlements (
  entitlement_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null references public.license_products(product_code),
  status text not null default 'active' check (status in ('active','inactive','expired','refunded')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_code)
);

create index if not exists license_questions_product_sequence_idx on public.license_questions(product_code, sequence_number);
create index if not exists license_questions_sample_idx on public.license_questions(product_code, sample_order) where is_sample;
create index if not exists license_entitlements_user_idx on public.license_entitlements(user_id, status);

alter table public.license_products enable row level security;
alter table public.license_questions enable row level security;
alter table public.license_question_translations enable row level security;
alter table public.license_question_reviews enable row level security;
alter table public.license_entitlements enable row level security;

grant select on public.license_products to anon, authenticated;
create policy "Public can read active license products" on public.license_products for select to anon, authenticated using (active);

-- Questions, translations, reviews, and entitlements intentionally have no
-- browser-readable policy. license-content mediates samples and paid access.

commit;
