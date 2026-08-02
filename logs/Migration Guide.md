# GongBoo Bible Migration Guide

**Version:** 1.0  
**Last updated:** 2026-08-02 (America/Los_Angeles)  
**Audience:** a new developer, a replacement developer, or an operator moving the system to a new Supabase project or computer.

This is an operational migration manual. Read [HANDOVER.md](HANDOVER.md) first for architecture and product context; use this document when you must actually set up, transfer, deploy, validate, or restore the system.

> Security rule: this file intentionally contains no passwords, API keys, access tokens, member records, or PINs. Keep all such values only in a local ignored configuration file or Supabase Secrets.

## 1. What is being migrated

GongBoo Bible is a Supabase-centered Bible learning system with these connected parts:

- KJV/WEB-based Bible text, bilingual passages, chapter quizzes, catalog ranges, and voice learning.
- Bible People, Places, relationships, events, journeys, timelines, a 2.5D vector map, concordance, dictionary, study topics, book/chapter overview, and curated secondary-library content.
- System administrator, organization administrator, rooms, members, exams, attempts, and score history for premium/group learning.
- A static browser application hosted by GitHub Pages, Supabase Postgres/Storage/Edge Functions, a private generation/import workspace, and a Capacitor Android shell.

There are two separate migration scenarios:

| Scenario | Goal | Primary material |
|---|---|---|
| New developer computer | Safely reproduce the working development environment | Public worktree + private BIBLE root + local secrets supplied out-of-band |
| New Supabase project | Rebuild production database, Storage, functions, and runtime configuration | migrations, private import/backup artifacts, Edge Functions |

Do not mix the two roots below. This is the most important protection against both accidental data publication and lost source data.

| Root | Role | Git rule |
|---|---|---|
| `C:\Users\<user>\Desktop\gongboo.org\BIBLE` | **Private canonical root**: raw downloads, source text, generated questions, normalization/factory scripts, backups, private configuration | Never push raw content, secrets, or user exports to public GitHub |
| `C:\Users\<user>\Documents\시스템 전문가 1\biblegongboo_repo_public` | **Public application worktree**: static web files, migrations, Edge Function source, Capacitor shell | Public code only; content is served from Supabase |

The public repository is `biblegongboo/bible`. The active public application normally lives at `https://biblegongboo.github.io/bible/supabase/app/`.

## 2. Before touching anything

### 2.1 Freeze and back up

Before database migration, mass import, history cleanup, or a production-function deployment:

1. Stop the generation/import job or put it into a known safe checkpoint.
2. Record the current Git commit and Supabase project reference in the change ticket or local operator log.
3. Back up the affected tables and the Storage manifest to the private root.
4. Preserve the existing Google Sheets/GAS version as a frozen rollback/reference system. Do not delete it merely because Supabase is primary.
5. Test any restore on a staging project before relying on it for production recovery.

Never run a destructive database command, `git reset --hard`, repository history rewrite, or broad Storage delete as part of an ordinary update.

### 2.2 Preserve canonical content rules

- KJV and WEB source text is canonical input. AI must not rewrite it.
- Questions, translations, metadata links, and generated maps must retain source codes and provenance.
- Source-provided relationship, place, event, and journey data remains distinct from inferred/estimated records.
- Estimated journeys must be labeled as estimated; an ancient road layer is context, not proof that a person used that road.
- Secondary literature is not Scripture. It must retain source/license metadata and can be disabled source-by-source.
- Logical deletion (`active = false`) is preferred for organization records; do not hard-delete historical learning data as normal administration.

## 3. New developer machine setup

### 3.1 Install tools

Recommended versions:

| Tool | Recommended range | Used for |
|---|---|---|
| Node.js | 18–20 LTS | generation/import scripts and local checks |
| npm | current matching Node version | dependencies and Capacitor |
| Python | 3.9–3.11 | workbook and data conversion tasks where applicable |
| Git + GitHub CLI | current stable | source control and authenticated publishing |
| Supabase CLI | current stable | migrations, functions, secrets, project linking |
| VS Code | current | recommended browser/SQL/script editing; Copilot optional |
| Android Studio + JDK 21 | current stable | Android APK/AAB build only |

