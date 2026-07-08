# Task 2.1 / 2.2 / 2.3 Implementation Report

Branch: `supabase-netlify-migration`
Repo: `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload`
Plan: `docs/superpowers/plans/2026-07-02-supabase-netlify-migration.md`

## Files created / modified / deleted

### Task 2.1 — Upload-URL API
- **Created:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/pages/api/upload-url.ts`
  - `POST /api/upload-url` body `{ password, fileName }` → `{ path, token }` or 401/400.
  - Uses `passwordMatches()` helper supporting a comma-separated `UPLOAD_PASSWORD` list, each candidate compared with `crypto.timingSafeEqual`.
  - Uses `getServiceClient()` / `BUCKET` from `src/app/lib/supabaseServer.ts`.

### Task 2.2 — Client storage helper (replaces s3.ts)
- **Created:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/app/lib/storage.ts`
  - Exports `uploadFile(file, password, onProgress)`. Calls `/api/upload-url` for a signed token, then `supabase.storage.from(BUCKET).uploadToSignedUrl(...)` directly from the browser (file never touches the Next.js server).
- **Deleted:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/app/lib/s3.ts` (`git rm`)

### Task 2.3 — Wire upload.tsx to the new flow + notify endpoint
- **Modified:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/app/components/UploadAuth.tsx`
  - `onAuthenticated` prop type changed to `(password: string) => void`.
  - `handleSubmit` is now `async`; removed the client-side `NEXT_PUBLIC_UPLOAD_PASSWORDS` check entirely. Now POSTs `{ password, fileName: '__probe__' }` to `/api/upload-url`; on `res.ok` calls `onAuthenticated(password)` and resets attempts/lockout; otherwise runs the existing attempts/lockout logic unchanged.
  - Preserved all existing lockout/attempts UX and styling.
- **Modified:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/app/components/upload.tsx`
  - Added `const [password, setPassword] = useState('')`.
  - `UploadAuth` usage: `onAuthenticated={(pw) => { setPassword(pw); setIsAuthenticated(true); }}`.
  - Replaced `import { uploadToS3 } from '@/app/lib/s3'` with `import { uploadFile } from '@/app/lib/storage'`.
  - `handleUpload` now calls `uploadFile(files[i], password, cb)` instead of `uploadToS3`.
  - Notification fetch target changed from `/api/send-upload-notification` (body included `recipientEmail`) to `/api/notify-upload` (body `{ fileName }` only — recipient now resolved server-side from `NOTIFY_EMAIL`).
  - Left the harmless `File type not allowed` catch branch in place (dead code path now that the server accepts all types) per plan's "keep ... harmlessly or delete it" allowance.
- **Created:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/pages/api/notify-upload.ts`
  - `POST /api/notify-upload` body `{ fileName }`. Uses `resend` package; reads `RESEND_API_KEY`, `NOTIFY_EMAIL` (to), `FROM_EMAIL` (from). Best-effort: returns `{ ok: false, skipped: true }` (HTTP 200) if any env var missing, never fails the upload.
- **Deleted:** `/Users/sbjm4max/Sites/file-upload-tool/s3fileupload/src/pages/api/send-upload-notification.ts` (`git rm`)

No changes were made to `.env.local`.

## Verification

### 1. `pnpm test`

```
> s3fileupload@0.1.0 test /Users/sbjm4max/Sites/file-upload-tool/s3fileupload
> vitest run


 RUN  v4.1.9 /Users/sbjm4max/Sites/file-upload-tool/s3fileupload


 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  15:18:29
   Duration  250ms (transform 46ms, setup 0ms, import 81ms, tests 7ms, environment 0ms)
```

All existing lib tests (`auth.test.ts`, `session.test.ts`) pass unchanged.

### 2. `pnpm build`

```
> s3fileupload@0.1.0 build /Users/sbjm4max/Sites/file-upload-tool/s3fileupload
> next build

   ▲ Next.js 15.3.2
   - Environments: .env.local

   Creating an optimized production build ...
Failed to compile.

./src/app/lib/generatePresignedUrl.ts
Module not found: Can't resolve 'aws-sdk'

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./src/app/components/DownloadFiles.tsx
./src/app/page.tsx

./src/pages/api/delete-file.ts
Module not found: Can't resolve 'aws-sdk'

https://nextjs.org/docs/messages/module-not-found

./src/pages/api/generate-short-url.ts
Module not found: Can't resolve 'aws-sdk'

https://nextjs.org/docs/messages/module-not-found

./src/pages/api/generate-short-url.ts
Module not found: Can't resolve '@vercel/kv'

https://nextjs.org/docs/messages/module-not-found

./src/pages/api/get-presigned-url.ts
Module not found: Can't resolve '@vercel/kv'

https://nextjs.org/docs/messages/module-not-found


> Build failed because of webpack errors
 ELIFECYCLE  Command failed with exit code 1.
```

