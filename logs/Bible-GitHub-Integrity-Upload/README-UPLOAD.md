# Bible Integrity Upload Bundle

Upload this bundle into the root of the `biblegongboo/bible` repository.

Files to upload:
- `BIBLE-RECOVERY-AND-TESTING.md`
- `scripts/build_bible_recovery_manifest.mjs`
- `scripts/verify_bible_full_integrity.mjs`
- `scripts/verify_bible_sample_health.mjs`
- `scripts/verify_supabase_content_links.mjs`
- `scripts/verify_supabase_live_storage.mjs`
- `scripts/verify_deployed_bible_browser_smoke.py`

Do not upload unrelated application changes from the working directory.

Verified locally on 2026-08-09:
- canonical full integrity audit: passed
- live Supabase Storage: 314 canonical files downloaded and SHA-256 matched
- People 3,245; Places 1,274; Events 450; Journeys 61; Timelines 35
- Words 12,849; Dictionary 6,519; Books 66; Chapters 1,189
- Topics 8; semantic categories 7; image records 2,424

The browser smoke script needs a dedicated non-personal test account supplied
only through local environment variables. Do not commit passwords.
