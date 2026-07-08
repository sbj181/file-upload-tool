# Final Security + Correctness Review — S3→Supabase Migration

Reviewed against: `/tmp/review-diff.txt`, `/tmp/review-stat.txt`, and current `main` working tree.
Scope: upload-url, auth (Google + session), list-files/delete-file/file-link, resolve-link, storage.ts/upload.tsx, next.config.mjs.

---

## Summary

- **Critical: 0**
- **Important: 2**
- **Minor: 3**

No finding allows an unauthenticated user to bypass the upload password, forge a session, read another Grovery account's session, or exfiltrate secrets from the client bundle. The two Important findings are a public, unauthenticated endpoint that allows email/HTML injection and endpoint abuse, and the complete absence of any rate limiting on password/auth-guessing endpoints (defense-in-depth gap, not a bypass).

---

## Important Findings

### 1. `src/pages/api/notify-upload.ts:4-24` — Unauthenticated endpoint, unsanitized HTML injection into email

**Severity:** Important

The `/api/notify-upload` handler has no password check, no session check, and no CSRF/origin check at all — it is reachable by anyone on the internet, not just users who passed the upload-password gate. It takes `fileName` straight from the request body and interpolates it unescaped into an HTML email body:

```ts
const { fileName } = req.body || {};
...
html: `<p>A new file <strong>${fileName}</strong> was uploaded to the Grovery file tool.</p>`,
```

**Exploit scenario:** Anyone can `POST /api/notify-upload` with an arbitrary `fileName` (no relation to any real upload is enforced) containing HTML/links, e.g. `fileName: "<a href=http://evil.example>click</a>"`, and repeatedly trigger emails to `NOTIFY_EMAIL` (spam/phishing-content injection into an internal inbox), or simply flood Resend's send quota / the recipient's inbox since there's no rate limit and no correlation to an actual completed upload.

**Fix:** Require the same upload-password check (or better, have `/api/upload-url` itself trigger the notification server-side, tying it to a real signed-upload event) and HTML-escape `fileName` before interpolating (or use a templating approach that escapes by default). At minimum, reject requests without evidence of a real upload (e.g., include the `path` returned by `upload-url` and verify the object exists in the bucket before emailing).

---

### 2. No rate limiting anywhere (`upload-url.ts`, `auth/google.ts`, `resolve-link.ts`) — brute-force / enumeration exposure

**Severity:** Important

Confirmed via repo-wide search: there is no middleware, no rate-limiter library, and no lockout logic on the server for any endpoint. The only "lockout" is client-side in `src/app/components/UploadAuth.tsx:41-45` (`localStorage`-based attempt counter), which is trivially bypassed by clearing localStorage, using a private window, or scripting requests directly against `/api/upload-url`.

**Exploit scenario:**
- `/api/upload-url` password check (`src/pages/api/upload-url.ts:14-24`) is timing-safe per-comparison but has no attempt cap server-side — an attacker can script unlimited password guesses directly against the API, bypassing the UI's fake 5-attempt/15-minute lockout entirely.
- `/api/resolve-link` (public by design) accepts an 8-hex-char id (32 bits of randomness, `makeShortId()` in `src/app/lib/auth.ts:15-17`) with no throttling, so at scale an attacker could brute-force short-link IDs to discover other users' shared files before they expire (7-day link lifetime × unlimited guess rate = meaningful exposure window, though 2^32 space makes this impractical at low request rates — still a defense-in-depth gap).
- `/api/auth/google` has no throttling either, though the actual bypass surface there is Google's token verification, not a guessable secret, so this is lower risk.

**Fix:** Add server-side rate limiting (e.g., IP + endpoint based, via an edge middleware or a simple in-memory/Upstash-backed limiter) on `upload-url`, `resolve-link`, and `auth/google` at minimum. This is the standard mitigation for a shared-secret-gated endpoint with no per-user identity.

---

## Minor Findings

### 3. `src/pages/api/upload-url.ts:36-38` — password probe endpoint doubles as unauthenticated "upload slot" generator

**Severity:** Minor

`UploadAuth.tsx:48-52` calls `/api/upload-url` with a dummy `fileName: '__probe__'` purely to validate the password. Because the real handler doesn't distinguish a "check password" call from a "give me an upload URL" call, every failed or successful login attempt (including the probe) creates a real Supabase signed-upload-URL and consumes a real random directory prefix, even though it's never used. Not a security hole (the signed URL requires still knowing storage internals and expires), but it's unnecessary load/quota consumption on Supabase Storage and slightly muddies audit logs. Consider a dedicated `/api/verify-password` endpoint that does only the password check.

### 4. `src/pages/api/list-files.ts:13-25` — Assumes exactly one level of folder nesting

**Severity:** Minor

