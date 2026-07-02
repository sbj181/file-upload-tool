# Grovery File Upload Tool — Storage & Hosting Migration

**Date:** 2026-07-02
**Author:** Scott Johnson + Claude
**Status:** Approved design — pending implementation plan

## 1. Purpose & context

The Grovery runs an internal file-transfer tool ("s3fileupload") for moving files
that are too large to email — both for the team to share files and for **clients to
upload large files to The Grovery** (given a password). It was built on Next.js 15 +
Tailwind, deployed on Vercel, storing files in AWS S3, with Upstash Redis for short
links and SendGrid for email notifications.

The AWS account was suspended (billing), which took the tool offline — the UI works
but there is no reachable storage. This project rebuilds the backend on **Supabase**
and moves hosting to **Netlify** (the company standard), while **keeping the existing
UI unchanged** and **fixing serious security holes** in the original implementation.

## 2. Problems in the current implementation (must be fixed)

1. **AWS secret key shipped to the browser.** `next.config.mjs` inlines
   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` into the client bundle, and uploads
   run directly from the browser. Credentials were publicly extractable.
2. **Upload passwords are public.** `NEXT_PUBLIC_UPLOAD_PASSWORDS` is baked into the
   client bundle.
3. **Download/list/delete APIs are unauthenticated.** Google Sign-In is real, but the
   token is never verified server-side and no domain check exists; `/api/list-s3-files`
   and `/api/delete-file` answer any caller.
4. **Leaked live secrets** in `.env.local` (SendGrid, Google refresh token, Upstash) —
   rotate all of them.
5. Deprecated `aws-sdk` v2 and dead code referencing a second bucket (`thegroveryfiles`).

## 3. Target architecture

One backend service (Supabase) replaces AWS S3 + Upstash + the unverified auth.

- **Storage:** Supabase Storage, a single **private** bucket `grovery-uploads`.
  No public objects; every download is a short-lived signed URL minted server-side.
  Hosted in the **paid Supabase org** (no 50 MB free-tier cap, no idle auto-pause).
  **Files can be up to ~2 GB** (occasional one-off large shares). Supabase Pro allows
  up to 50 GB/file, so 2 GB is well within range, but this requires:
  - The bucket's **file-size limit must be raised** (default is 50 MB even on Pro) —
    set to e.g. 5 GB to give headroom above the 2 GB working size.
  - **Resumable (TUS) uploads are mandatory** for these sizes — the standard
    single-request upload is not reliable for multi-GB files. The browser uploads
    directly to Storage via the resumable protocol using the signed session.
  - **Egress note:** each 2 GB download counts against Pro's 250 GB/mo included
    egress (then ~$0.09/GB). Fine for one-offs; encourage deleting big files after
    the client has downloaded them.
- **Short links:** Postgres table `short_links` replaces Upstash Redis.
- **Auth:** two independent gates, both enforced on the server:
  - **Upload gate** — a shared password (`UPLOAD_PASSWORD`, server-only env var),
    verified in an API route. Handed to clients so they can upload large files.
  - **Manage gate** — Google Workspace SSO via Supabase Auth, restricted to the
    `@thegrovery.com` domain, verified on every list/download/delete call.
- **Email:** SendGrid retained (key rotated) for upload notifications.
- **Hosting:** Netlify with the official Next.js runtime. API routes become functions.

### Data flow — upload (works for large files, may be given to clients)

1. User enters the shared password. `POST /api/upload-url` verifies it against the
   server-only `UPLOAD_PASSWORD`.
2. On success the server returns a **short-lived signed upload token/URL** for a
   target path in `grovery-uploads`.
3. The browser uploads **directly to Supabase Storage** (resumable/TUS for large
   files) using that token — bytes never pass through the serverless function, so
   there is no function payload/timeout limit, and the progress bar is preserved.
4. On completion, the client calls `POST /api/notify-upload`, which sends a SendGrid
   notification to the team.

### Data flow — view / download / manage (employees only)

1. Employee signs in with Google (existing UI) via Supabase Auth; provider is
   domain-restricted to `thegrovery.com`.
2. `GET /api/list-files` verifies the Supabase session server-side AND that the
   user's email is verified and ends in `@thegrovery.com`, then lists the bucket.
3. Download / copy-link → `POST /api/file-link` (same auth check) mints a fresh
   time-limited signed URL, optionally wrapped in a short link.
4. `DELETE /api/delete-file` (same auth check) removes the object.

### Data flow — share link (external clients, no login)

1. Server stores `{ id, storage_path, expires_at }` in `short_links`.
2. `/f/{id}` page → `GET /api/get-signed-url?id=` looks up the path and mints a
   **fresh** signed URL on each visit (more robust than the old approach of freezing
   a presigned URL into Redis), then redirects the client to the download.

## 4. Components / files (in existing Next.js app under `s3fileupload/`)

Reused as-is (UI): `page.tsx`, `upload.tsx`, `UploadAuth.tsx`, `DownloadFiles.tsx`,
`GoogleSignIn.tsx`, `RandomBackground.tsx`, `ThemeToggler.tsx`, `Footer.tsx`,
`getFileIcon.tsx`, styling/branding.

Replaced / new:
- `src/app/lib/s3.ts` → `src/app/lib/storage.ts` (Supabase client-side upload helper;
  no credentials in the browser — uses signed tokens only).
- `src/app/lib/supabaseServer.ts` (new) — server Supabase client using
  `SUPABASE_SERVICE_ROLE_KEY`; helper `requireGroveryUser(req)` that validates the
  session + `@thegrovery.com` domain.
- API routes (Pages Router `src/pages/api/`), all auth-checked server-side:
  - `upload-url.ts` (password → signed upload token)
  - `notify-upload.ts` (SendGrid)
  - `list-files.ts` (employee-only)
  - `file-link.ts` (employee-only signed URL + short link)
  - `delete-file.ts` (employee-only)
  - `get-signed-url.ts` / short-link resolver for `/f/[id]`
  - Remove: `generate-short-url.ts`, `redirect-to-file.ts`, `get-presigned-url.ts`,
    `list-s3-files.ts` (superseded).
- `next.config.mjs` — remove the `env` block that leaked AWS keys.
- `.env.local` — new Supabase/SendGrid vars; all keys server-side except the Supabase
  URL + anon key (which are safe to be public).

## 5. Environment variables (shape only)

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPLOAD_PASSWORD`
- `SENDGRID_API_KEY`
- `NOTIFY_EMAIL` (recipient for upload notifications)

