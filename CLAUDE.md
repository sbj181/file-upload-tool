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
1. **Upload (password-gated, client-safe): S3 multipart.** `UploadAuth` → the
   `/api/upload/create|complete|abort` routes verify `UPLOAD_PASSWORD`
   (comma-separated list allowed) server-side and drive an S3 multipart upload
   against Supabase's S3-compatible endpoint (creds server-only). `create` returns
   a presigned URL per ~10 MB part; the browser PUTs each part directly (retrying a
   dropped/corrupted chunk up to 6×), with real progress/speed/ETA in
   `src/app/lib/storage.ts`; `complete` finalizes via `ListParts` (browser never
   reads cross-origin ETags). Bytes never pass through Netlify → reliable for
   500 MB–2 GB. (Earlier single-shot/TUS approaches were dropped — Supabase's
   single-request upload fails on large files.)
2. **Manage/download (employee-only):** `GoogleSignIn` gets a Google ID token →
   `POST /api/auth/google` verifies it with `google-auth-library`, checks
   `email_verified` + `@thegrovery.com`, sets an httpOnly session cookie (`jose`).
   `list-files` / `file-link` / `delete-file` re-check the session on every call.
3. **Share links (public):** `POST /api/file-link` stores `{id, storage_path, expires_at}`
   in the `short_links` Postgres table; `/f/[id]` → `GET /api/resolve-link` mints a
   fresh 1-hour signed URL per visit (no login needed for the client downloading).

## Key files
- `src/app/lib/storage.ts` — client S3 multipart upload (per-part retry + progress); `formatSpeed`/`formatEta`.
- `src/app/lib/s3Storage.ts` — server S3 client for the Supabase S3 endpoint, `PART_SIZE`.
- `src/pages/api/upload/{create,complete,abort}.ts` — password-gated multipart lifecycle.
- `src/app/lib/uploadPassword.ts` — shared server-side `passwordMatches` (timing-safe).
- `src/app/lib/supabaseServer.ts` — service-role client (server only), `BUCKET`.
- `src/app/lib/auth.ts` — `isAllowedGroveryEmail`, `makeShortId` (+ tests).
- `src/app/lib/session.ts` — signed session cookie helpers (+ tests).
- `src/pages/api/*` — all server logic; manage endpoints guard with `requireSession`.

## Environment variables (.env.local locally; set in Netlify UI for prod)
Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_S3_ACCESS_KEY_ID`,
`SUPABASE_S3_SECRET_ACCESS_KEY` (Storage → S3 Configuration; used for multipart),
`UPLOAD_PASSWORD` (comma-separated ok), `SESSION_SECRET`, `ALLOWED_EMAIL_DOMAIN`,
`RESEND_API_KEY`, `NOTIFY_EMAIL`, `FROM_EMAIL`, `SUPABASE_BUCKET`.
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
- **Two storage size limits:** the per-bucket `file_size_limit` (set to 5 GB) AND a
  project-wide **global upload limit** (Storage → Settings, defaults to 50 MB) that
  *caps* the bucket. Both must be ≥ the largest file or uploads 413 past the smaller.
- **`bad record mac` / `ERR_SSL_BAD_RECORD_MAC_ALERT` during upload** = the client's
  network is corrupting TLS on the upload path (router/modem/ISP), not an app bug.
  Multipart per-part retry mitigates it; a clean network resolves it.
- **Old files** from the suspended AWS S3 bucket were never migrated (inaccessible).
- Email via Resend is best-effort: if `RESEND_API_KEY`/`FROM_EMAIL` unset or the domain
  isn't verified in Resend, the upload still succeeds; the notification is skipped.

## TODO / possible follow-ups
- API-layer rate limiting on the password / share-link endpoints (client lockout is cosmetic).
- The legacy `file-upload-tool.thegrovery.dev` → `files.thegrovery.com` 301 needs its
  Netlify TLS cert to include the `.dev` alias (auto-reissue was lagging; force via
  Netlify → Domain management → HTTPS → Renew certificate).
- Rotate the leaked legacy secrets still in old git history (SendGrid, Google refresh
  token, Upstash token) if any downstream systems still trust them.
