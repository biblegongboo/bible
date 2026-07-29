begin;

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.bible_sources,
  public.bible_verses,
  public.bible_people,
  public.bible_person_aliases,
  public.bible_person_references,
  public.bible_relationships,
  public.bible_related_entities,
  public.bible_places,
  public.bible_events,
  public.bible_journeys,
  public.bible_content_catalog,
  public.bible_question_catalog,
  public.bible_questions
to service_role;

grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;

commit;