Public (safe):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Removed: all `AWS_*`, `NEXT_PUBLIC_UPLOAD_PASSWORDS`, `KV_*`, Google refresh token.

## 6. Supabase resources (provisioned via MCP where possible)

- New project in the **paid** org.
- Private Storage bucket `grovery-uploads`, **file-size limit raised to ~5 GB**.
- Table `public.short_links (id text pk, storage_path text not null,
  created_at timestamptz default now(), expires_at timestamptz)` with RLS enabled;
  access only via service role (server).
- Auth: Google provider enabled, domain-restricted to `thegrovery.com`.

## 7. External setup required from Scott

1. **Supabase** — confirm the paid org; provide project URL + service_role key
   (anon key retrievable via the connection).
2. **Google OAuth client** — one Cloud Console client with Supabase's redirect URL;
   consent screen on the Workspace org. Enables SSO. (Slowest step — upload path can
   ship before this is wired.)
3. **SendGrid** — rotate the leaked key; confirm verified sender.
4. **Netlify** — connect a site to the repo. This folder must become a git repo and
   be pushed (also needed for deploy).

## 8. Migration / rollout notes

- **Old files stay in the suspended AWS account** and cannot be migrated now; the new
  bucket starts empty. If AWS reactivates, files can be copied over later.
- **Ship order** (to unblock the BMS client file fast):
  1. Supabase storage + upload path + share links (no SSO needed) → send files today.
  2. Google Workspace SSO for the manage/download dashboard.
  3. Netlify deploy + custom domain, decommission Vercel.
- Rotate the three leaked secrets regardless of timeline.

## 9. Out of scope (YAGNI)

- Migrating historical files from the dead S3 bucket (do later if AWS returns).
- Per-user accounts/roles beyond "is a @thegrovery.com employee."
- File previews, folders, or search — current flat list is sufficient.

## 10. Testing

- Upload path: correct password required; wrong password rejected server-side; a
  **~2 GB** file uploads end-to-end via resumable upload with working progress and
  survives a flaky connection; notification email sent.
- Manage path: non-Grovery Google account rejected by the server; list/delete work
  for `@thegrovery.com`; APIs reject unauthenticated calls directly.
- Share link: `/f/{id}` resolves for an anonymous visitor and expires correctly.