Verify the installation:

```powershell
node --version
npm --version
python --version
git --version
gh --version
supabase --version
```

### 3.2 Obtain the source safely

1. Clone the cleaned public repository into the public worktree location.
2. Obtain the **private BIBLE root** only from the authorized local archive/owner. It is not recoverable from GitHub by design.
3. Do not copy `content/`, `factory-output/`, source ZIPs, raw JSON/CSV, backups, or local configuration back into the public repo.
4. Confirm the graphics folder is a pinned local copy. Do not replace it with a live dependency on the TEST graphics site.

Example public clone:

```powershell
git clone https://github.com/biblegongboo/bible.git biblegongboo_repo_public
cd biblegongboo_repo_public
git status
```

### 3.3 Create a local-only configuration

Use a file that is ignored by Git, for example:

`C:\Users\<user>\Desktop\gongboo.org\BIBLE\config\local.secrets.json`

Suggested shape (replace placeholders locally; never commit values):

```json
{
  "supabase": {
    "url": "https://<project-ref>.supabase.co",
    "publishable_key": "<publishable-key>",
    "service_role_key": "<server-only-key>",
    "access_token": "<personal-access-token>"
  },
  "deepseek": {
    "api_key": "<deepseek-api-key>"
  },
  "paths": {
    "private_root": "C:/Users/<user>/Desktop/gongboo.org/BIBLE",
    "public_worktree": "C:/Users/<user>/Documents/시스템 전문가 1/biblegongboo_repo_public"
  }
}
```

Rules:

- Browser files may contain the Supabase URL and **publishable** key only.
- Service-role keys belong only to trusted local scripts or server-side Supabase functions.
- Personal access tokens are for deployment/migrations; do not put them into the browser application.
- PINs and passwords are never written to source files, migration files, or Markdown.

### 3.4 Run the web application locally

Static ES module files must be served over `http://` or `https://`; opening `index.html` as `file:///` causes browser CORS errors and is not a valid test.

```powershell
cd C:\Users\<user>\Documents\시스템 전문가 1\biblegongboo_repo_public
python -m http.server 8000
```

Then open:

`http://localhost:8000/supabase/app/index.html`

Use GitHub Pages only after local validation. It is a deployment preview, not a safe substitute for a local test server.

### 3.5 Orientation: files a new developer should read first

| File or directory | Why it matters | Change caution |
|---|---|---|
| `HANDOVER.md` | product architecture, schema overview, canonical locations, current decisions | update with material architectural changes |
| `supabase/app/main.js` | learning runtime, sessions, quiz retrieval, voice controls, compact responsive header | large legacy-compatible file; modify in small verified steps |
| `supabase/app/bible-explorer.js` | People, Atlas, 2.5D map, Places, Events, Timeline, Library navigation | preserve source/evidence labels and deep-link behavior |
| `supabase/app/group-admin.html` | system-administrator organization provisioning UI | publish only with matching RPC/function release |
| `supabase/app/organization-manager.html` | organization member/room administration | never bypass role checks in browser code |
| `supabase/functions/bible-content/` | protected content and quiz access | test authorization plus catalog/question reads |
| `supabase/functions/group-access/` | privileged group learning actions | security-sensitive; review every role/PIN/reset change |
| `supabase/migrations/` | ordered database evolution | append migrations; do not rewrite deployed history |
| private `scripts/` | generation, validation, import, factory, backup orchestration | keep paths portable and outputs outside public Git |
| `graphics/` | pinned JSON/2D/2.5D rendering assets | update as a deliberate pinned copy, not an untracked live import |

