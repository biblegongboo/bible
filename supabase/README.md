# Bible GongBoo Supabase

The GitHub integration watches the repository-root `supabase/` directory and
applies SQL migrations from `supabase/migrations` to the production project.

Initial migration scope:

- KJV/WEB/WEB Korean literal verse storage
- people, aliases, verse references, and source-provided relationships
- places, events, and journeys
- protected quiz catalog and question-bank tables

Directory layout:

- `migrations/`: production database schema managed by the Supabase GitHub integration
- `app/`: isolated GitHub Pages preview copied from the current Bible web app

The repository-root web app remains the Google Sheets/GAS production version.
Only `supabase/app/` is changed for the Supabase data-provider transition.

Safety:

- Google Sheets and Apps Script remain unchanged as the rollback source.
- Public content tables are read-only through RLS.
- Quiz-bank tables have RLS enabled but no public read policy.
- Service-role keys and database passwords must never be committed.