**Remaining errors — precise list and location:**

| File | Error |
|---|---|
| `src/app/lib/generatePresignedUrl.ts` (imported via `src/app/components/DownloadFiles.tsx` → `src/app/page.tsx`) | `Module not found: Can't resolve 'aws-sdk'` |
| `src/pages/api/delete-file.ts` | `Module not found: Can't resolve 'aws-sdk'` |
| `src/pages/api/generate-short-url.ts` | `Module not found: Can't resolve 'aws-sdk'` and `Module not found: Can't resolve '@vercel/kv'` |
| `src/pages/api/get-presigned-url.ts` | `Module not found: Can't resolve '@vercel/kv'` |

All four are in the download/list/delete/short-url side of the app, explicitly out of scope for this task (to be migrated in Phase 3/4 per the plan: Task 3.1/3.2/4.2/4.3). `aws-sdk` and `@vercel/kv` were already removed from `package.json` in Task 0.2, so these failures pre-date this work and are expected.

**Confirmed clean:** none of the files touched in Tasks 2.1–2.3 (`upload.tsx`, `UploadAuth.tsx`, `upload-url.ts`, `storage.ts`, `notify-upload.ts`) appear anywhere in the build error output. Grepped the codebase for any remaining references to the removed `src/app/lib/s3.ts` or `src/pages/api/send-upload-notification.ts` — none found.

## Commits (this session)

```
3fef56b feat: wire upload UI to Supabase signed-URL flow + server-side password + notify
46c0571 feat: client upload helper via Supabase signed URL; remove aws s3 lib
14fd0cc feat: password-gated signed upload URL endpoint
1da78ad feat: signed httpOnly session token helpers with tests   (pre-existing, prior session)
a189624 feat: server Supabase client + domain/short-id helpers with tests   (pre-existing, prior session)
6e4d051 chore: swap AWS/Upstash deps for Supabase, google-auth, jose; drop leaked env inlining   (pre-existing, prior session)
ec4c4d3 docs: migration spec + implementation plan   (pre-existing, prior session)
8d2ec70 upload fixes, throw toast error if disallowed file   (pre-existing, prior session)
```

New commits from this session: `14fd0cc`, `46c0571`, `3fef56b` (Tasks 2.1, 2.2, 2.3 respectively).

Each commit message matches the plan's exact wording, with a `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer added. Files were staged individually (`git add <path>`) per task, never `git add -A`/`.`.

## Concerns / deviations / ambiguities

1. **Task 2.2 commit staging order.** The plan's Task 2.2 has `git rm s3.ts` in Step 2 (no commit) and `git add storage.ts` + commit in Step 4. Followed literally, this means the single Task-2.2 commit contains both the `s3.ts` deletion and the new `storage.ts` file — which matches the plan's commit message ("remove aws s3 lib"). This is intentional per the plan's own sequencing, not a deviation.
2. **`.env.local` and `UPLOAD_PASSWORD`/`RESEND_API_KEY`/etc.** Not read, opened, or modified at any point, per instructions. Verification relied solely on `pnpm test` (no env needed) and `pnpm build` (uses whatever `.env.local` already has; build failures observed are unrelated to env values — they are missing npm packages in unrelated files).
3. **No live/dev-server testing was performed**, per instructions — no `pnpm dev`, no curl against `/api/upload-url`, no manual end-to-end upload. This is left for the user as instructed.
4. **"File type not allowed" dead branch** in `upload.tsx` was left in place rather than deleted, since the plan explicitly allows either choice ("keep... harmlessly or delete it") and leaving it is the smaller diff.
5. No other ambiguities encountered — the plan's code for Tasks 2.1–2.3 was used verbatim, including the comma-separated `UPLOAD_PASSWORD` / `passwordMatches` timing-safe implementation as specifically required.