For the graphics engine, data is versioned JSON rather than unstructured HTML. Typical rendering input identifies a graphic type and schema version, then supplies chart/geometry/map entities, labels, styles, and viewport options. Keep source geometry separate from rendering configuration; validate JSON before adding it to a factory or UI route. The Bible map uses vector/2.5D layers so zooming remains crisp; it is not a raster screenshot.

## 4. Supabase project migration

### 4.1 Create and configure the target project

1. Create a new Supabase project in the intended organization and region.
2. Enable the Data API.
3. Create an owner personal access token with permission to apply database migrations and deploy Edge Functions.
4. Obtain the project URL, publishable key, and server-only secret/service key from the dashboard.
5. Set the browser origin and redirect URLs for GitHub Pages, local development, and future Android app domains as needed.
6. Configure email delivery before relying on password recovery in a real organization rollout.

The public key is not a replacement for RLS. Every table with member, organization, PIN, score, or premium data must retain suitable RLS policies and privileged operations must go through a protected RPC or Edge Function.

### 4.2 Link the command-line project

From the public worktree:

```powershell
supabase login
supabase link --project-ref <target-project-ref>
supabase projects list
```

Confirm that the project shown is the target project before applying any migration. A token that can list a project but receives HTTP 401 for database actions lacks sufficient migration permission; replace it with a token issued by the target project owner with database-write authority.

### 4.3 Apply schema migrations in timestamp order

Migration source directory:

`supabase/migrations/`

Key migration groups include:

| Area | Migration files / purpose |
|---|---|
| Core Bible schema | `20260729140000_create_bible_content_schema.sql` |
| Full workbook extensions | `20260729153000_extend_full_workbook_schema.sql` |
| Import permissions and relation extensions | `20260729162000_grant_bible_import_permissions.sql`, `20260729170000_allow_related_entity_relationships.sql` |
| Member schema | `20260729180000_create_member_auth_schema.sql`, `20260729183000_extend_member_and_subject_schema.sql` |
| Runtime/Storage content | `20260730130000_create_runtime_content_storage.sql` |
| Group-learning schema | `20260731150000_create_group_learning_admin.sql` through `20260731176000_hide_deleted_organizations_from_system_list.sql` |
| Pending organization lifecycle improvement | `20260801090000_reuse_deleted_organizations_and_list_admins.sql` |

Required order:

1. Inspect the pending SQL and make a pre-migration backup.
2. Apply migrations in chronological order, using the repository’s migration history rather than manually cherry-picking random files.
3. Confirm migration history and tables in the Supabase dashboard/SQL Editor.
4. Run browser and Edge Function smoke tests before publishing UI that depends on a new RPC/action.

Typical commands (review first, then run against the linked target project):

```powershell
supabase db push
supabase migration list
```

Do not publish a browser page that calls an Edge Function action or RPC not yet deployed in the target project.

### 4.4 Core database inventory

The main tables are intentionally separated by responsibility:

| Domain | Tables |
|---|---|
| Scripture and quiz | `bible_sources`, `bible_verses`, `bible_questions`, `bible_question_catalog` |
| People and relationships | `bible_people`, `bible_person_aliases`, `bible_person_references`, `bible_relationships` |
| Geography and events | `bible_places`, `bible_events`, `bible_journeys`, `bible_related_entities` |
| Runtime metadata/library | `bible_content_catalog`, `content_sources`, `bible_content_assets` |
| Membership | `member_profiles` |
| Group learning | `learning_organizations`, `learning_organization_admins`, `learning_organization_members`, `learning_rooms`, `learning_room_members`, `learning_exams`, `learning_exam_attempts`, `learning_exam_answers` |

Primary stored procedures/RPCs are listed in `HANDOVER.md`. Verify all are present after migration, especially member authentication, catalog/question reads, organization administration, room membership, and exam scoring functions.

## 5. Deploy Edge Functions and runtime settings

### 5.1 Functions

Function source lives under:

`supabase/functions/`

Key functions:

| Function | Responsibility |
|---|---|
| `bible-content` | authenticated quiz/catalog/content access and controlled browser-facing data reads |
| `group-access` | system admin, organization admin, member, room, exam, reset, and access-control operations |

Deploy only after migrations and project secrets are ready:

```powershell
supabase secrets list
supabase functions deploy bible-content --project-ref <target-project-ref>
supabase functions deploy group-access --project-ref <target-project-ref>
supabase functions list --project-ref <target-project-ref>
```

Function security must match the actual browser/client design. Do not weaken JWT/RLS checks merely to make a 401 disappear. Diagnose whether the browser is missing its expected authorization header, the function secret is absent, the role is incorrect, or the database policy denies the operation.

### 5.2 Pending combined organization registration

The following local enhancement must be treated as one atomic release:

1. Apply `20260801090000_reuse_deleted_organizations_and_list_admins.sql`.
2. Deploy the updated `group-access` function containing `create_organization_with_admin`.
3. Publish the paired `group-admin.html` page.
4. Test create organization + manager, list manager, logical delete, then reuse the same organization name.

It was prepared locally but should not be assumed live until the target project accepts the migration and function deployment. PINs are accepted only at creation and are never displayed afterward; recovery is handled through a reset email link.

### 5.3 Browser configuration and GitHub Pages

Update the browser configuration with the **target project URL and publishable key only**. Confirm the following before a public push:

- no service role key, access token, DeepSeek key, raw content, member export, or backup is tracked;
- API URLs point to the intended target project;
- the application’s version query string is updated only after the referenced JavaScript/CSS is actually pushed;
- GitHub Pages source is configured for the intended branch/root;
- a logged-out/private browser window can load only public content, not administrator data.

Use a normal intentional Git workflow: inspect `git status`, inspect diffs, commit the intended files, push, then wait for Pages deployment. Never publish from the old full-data worktree.

## 6. Data import procedure

### 6.1 Import order

Import in the following dependency order. Validate each stage before proceeding.

1. `bible_sources` and `bible_verses` — source identity and KJV/WEB chapter/verse links.
2. People, aliases, references, and relationships.
3. Places, events, related entities, journeys, ancient roads, and geography layers.
4. Quiz questions and question catalog ranges.
5. Knowledge manifests, concordance/dictionary/topic/book partitions, and map assets.
6. Controlled secondary-library/Patristic/commentary runtime partitions and Storage manifests.
7. Organization and test-member data only in a controlled test or production administration rollout.

The user-facing database never needs raw source ZIPs or factory intermediates. Keep those inside the private root.

### 6.2 Quiz generation and import pipeline

The planned daily pipeline is:

`source text → DeepSeek generation → validation/review → generated batch → Supabase import → catalog update → browser test`

Current operating convention:

- Generation uses the private-root `scripts/daily_bible_pipeline.mjs` and related importer/validator scripts.
- Scheduled generation runs between **03:00 and 18:00 America/Los_Angeles** and performs a safe stop after the allowed window.
- The post-Genesis sequence begins at `N = 3036`; never launch parallel generators against the same N range.
- Import only batches that have a completed validation manifest and an unambiguous catalog range.

Required validation before a quiz import:

- `N` is sequential with no duplicate or missing values.
- `SOURCE_CODE` follows the canonical format, for example `OT-Genesis-01-01` or `NT-Matthew-05-03`.
- four choices exist and `A` is one of `1`, `2`, `3`, `4`.
- English/Korean question, choices, explanation, and required passage fields are not unexpectedly blank.
- passage text and source code match; do not modify KJV/WEB canonical text.
- catalog `start_n`/`last_n` equals the actual imported chapter range.

Example pattern; actual script flags may differ by version, so run its help/readme before production use:

```powershell
cd C:\Users\<user>\Desktop\gongboo.org\BIBLE
node scripts\validate_question_batch.mjs --input <batch-file>
node scripts\import_supabase_content.mjs --input <batch-file> --dry-run
node scripts\import_supabase_content.mjs --input <batch-file> --yes
```

