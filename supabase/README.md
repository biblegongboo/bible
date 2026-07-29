# Bible GongBoo Supabase

The GitHub integration watches the repository-root `supabase/` directory and
applies SQL migrations from `supabase/migrations` to the production project.

Initial migration scope:

- KJV/WEB/WEB Korean literal verse storage
- people, aliases, verse references, and source-provided relationships
- places, events, and journeys
- protected quiz catalog and question-bank tables

Safety:

- Google Sheets and Apps Script remain unchanged as the rollback source.
- Public content tables are read-only through RLS.
- Quiz-bank tables have RLS enabled but no public read policy.
- Service-role keys and database passwords must never be committed.
