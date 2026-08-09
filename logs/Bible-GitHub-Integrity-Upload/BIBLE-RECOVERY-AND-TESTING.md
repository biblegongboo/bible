# Bible Recovery and Test Routine

## Purpose

Keep the Bible data recoverable from immutable source archives and catch broken
links before users discover them in the application.

## Normal use

Run a focused check after a People, Atlas, Timeline, Journey, or Library
change. It uses representative paths and finishes quickly.

```powershell
node scripts/verify_bible_sample_health.mjs
```

It currently verifies Abraham → Sodom → Atlas, Aaron availability, Sodom
Destroyed in the timeline, Paul journey 1, Genesis timeline, and Library
reader availability.

## Full integrity check

Run only after a large data import, Storage migration, major factory rebuild,
or before a release.

```powershell
node scripts/verify_bible_full_integrity.mjs
```

The full check covers the Library as separate content contracts: all 66 concordance
book shards (Words), dictionary, topics, books, chapters, semantic categories,
modern-place data, image-link manifest, and every Early Church reader entry.

It checks every person-context → event/place/Scripture-place reference, every
event → person/place reference, all core content files, every journey and
timeline payload, reader files, and the last runtime Storage migration report.

## Live Supabase Storage check

Use this after a Storage upload or before declaring a deployment healthy. It
reads the local secret only from a local environment file, compares every
canonical runtime file against `bible_content_assets`, then downloads and
SHA-256 checks each live Storage object. No key or user data is written to a
report or GitHub.

```powershell
node scripts/verify_supabase_live_storage.mjs
```

For a quicker asset-index-only check, use:

```powershell
node scripts/verify_supabase_live_storage.mjs --metadata-only
```

If the private data worktree is elsewhere, specify it explicitly:

```powershell
node scripts/verify_supabase_live_storage.mjs --private-root "C:\\path\\to\\biblegongboo_repo"
```

## Deployed browser smoke test

Create one dedicated non-personal smoke-test account. Store its credentials
only as local environment variables; do not put them in source files.

```powershell
$env:BIBLE_SMOKE_EMAIL = "smoke-test@example.invalid"
$env:BIBLE_SMOKE_PASSWORD = "local-password-only"
python scripts/verify_deployed_bible_browser_smoke.py
```

The browser test signs in, chooses a Bible subject, verifies the application
shell, People, Abraham to Sodom context, Atlas/Sodom, Journeys, Timeline, Early
Church, Study, and Library. It saves a JSON result and, on failure, a screenshot
and page capture under `smoke-artifacts/`. Use `--headed` to watch the test run.

## Recovery baseline

Create or refresh the source-to-runtime inventory after source data changes.

```powershell
node scripts/build_bible_recovery_manifest.mjs --bible-root "C:\Users\daeca\Desktop\gongboo.org\BIBLE"
```

For a full source-corruption baseline, use SHA-256 hashes. This reads every
source file and can take longer, so use it after a major archive backup rather
than after ordinary UI work.

```powershell
node scripts/build_bible_recovery_manifest.mjs --bible-root "C:\Users\daeca\Desktop\gongboo.org\BIBLE" --hash
```

Generated files are stored in `BIBLE/data/recovery/`:

- `bible-recovery-manifest.json` — rebuild order, normalizer inputs/outputs,
  Storage migration baseline, and inventory totals.
- `source-file-inventory.jsonl` — all raw source files.
- `runtime-content-inventory.jsonl` — private runtime content candidates.
- `source-to-runtime-lineage.csv` — source inputs, normalized outputs, and
  runtime content lineage in one reviewable table.

## If a database or Storage failure occurs

1. Preserve the failed environment; do not overwrite it.
2. Restore the immutable `BIBLE/SOURCE` archive and confirm it against the
   recovery inventory.
3. Run the established normalizers and content factories.
4. Run `verify_bible_full_integrity.mjs` until it passes.
5. Upload only validated runtime content to Supabase Storage, then restore DB
   tables through the existing import/migration scripts.
6. Run the focused check and the authenticated browser smoke paths before
   declaring the service restored.

The recovery records never contain passwords, API keys, or user data.
