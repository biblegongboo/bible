begin;

-- Source datasets connect people not only to other people but also to groups,
-- tribes, nations, and other related entities. Keep the source IDs intact.
alter table public.bible_relationships
  drop constraint if exists bible_relationships_from_id_fkey,
  drop constraint if exists bible_relationships_to_id_fkey;

commit;
