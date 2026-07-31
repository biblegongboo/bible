begin;

create table if not exists public.content_sources (
  source_id text primary key,
  content_type text not null default 'mixed',
  title text not null,
  author text,
  source_url text,
  license_label text,
  status text not null default 'active'
    check (status in ('active', 'hidden', 'review', 'removed')),
  enabled boolean not null default true,
  image_enabled boolean not null default true,
  commentary_enabled boolean not null default true,
  display_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bible_content_assets (
  asset_id text primary key,
  source_id text not null references public.content_sources(source_id),
  asset_type text not null,
  storage_bucket text not null default 'bible-content',
  storage_path text not null unique,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bible_content_assets_source_idx
  on public.bible_content_assets (source_id, asset_type);
create index if not exists bible_content_assets_path_idx
  on public.bible_content_assets (storage_path);
create index if not exists content_sources_enabled_idx
  on public.content_sources (enabled, status, display_order);

insert into storage.buckets (id, name, public, file_size_limit)
values ('bible-content', 'bible-content', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

alter table public.content_sources enable row level security;
alter table public.bible_content_assets enable row level security;

grant select on public.content_sources, public.bible_content_assets
to authenticated;

drop policy if exists "Authenticated users can read enabled content sources"
  on public.content_sources;
create policy "Authenticated users can read enabled content sources"
  on public.content_sources for select to authenticated
  using (enabled and status = 'active');

drop policy if exists "Authenticated users can read enabled content assets"
  on public.bible_content_assets;
create policy "Authenticated users can read enabled content assets"
  on public.bible_content_assets for select to authenticated
  using (
    enabled
    and exists (
      select 1
      from public.content_sources source
      where source.source_id = bible_content_assets.source_id
        and source.enabled
        and source.status = 'active'
    )
  );

drop policy if exists "Authenticated users can read enabled Bible content files"
  on storage.objects;
create policy "Authenticated users can read enabled Bible content files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bible-content'
    and exists (
      select 1
      from public.bible_content_assets asset
      join public.content_sources source
        on source.source_id = asset.source_id
      where asset.storage_bucket = bucket_id
        and asset.storage_path = name
        and asset.enabled
        and source.enabled
        and source.status = 'active'
    )
  );

commit;