### 6.3 Runtime knowledge and commentary assets

Large runtime content must not be bundled with the initial page:

- map/places/roads: load by manifest and relevant feature set;
- concordance: load by selected Bible book or search partition;
- dictionary/topics/books: load by category or requested item;
- images: retain metadata and external links unless separately approved for storage;
- commentary/secondary literature: source-by-book or source-by-work gzip partitions, loaded only when requested.

The immediate removal/takedown control is the source record in `content_sources`, including `enabled` and the applicable content-type switch. Disable a source before deleting data whenever an external source requires review.

## 7. Backup, restore, and rollback

### 7.1 Minimum backup set

Before any schema change or bulk import, create and retain:

- PostgreSQL dump or table exports of changed tables;
- a snapshot of migration history;
- Storage object manifest plus a copy of changed private source partitions;
- generated-batch files, validation reports, catalog file, and import log;
- Git commit/tag of the browser and function source;
- a small written note of project ref, date/time, operator, and exact restore order — without credentials.

Store backups in the private root, for example:

`C:\Users\<user>\Desktop\gongboo.org\BIBLE\data\backup\YYYY-MM-DD\`

### 7.2 Restore principles

1. Restore to staging first when time permits.
2. Restore tables in dependency order: sources/verses → metadata → questions/catalog → runtime manifests/assets → organization data.
3. Restore Storage objects before enabling a manifest that references them.
4. Compare row counts, hashes/manifests, and sample browser loads against the pre-change record.
5. If a UI deployment fails but data is healthy, revert the browser/function commit before manipulating database records.
6. If a content source is disputed, disable it through `content_sources` rather than destroying audit history.

## 8. Verification checklist

Run this after any full migration and before a production handoff.

### 8.1 Database/API

- [ ] Migrations show as applied and required tables/RPCs exist.
- [ ] Basic row counts are plausible: verses, people, aliases, references, relationships, places, events, questions, catalog.
- [ ] Question catalog range opens the correct chapter and original N range.
- [ ] `bible-content` returns authorized catalog and questions without 401/404 for a valid session.
- [ ] Browser does not rely on stale localStorage totals to start a valid chapter.
- [ ] A non-admin cannot create organizations, view another organization, or call privileged group actions.

### 8.2 Learning and accessibility

- [ ] Learn, Study, and Exam modes work; timer appears only in Exam.
- [ ] PSG and Qz toggles visibly change state.
- [ ] Primary/secondary language selectors display the expected passages/questions.
- [ ] Play, replay, stop, speed, and auto-next give visible press feedback and work on a supported browser/device.
- [ ] When device TTS is unavailable, a clear non-fatal message appears.
- [ ] Resume/local progress works without storing the full question bank in localStorage.

### 8.3 Explorer

- [ ] People first-letter search lists matching names; aliases resolve.
- [ ] Relationship graph uses human labels, includes appropriate partner/parent/child layout, and a person with no graph data gets a normal single-person card.
- [ ] Scripture-reference chips open the associated chapter/quiz when available; otherwise show a clear “chapter exists but no quiz yet” message.
- [ ] Places search works by first letter; a selected place displays its 2.5D vector map.
- [ ] Map zoom, drag, Fit All, and point selection work without blurred vectors.
- [ ] Timeline selection displays event, participant, place, and Scripture evidence.
- [ ] Journeys use an explicit source-backed/estimated label and do not silently substitute Paul for another selected entity.

### 8.4 Group learning

- [ ] System administrator creates an organization with seat capacity, memo, manager name/email/PIN.
- [ ] Organization manager can add/remove members and manage rooms within seat limits.
- [ ] Email/PIN login, member password change, and secure recovery email work.
- [ ] Deleted organizations disappear from active lists but remain recoverable historically.
- [ ] Recreating a logically deleted name works only after the pending migration/function/UI trio is live.
- [ ] Room-specific exam, attempts, answers, scores, and history are visible only to the correct organization/room role.

### 8.5 Android shell

- [ ] Capacitor shell points to the approved live Supabase web application.
- [ ] Mobile header does not crop essential Atlas, People, logout, language, PSG/Qz, or learning controls.
- [ ] Touch targets are usable and buttons show press feedback.
- [ ] Maps support pinch zoom and do not crash after repeated view changes.
- [ ] Android text-to-speech availability is checked on an actual device.

## 9. Mobile (Capacitor Android) rebuild

Android source is in the public worktree under `mobile/`; app id is `org.gongboo.bible`.

```powershell
cd C:\Users\<user>\Documents\시스템 전문가 1\biblegongboo_repo_public\mobile
npx cap sync android
npx cap open android
```

Open the `android` folder in Android Studio using JDK 21. Do not place the Android project under a path containing Korean/non-ASCII characters; Android Gradle may reject such a path. Build a debug APK first, test it on a real phone, then generate a signed AAB only after the web/runtime URL and app behavior are accepted.

The Android app is a controlled wrapper around the live web application. Web changes can take effect immediately in the shell, so production web regressions affect Android too. Use staged Pages deployment and test a phone before announcing an update.

## 10. AI and automation safety

AI tools may help with code explanation, test generation, data transformation, and quiz drafting. They may not be treated as source of truth.

- Never let AI silently change KJV/WEB source text.
- Validate every generated question batch mechanically before import.
- Review all AI-suggested SQL, RLS, authentication, subscription, or payment code manually.
- Do not let AI produce unsupported theological claims as canonical product data.
- Preserve source/license/record identifiers whenever converting JSON, CSV, GeoJSON, CAD-derived geometry, XML, or image metadata.
- Keep original downloaded files read-only; factories write normalized/generated output separately.

### 10.1 Moving work between Codex and GitHub Copilot

Codex and Copilot are development aids, not production authorities. A new developer can use VS Code/Copilot for local navigation and routine coding, with prompts such as:

```text
@workspace Explain the request/authorization flow from group-admin.html to group-access.
@workspace Identify all callers of the selected Bible explorer deep-link function.
@workspace Propose tests for a migration that adds an organization seat limit.
```

Use AI to explain, refactor, draft tests, and surface dependencies. Do not accept AI-generated RLS, authentication, payment, PIN, migration, or theological changes without an operator review and the validation checklist in this guide. Never paste a secret into an AI prompt, issue, pull request, or public chat.

## 11. Immediate migration priorities

1. Confirm the private-root backup is complete and the cleaned public worktree remains content-free.
2. Confirm the target Supabase project receives its database-write/deploy token only through local secret storage.
3. Deploy the pending combined organization/manager registration migration, `group-access`, and `group-admin.html` together.
4. Continue the Bible question pipeline serially; import validated ranges and catalog updates together.
5. Verify the full Supabase application and Android shell on real devices before enrolling group customers.
6. Keep this guide and `HANDOVER.md` current whenever a migration, schema, deployment target, source boundary, or canonical file location changes.

## 12. One-page quick start for the next developer

1. Read `HANDOVER.md`, `PORTFOLIO/README.md`, `PORTFOLIO/REGISTRY.json`, `PORTFOLIO/DECISIONS.md`, and the relevant `PORTFOLIO/THREADS/*.md` record.
2. Clone only `biblegongboo/bible` into `biblegongboo_repo_public`; obtain private content separately.
3. Create ignored local secrets; never copy them to GitHub or browser code.
4. Serve `supabase/app/` with an HTTP server and verify the current live project before editing.
5. For a new Supabase project: link CLI → backup → apply migrations → deploy functions → import data in dependency order → set browser config → smoke-test → publish Pages.
6. For routine content generation: serial generation → validation → import → catalog update → chapter test. Never overlap N ranges.
7. For any failure: preserve logs and backups, stop automated writes, identify whether the fault is browser config, function auth, RLS, schema, Storage, or data, then repair in staging before production.
