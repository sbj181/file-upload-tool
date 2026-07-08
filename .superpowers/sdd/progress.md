# Progress Ledger — Supabase/Netlify migration

Baseline commit: ec4c4d3 (branch supabase-netlify-migration)

- Phase 0 (provisioning): complete — bucket `grovery-uploads` (private, 5GB) + `short_links` table live in project jecgqkbceftvvlmdipka
- Phase 0.2 + Phase 1 (foundation): complete (commits 6e4d051..1da78ad, 11/11 tests pass) — deps swapped to supabase/google-auth/jose/resend, next.config de-leaked, auth+session+supabaseServer helpers built
- Phase 2 (upload path): complete (commits 14fd0cc..3fef56b, 11/11 tests, build clean except not-yet-migrated download files) — upload-url.ts (comma-sep password), storage.ts, notify-upload.ts (Resend), upload.tsx + UploadAuth.tsx rewired, s3.ts + send-upload-notification.ts removed
