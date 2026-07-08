# CLAUDE.md — Grovery File Upload Tool

## What this is
An internal file-transfer tool for The Grovery: move files too large to email.
- **Team → client:** upload a file, share a public link.
- **Client → team:** hand a client the upload password so they can send you large files.

Rebuilt 2026-07 off AWS S3 (account was suspended) onto **Supabase**, hosted on **Netlify**.

## Live
- Production: **https://files.thegrovery.com** (also https://groveryfiles.netlify.app)
- Netlify site: `groveryfiles` (team "Grovery", id `e4bc6c4b-1de0-4480-8153-3ba98c8e944d`), deploys from GitHub `main`.
- Repo: `github.com/sbj181/file-upload-tool` (personal account sbj181; thegrovery is a collaborator).
- Supabase project: `File Upload Tool`, ref `jecgqkbceftvvlmdipka`, org "The Grovery" (Pro), region us-east-1.

## Tech stack
Next.js 15.5 (App Router for pages + Pages Router for `/api`), React 19, Tailwind,
`@supabase/supabase-js`, `google-auth-library`, `jose` (session JWT), `resend` (email).
Package manager: **pnpm**. Tests: **vitest** (`pnpm test`).

## Architecture / three flows
1. **Upload (password-gated, client-safe):** `UploadAuth` → `POST /api/upload-url`
   verifies `UPLOAD_PASSWORD` (comma-separated list allowed) server-side, returns a
   Supabase signed upload token. Browser streams the file **directly** to Supabase
   Storage via XHR (`src/app/lib/storage.ts`) with real progress/speed/ETA. Bytes
   never pass through Netlify → no size/timeout limit (bucket cap 5 GB).
2. **Manage/download (employee-only):** `GoogleSignIn` gets a Google ID token →
   `POST /api/auth/google` verifies it with `google-auth-library`, checks
   `email_verified` + `@thegrovery.com`, sets an httpOnly session cookie (`jose`).
   `list-files` / `file-link` / `delete-file` re-check the session on every call.
3. **Share links (public):** `POST /api/file-link` stores `{id, storage_path, expires_at}`
   in the `short_links` Postgres table; `/f/[id]` → `GET /api/resolve-link` mints a
   fresh 1-hour signed URL per visit (no login needed for the client downloading).

## Key files
- `src/app/lib/storage.ts` — client upload (XHR + progress); `formatSpeed`/`formatEta`.
- `src/app/lib/supabaseServer.ts` — service-role client (server only), `BUCKET`.
- `src/app/lib/auth.ts` — `isAllowedGroveryEmail`, `makeShortId` (+ tests).
- `src/app/lib/session.ts` — signed session cookie helpers (+ tests).
- `src/pages/api/*` — all server logic; manage endpoints guard with `requireSession`.

## Environment variables (.env.local locally; set in Netlify UI for prod)
Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_PASSWORD` (comma-separated ok),
`SESSION_SECRET`, `ALLOWED_EMAIL_DOMAIN`, `RESEND_API_KEY`, `NOTIFY_EMAIL`, `FROM_EMAIL`,
`SUPABASE_BUCKET`.
Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
`.env.example` documents the shape. **Never** re-inline secrets via `next.config.mjs`.

## Commands
- `pnpm dev` — local dev
- `pnpm build` — production build
- `pnpm test` — vitest unit tests
- Deploy: push to `main` → Netlify auto-builds (server-side).

## Gotchas / operational notes
- **Next.js version floor:** Netlify blocks deploys of Next < patched (CVE-2025-55182).
  Stay on a patched 15.5+ release.
- **Google login on a new domain:** add the URL to the OAuth client's *Authorized
  JavaScript origins* (Google Cloud Console) or sign-in fails on that domain.
- **Old files** from the suspended AWS S3 bucket were never migrated (inaccessible).
- Email via Resend is best-effort: if `RESEND_API_KEY`/`FROM_EMAIL` unset or the domain
  isn't verified in Resend, the upload still succeeds; the notification is skipped.

## TODO / possible follow-ups
- Resumable (TUS) uploads for extra reliability on 2 GB files over flaky connections.
- Rotate the leaked legacy secrets still in old git history (SendGrid, Google refresh
  token, Upstash token) if any downstream systems still trust them.