The listing logic treats `entry.id === null` as "this is a folder" and lists one level deep, but does not recurse further. Since `upload-url.ts` always writes to `${timestamp}-${random}/${sanitizedName}` (exactly one folder level), this matches current write behavior and is **not currently exploitable/broken** — flagging only because if the upload path scheme ever changes to add another nesting level, files would silently disappear from the manage UI without any error. Not a security issue, just a latent correctness trap. Confirmed current behavior is correct for the actual path scheme in use.

### 5. `src/pages/api/file-link.ts:12` — `path` accepted from client without validating it refers to an existing object

**Severity:** Minor

`file-link.ts` requires a valid session (good — checked before any DB action), but does not verify that the client-supplied `path` actually exists in the bucket before inserting a `short_links` row. An authenticated (Grovery-employee) user could create a short link pointing at an arbitrary non-existent or guessed path. Since this requires a valid employee session already (not a privilege escalation — they already have full list/delete access via `list-files`/`delete-file`), impact is minimal: worst case is a dead/guessable share link created by a trusted user. `resolve-link.ts` correctly re-signs against Supabase Storage and will simply fail if the path doesn't exist, so this doesn't leak data beyond what an authenticated user could already list. No fix required unless stricter auditing of share-link creation is desired.

---

## Confirmed Correct

- **`src/pages/api/upload-url.ts`** — Password comparison uses `crypto.timingSafeEqual` per-candidate (`timingSafeEqual`, lines 5-10) with a length check first (returns `false` early on mismatched length rather than throwing, which is correct — `timingSafeEqual` throws on unequal-length buffers). Every candidate is compared (loop doesn't short-circuit), so timing does not leak *which* candidate index matched, and it doesn't early-return on first match either — good constant-ish behavior for a multi-candidate list. `sanitize()` strips everything except `[a-zA-Z0-9._-]`, which neutralizes `/` and `..` — confirmed via direct test that `../../etc/passwd` sanitizes to `.._.._etc_passwd`, no path traversal possible. The random `${Date.now()}-${crypto.randomBytes(3)}/` prefix additionally prevents overwrite/collision attacks. Password is never returned to the client, only a 401/200 status — no leak.
- **`src/app/lib/auth.ts` `isAllowedGroveryEmail`** — Correctly requires `verified === true` (strict boolean check, not truthy), extracts domain via `lastIndexOf('@')` and does exact (not `.endsWith`) domain comparison — confirmed this rejects both `evil-thegrovery.com` (no `@` match) and `a@thegrovery.com.evil.com` (domain extracted is `thegrovery.com.evil.com`, not equal to `thegrovery.com`). Existing unit tests in `auth.test.ts` explicitly cover both bypass attempts and pass.
- **`src/pages/api/auth/google.ts`** — `audience: clientId` is passed to `verifyIdToken`, so tokens minted for a different OAuth client are rejected. Session cookie is only issued after both signature verification and the domain/verified check succeed. Errors are caught and collapsed to a generic 401 (no stack trace or internals leaked).
- **`src/app/lib/session.ts`** — Uses `jose`'s `SignJWT`/`jwtVerify` (HS256) with a secret pulled from `SESSION_SECRET` env (never hardcoded), enforces a minimum secret length of 16 chars before use, sets 12h expiration. Cookie is set with `HttpOnly; Secure; SameSite=Lax; Path=/` in `auth/google.ts:24` — correct flags for a session cookie (HttpOnly blocks JS/XSS exfiltration, Secure requires HTTPS, SameSite=Lax mitigates CSRF for state-changing GETs while still allowing top-level navigation). Logout correctly clears via `Max-Age=0` with matching flags.
- **`list-files.ts` / `delete-file.ts` / `file-link.ts`** — All three call `requireSession`/`verifySessionToken` and return 401 **before** touching Supabase storage or the DB in every case (confirmed by line order in each handler). No storage/DB call happens on the unauthenticated path.
- **`resolve-link.ts`** — Expiry is enforced (`new Date(row.expires_at).getTime() < Date.now()` → 404) before minting a signed URL; it does not exist until a valid, unexpired row is found. Endpoint is intentionally public per the design and doesn't leak whether an ID "almost" exists (uniform 404 for both not-found and expired).
- **`src/app/lib/storage.ts` / `upload.tsx`** — No secrets referenced beyond `NEXT_PUBLIC_SUPABASE_URL` (intentionally public — Supabase anon/project URL is not a secret) and the signed `token` returned from the server per-upload. Service-role key (`supabaseServer.ts`) is only ever referenced in `src/pages/api/*` server files, never imported by any client component — confirmed no `NEXT_PUBLIC_` prefix on `SUPABASE_SERVICE_ROLE_KEY` or `SESSION_SECRET` or `UPLOAD_PASSWORD` in `.env.example`, so none of them are inlined into the client bundle by Next.js's env handling.
- **`next.config.mjs`** — Confirmed the old S3 migration diff removed the `env: { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY }` block entirely; current config is `const nextConfig = {};` — no secrets inlined, nothing to leak.
