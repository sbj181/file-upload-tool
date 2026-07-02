# Grovery File Upload Tool — Supabase + Netlify Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the file-upload tool's backend on Supabase (Storage + Postgres) and move hosting to Netlify, keeping the existing UI, fixing the security holes, and supporting ~2 GB one-off uploads.

**Architecture:** Next.js 15 app, unchanged UI. All storage/DB access happens **server-side** in API routes using the Supabase `service_role` key. Uploads are password-gated server-side, then the browser uploads directly to a private Supabase Storage bucket via a signed upload URL. Employee-only endpoints (list/link/delete) verify a Google ID token server-side (domain-locked to `@thegrovery.com`) and an httpOnly session cookie. External clients download via public `/f/{id}` short links backed by a Postgres table.

**Tech Stack:** Next.js 15, React 19, Tailwind, `@supabase/supabase-js`, `google-auth-library`, `resend` (email), `jose` (session cookie signing), Netlify (`@netlify/plugin-nextjs`).

## Global Constraints

- **No secrets in the client bundle.** Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` may be public. Everything else is server-only.
- **Remove the `env` block from `next.config.mjs`** (it leaked AWS keys) — do not reintroduce any pattern that inlines secrets.
- Supabase project ref: `jecgqkbceftvvlmdipka` · URL `https://jecgqkbceftvvlmdipka.supabase.co` · org "The Grovery" (Pro).
- Storage bucket: `grovery-uploads`, **private**, file-size limit **5 GB**.
- Employee domain gate: email must be verified AND end in `@thegrovery.com` (case-insensitive).
- Package manager: **pnpm** (lockfile present).
- Node built-in `node --test` is not used; tests run under **vitest**.
- Email via **Resend** (`resend` package), not SendGrid. Rotate the leaked SendGrid key (retire it), Google client secret, and Upstash token out of band (not a code task).

---

## Phase 0 — Provisioning & project setup

### Task 0.1: Provision Supabase resources (bucket + short_links table)

Done via the Supabase MCP connection (no local code). Verify before writing code.

**Files:** none (infrastructure)

- [ ] **Step 1: Create the private storage bucket**
  Via MCP `execute_sql` / storage admin, create bucket `grovery-uploads`: `public = false`, `file_size_limit = 5368709120` (5 GB). Allowed MIME types: null (allow all — creative files vary).

- [ ] **Step 2: Create the `short_links` table**
  Apply migration:
```sql
create table if not exists public.short_links (
  id text primary key,
  storage_path text not null,
  original_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.short_links enable row level security;
-- No policies: only the service_role (server) may read/write.
create index if not exists short_links_expires_idx on public.short_links (expires_at);
```

- [ ] **Step 3: Verify**
  Run MCP `list_tables` (schema `public`) → `short_links` present. Confirm bucket exists and `public=false`.
  Run MCP `get_advisors` type `security` → no new critical issues from this table.

### Task 0.2: Dependencies and env scaffolding

**Files:**
- Modify: `s3fileupload/package.json`
- Create: `s3fileupload/.env.local` (replace contents)
- Create: `s3fileupload/.env.example`
- Modify: `s3fileupload/next.config.mjs`

- [ ] **Step 1: Install/remove dependencies**
```bash
cd s3fileupload
pnpm remove aws-sdk @vercel/kv @sendgrid/mail
pnpm add @supabase/supabase-js google-auth-library jose resend
pnpm add -D vitest
```

- [ ] **Step 2: Add test script to package.json**
  In `"scripts"` add: `"test": "vitest run"`.

- [ ] **Step 3: Rewrite `.env.local`** (fill real values; service_role from Supabase dashboard → Settings → API)
```
NEXT_PUBLIC_SUPABASE_URL=https://jecgqkbceftvvlmdipka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplY2dxa2JjZWZ0dnZsbWRpcGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTkzMjUsImV4cCI6MjA5ODU3NTMyNX0.YdAXt46DOOEBmcRqg9iox9LXAzR7G6yVJi-UaBiOvbE
SUPABASE_SERVICE_ROLE_KEY=__PASTE_SERVICE_ROLE_KEY__
SUPABASE_BUCKET=grovery-uploads
UPLOAD_PASSWORD=__CHOOSE_A_STRONG_SHARED_PASSWORD__
NEXT_PUBLIC_GOOGLE_CLIENT_ID=615700893919-ft0lojlf7qm9ugukh03i48v1fd6sl7b2.apps.googleusercontent.com
ALLOWED_EMAIL_DOMAIN=thegrovery.com
SESSION_SECRET=__RANDOM_32+_CHAR_SECRET__
RESEND_API_KEY=__RESEND_API_KEY__
NOTIFY_EMAIL=hello@thegrovery.com
EMAIL_FROM=__VERIFIED_RESEND_SENDER__
```

- [ ] **Step 4: Create `.env.example`** — same keys as above with all values blanked/placeholdered.

- [ ] **Step 5: Strip secrets from `next.config.mjs`**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 6: Confirm `.gitignore` ignores `.env.local`**
  Run: `grep -n '.env' s3fileupload/.gitignore` → expect `.env*.local` present (Next default). If missing, add `.env*.local`.

- [ ] **Step 7: Commit**
```bash
git add s3fileupload/package.json s3fileupload/pnpm-lock.yaml s3fileupload/.env.example s3fileupload/next.config.mjs s3fileupload/.gitignore
git commit -m "chore: swap AWS/Upstash deps for Supabase, google-auth, jose; drop leaked env inlining"
```

---

## Phase 1 — Server foundations (Supabase client + helpers)

### Task 1.1: Supabase server client + pure helpers

**Files:**
- Create: `s3fileupload/src/app/lib/supabaseServer.ts`
- Create: `s3fileupload/src/app/lib/auth.ts`
- Test: `s3fileupload/src/app/lib/auth.test.ts`

**Interfaces:**
- Produces: `getServiceClient(): SupabaseClient` (server-only Supabase client).
- Produces: `isAllowedGroveryEmail(email: string | undefined, verified: boolean | undefined, domain: string): boolean`.
- Produces: `makeShortId(bytes?: number): string` (hex id, default 4 bytes = 8 chars).

- [ ] **Step 1: Write failing tests** `src/app/lib/auth.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { isAllowedGroveryEmail, makeShortId } from './auth';

describe('isAllowedGroveryEmail', () => {
  it('accepts verified @thegrovery.com', () => {
    expect(isAllowedGroveryEmail('scottj@thegrovery.com', true, 'thegrovery.com')).toBe(true);
  });
  it('is case-insensitive on domain', () => {
    expect(isAllowedGroveryEmail('Scott@TheGrovery.com', true, 'thegrovery.com')).toBe(true);
  });
  it('rejects unverified email', () => {
    expect(isAllowedGroveryEmail('scottj@thegrovery.com', false, 'thegrovery.com')).toBe(false);
  });
  it('rejects other domains', () => {
    expect(isAllowedGroveryEmail('scott@gmail.com', true, 'thegrovery.com')).toBe(false);
  });
  it('rejects lookalike domains', () => {
    expect(isAllowedGroveryEmail('a@thegrovery.com.evil.com', true, 'thegrovery.com')).toBe(false);
  });
  it('rejects undefined', () => {
    expect(isAllowedGroveryEmail(undefined, true, 'thegrovery.com')).toBe(false);
  });
});

describe('makeShortId', () => {
  it('makes an 8-char hex id by default', () => {
    expect(makeShortId()).toMatch(/^[0-9a-f]{8}$/);
  });
  it('is unique across calls', () => {
    expect(makeShortId()).not.toBe(makeShortId());
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**
  Run: `cd s3fileupload && pnpm test`
  Expected: FAIL (module `./auth` not found).

- [ ] **Step 3: Implement `src/app/lib/auth.ts`**
```ts
import crypto from 'crypto';

export function isAllowedGroveryEmail(
  email: string | undefined,
  verified: boolean | undefined,
  domain: string
): boolean {
  if (!email || verified !== true) return false;
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const emailDomain = email.slice(at + 1).toLowerCase();
  return emailDomain === domain.toLowerCase();
}

export function makeShortId(bytes = 4): string {
  return crypto.randomBytes(bytes).toString('hex');
}
```

- [ ] **Step 4: Implement `src/app/lib/supabaseServer.ts`**
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server env not configured');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export const BUCKET = process.env.SUPABASE_BUCKET || 'grovery-uploads';
```

- [ ] **Step 5: Run tests, verify pass**
  Run: `cd s3fileupload && pnpm test`
  Expected: PASS (all `auth.test.ts` cases).

- [ ] **Step 6: Commit**
```bash
git add s3fileupload/src/app/lib/supabaseServer.ts s3fileupload/src/app/lib/auth.ts s3fileupload/src/app/lib/auth.test.ts
git commit -m "feat: server Supabase client + domain/short-id helpers with tests"
```

### Task 1.2: Session cookie helpers (employee session)

**Files:**
- Create: `s3fileupload/src/app/lib/session.ts`
- Test: `s3fileupload/src/app/lib/session.test.ts`

**Interfaces:**
- Produces: `createSessionToken(email: string): Promise<string>` (signed JWT, 12h).
- Produces: `verifySessionToken(token: string | undefined): Promise<{ email: string } | null>`.
- Produces: `SESSION_COOKIE = 'grovery_session'`.

- [ ] **Step 1: Write failing test** `src/app/lib/session.test.ts`
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

beforeAll(() => { process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-1234'; });

describe('session tokens', () => {
  it('round-trips a valid token', async () => {
    const t = await createSessionToken('scottj@thegrovery.com');
    expect(await verifySessionToken(t)).toEqual({ email: 'scottj@thegrovery.com' });
  });
  it('rejects garbage', async () => {
    expect(await verifySessionToken('not-a-token')).toBeNull();
  });
  it('rejects undefined', async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify fail**
  Run: `cd s3fileupload && pnpm test session`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/app/lib/session.ts`**
```ts
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'grovery_session';

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET not configured');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.email === 'string') return { email: payload.email };
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test, verify pass**
  Run: `cd s3fileupload && pnpm test session`
  Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add s3fileupload/src/app/lib/session.ts s3fileupload/src/app/lib/session.test.ts
git commit -m "feat: signed httpOnly session token helpers with tests"
```

---

## Phase 2 — Upload path (ships first; unblocks the BMS file)

### Task 2.1: Upload-URL API (password gate → signed upload URL)

**Files:**
- Create: `s3fileupload/src/pages/api/upload-url.ts`

**Interfaces:**
- Consumes: `getServiceClient`, `BUCKET`.
- Produces: `POST /api/upload-url` body `{ password: string, fileName: string }` →
  `{ path: string, token: string }` (Supabase signed upload token) or 401/400.

- [ ] **Step 1: Implement the route**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getServiceClient, BUCKET } from '@/app/lib/supabaseServer';

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// UPLOAD_PASSWORD may be a comma-separated list; any exact match passes.
// Each candidate is compared in constant time; empty entries are ignored.
function passwordMatches(input: string): boolean {
  const candidates = (process.env.UPLOAD_PASSWORD || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let ok = false;
  for (const c of candidates) {
    if (timingSafeEqual(input, c)) ok = true;
  }
  return ok;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, fileName } = req.body || {};
  if (typeof password !== 'string' || !passwordMatches(password)) {
    return res.status(401).json({ error: 'Invalid upload password' });
  }
  if (typeof fileName !== 'string' || !fileName) {
    return res.status(400).json({ error: 'fileName required' });
  }
  // Unique path prevents collisions/overwrites.
  const path = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}/${sanitize(fileName)}`;
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return res.status(500).json({ error: 'Could not create upload URL' });
  return res.status(200).json({ path, token: data.token });
}
```

- [ ] **Step 2: Manual verification (wrong then right password)**
  Run dev server: `cd s3fileupload && pnpm dev` (separate terminal).
  Wrong password:
```bash
curl -s -X POST localhost:3000/api/upload-url -H 'Content-Type: application/json' \
  -d '{"password":"nope","fileName":"a.txt"}'
```
  Expected: `{"error":"Invalid upload password"}` (HTTP 401).
  Right password (use your UPLOAD_PASSWORD):
```bash
curl -s -X POST localhost:3000/api/upload-url -H 'Content-Type: application/json' \
  -d '{"password":"YOUR_PASSWORD","fileName":"a.txt"}'
```
  Expected: JSON with `path` and `token`.

- [ ] **Step 3: Commit**
```bash
git add s3fileupload/src/pages/api/upload-url.ts
git commit -m "feat: password-gated signed upload URL endpoint"
```

### Task 2.2: Client storage helper (replaces s3.ts)

**Files:**
- Create: `s3fileupload/src/app/lib/storage.ts`
- Delete: `s3fileupload/src/app/lib/s3.ts`

**Interfaces:**
- Consumes: `POST /api/upload-url`.
- Produces: `uploadFile(file: File, password: string, onProgress: (pct: number) => void): Promise<{ path: string }>`.

- [ ] **Step 1: Implement `src/app/lib/storage.ts`**
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

const BUCKET = 'grovery-uploads';

export async function uploadFile(
  file: File,
  password: string,
  onProgress: (pct: number) => void
): Promise<{ path: string }> {
  // 1. Get a signed upload URL from the server (password checked there).
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, fileName: file.name }),
  });
  if (!res.ok) {
    const msg = res.status === 401 ? 'Invalid upload password' : 'Could not start upload';
    throw new Error(msg);
  }
  const { path, token } = await res.json();

  // 2. Upload directly to Supabase Storage using the signed token.
  //    uploadToSignedUrl streams the whole file in one request; fine up to the
  //    5 GB bucket limit. Progress is coarse (start/end) since supabase-js does
  //    not expose per-chunk progress here.
  onProgress(1);
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error('Upload failed');
  onProgress(100);
  return { path };
}
```

- [ ] **Step 2: Delete the old S3 helper**
```bash
git rm s3fileupload/src/app/lib/s3.ts
```

- [ ] **Step 3: Verify build compiles (type check)**
  Run: `cd s3fileupload && pnpm build` (expect it to fail ONLY on files still importing `s3.ts` — those are fixed in Task 2.3; if you run this before 2.3, note the errors are limited to `upload.tsx`/`DownloadFiles.tsx`).

- [ ] **Step 4: Commit**
```bash
git add s3fileupload/src/app/lib/storage.ts
git commit -m "feat: client upload helper via Supabase signed URL; remove aws s3 lib"
```

### Task 2.3: Wire upload.tsx to the new flow + notify endpoint

**Files:**
- Modify: `s3fileupload/src/app/components/upload.tsx`
- Modify: `s3fileupload/src/app/components/UploadAuth.tsx`
- Create: `s3fileupload/src/pages/api/notify-upload.ts`
- Delete: `s3fileupload/src/pages/api/send-upload-notification.ts`

**Interfaces:**
- `UploadAuth` calls `onAuthenticated(password: string)` (now passes the password up so upload can reuse it).
- `POST /api/notify-upload` body `{ fileName: string }` → sends SendGrid email, returns `{ ok: true }`.

- [ ] **Step 1: Update `UploadAuth.tsx`** — remove the public `NEXT_PUBLIC_UPLOAD_PASSWORDS` check; verify against the server and pass the password up.
  Change the prop type to `onAuthenticated: (password: string) => void`. Replace `handleSubmit` body's validation with a server round-trip:
```ts
const res = await fetch('/api/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password, fileName: '__probe__' }),
});
if (res.ok) {
  onAuthenticated(password);
  setError('');
  setAttempts(0);
  localStorage.removeItem('uploadAuthAttempts');
  localStorage.removeItem('uploadAuthLockout');
} else {
  // existing attempts/lockout logic here (increment, lockout at MAX_ATTEMPTS)
}
```
  (Keep the existing attempts/lockout UX. Make `handleSubmit` async. Note: the `__probe__` call creates an unused signed URL — harmless, nothing is uploaded to it.)

- [ ] **Step 2: Update `upload.tsx`** — hold the password in state, use `uploadFile`, call notify.
  - Change `const [isAuthenticated, setIsAuthenticated] = useState(false)` companion to also store password: add `const [password, setPassword] = useState('')`.
  - `<UploadAuth onAuthenticated={(pw) => { setPassword(pw); setIsAuthenticated(true); }} />`.
  - Replace `import { uploadToS3 } from '@/app/lib/s3';` with `import { uploadFile } from '@/app/lib/storage';`.
  - In `handleUpload`, replace the `uploadToS3(files[i], cb)` call with:
```ts
await uploadFile(files[i], password, (percentCompleted) => {
  progressArr[i] = percentCompleted;
  setProgress([...progressArr]);
});
```
  - Replace the notification fetch URL `'/api/send-upload-notification'` with `'/api/notify-upload'` and body `{ fileName: files[i].name }`.
  - Remove the `ALLOWED_FILE_TYPES` client check reliance (server accepts all types now); keep the `File type not allowed` catch branch harmlessly or delete it.

- [ ] **Step 3: Create `src/pages/api/notify-upload.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { fileName } = req.body || {};
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.FROM_EMAIL;
  // Email is best-effort: if not configured, skip without failing the upload.
  if (!apiKey || !to || !from) return res.status(200).json({ ok: false, skipped: true });
  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from, to,
      subject: 'New file uploaded',
      html: `<p>A new file <strong>${fileName}</strong> was uploaded to the Grovery file tool.</p>`,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify error', e);
    return res.status(200).json({ ok: false });
  }
}
```

- [ ] **Step 4: Delete old notification route**
```bash
git rm s3fileupload/src/pages/api/send-upload-notification.ts
```

- [ ] **Step 5: Manual end-to-end verification**
  With `pnpm dev` running and real env values:
  1. Load the app, enter the wrong upload password → rejected.
  2. Enter the correct password → drop a file → progress reaches 100% → success toast.
  3. Confirm in the Supabase dashboard the object exists under `grovery-uploads/<timestamp>-.../<name>`.
  4. Confirm the notification email arrives (or is cleanly skipped if SendGrid not yet set).
  5. **Large-file check:** repeat with a ~2 GB file; confirm it completes.

- [ ] **Step 6: Commit**
```bash
git add s3fileupload/src/app/components/upload.tsx s3fileupload/src/app/components/UploadAuth.tsx s3fileupload/src/pages/api/notify-upload.ts
git commit -m "feat: wire upload UI to Supabase signed-URL flow + server-side password + notify"
```

---

## Phase 3 — Share links (public download by short URL)

### Task 3.1: Create-link endpoint + short_links write

**Files:**
- Create: `s3fileupload/src/pages/api/file-link.ts`

**Interfaces:**
- Consumes: `getServiceClient`, `BUCKET`, `makeShortId`, employee session (Task 4.2 adds the guard; until then it is called only from the authed dashboard).
- Produces: `POST /api/file-link` body `{ path: string }` → `{ shortUrl: string }`.
  Stores `{ id, storage_path, expires_at = now + 7d }` and returns `${origin}/f/${id}`.

- [ ] **Step 1: Implement the route**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServiceClient } from '@/app/lib/supabaseServer';
import { makeShortId } from '@/app/lib/auth';
import { verifySessionToken, SESSION_COOKIE } from '@/app/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await verifySessionToken(req.cookies[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const { path } = req.body || {};
  if (typeof path !== 'string' || !path) return res.status(400).json({ error: 'path required' });

  const id = makeShortId();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getServiceClient();
  const { error } = await supabase.from('short_links').insert({
    id, storage_path: path, expires_at: expires,
  });
  if (error) return res.status(500).json({ error: 'Could not create link' });

  const origin = req.headers.origin ||
    (req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000');
  return res.status(200).json({ shortUrl: `${origin}/f/${id}` });
}
```

- [ ] **Step 2: Commit**
```bash
git add s3fileupload/src/pages/api/file-link.ts
git commit -m "feat: authed create-short-link endpoint backed by short_links table"
```

### Task 3.2: Resolve-link endpoint + `/f/[id]` page

**Files:**
- Create: `s3fileupload/src/pages/api/resolve-link.ts`
- Modify: `s3fileupload/src/app/f/[id]/page.tsx`
- Delete: `s3fileupload/src/pages/api/get-presigned-url.ts`, `s3fileupload/src/pages/api/generate-short-url.ts`, `s3fileupload/src/pages/api/redirect-to-file.ts`

**Interfaces:**
- Produces: `GET /api/resolve-link?id=<id>` → `{ url: string }` (fresh 1-hour signed download URL) or 404.

- [ ] **Step 1: Implement `src/pages/api/resolve-link.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServiceClient, BUCKET } from '@/app/lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' });
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from('short_links').select('storage_path, expires_at').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Link not found' });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(404).json({ error: 'Link expired' });
  }
  const { data, error } = await supabase.storage
    .from(BUCKET).createSignedUrl(row.storage_path, 60 * 60, { download: true });
  if (error || !data) return res.status(500).json({ error: 'Could not sign URL' });
  return res.status(200).json({ url: data.signedUrl });
}
```

- [ ] **Step 2: Update `/f/[id]/page.tsx`** — replace the fetch to `/api/get-presigned-url?id=` with `/api/resolve-link?id=`, and set `window.location.href = data.url`. Replace the fallback anchor `href={`/api/redirect-to-file?id=${params?.id}`}` with a button that re-fetches `/api/resolve-link` and navigates. Keep all the branding/markup.

- [ ] **Step 3: Delete superseded routes**
```bash
git rm s3fileupload/src/pages/api/get-presigned-url.ts s3fileupload/src/pages/api/generate-short-url.ts s3fileupload/src/pages/api/redirect-to-file.ts
```

- [ ] **Step 4: Manual verification**
  After uploading a file (Phase 2), sign in (Phase 4) and copy a link — OR temporarily insert a `short_links` row via MCP `execute_sql` pointing at a real uploaded `storage_path`, then visit `/f/<id>`.
  Expected: redirected to a working download; visiting a bogus id shows "invalid or expired".

- [ ] **Step 5: Commit**
```bash
git add s3fileupload/src/pages/api/resolve-link.ts "s3fileupload/src/app/f/[id]/page.tsx"
git commit -m "feat: fresh-signed-url short links; remove Upstash-based link routes"
```

---

## Phase 4 — Employee SSO enforcement + manage endpoints

### Task 4.1: Google-verify login endpoint (sets session cookie)

**Files:**
- Create: `s3fileupload/src/pages/api/auth/google.ts`
- Create: `s3fileupload/src/pages/api/auth/logout.ts`
- Create: `s3fileupload/src/pages/api/auth/me.ts`

**Interfaces:**
- Produces: `POST /api/auth/google` body `{ credential: string }` (Google ID token) →
  verifies token + domain, sets httpOnly `grovery_session` cookie, returns `{ email }` or 401.
- Produces: `GET /api/auth/me` → `{ email }` if session valid, else 401.
- Produces: `POST /api/auth/logout` → clears cookie.

- [ ] **Step 1: Implement `src/pages/api/auth/google.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import { isAllowedGroveryEmail } from '@/app/lib/auth';
import { createSessionToken, SESSION_COOKIE } from '@/app/lib/session';

const client = new OAuth2Client();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { credential } = req.body || {};
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const domain = process.env.ALLOWED_EMAIL_DOMAIN || 'thegrovery.com';
  if (typeof credential !== 'string' || !clientId) {
    return res.status(400).json({ error: 'Missing credential' });
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!isAllowedGroveryEmail(payload?.email, payload?.email_verified, domain)) {
      return res.status(401).json({ error: 'Not a Grovery account' });
    }
    const token = await createSessionToken(payload!.email!);
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${12 * 3600}; SameSite=Lax; Secure`);
    return res.status(200).json({ email: payload!.email });
  } catch {
    return res.status(401).json({ error: 'Invalid Google token' });
  }
}
```

- [ ] **Step 2: Implement `src/pages/api/auth/me.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySessionToken, SESSION_COOKIE } from '@/app/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await verifySessionToken(req.cookies[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json({ email: session.email });
}
```

- [ ] **Step 3: Implement `src/pages/api/auth/logout.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { SESSION_COOKIE } from '@/app/lib/session';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`);
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Commit**
```bash
git add s3fileupload/src/pages/api/auth
git commit -m "feat: server-side Google ID token verification + Grovery session cookie"
```

### Task 4.2: Guarded list + delete endpoints

**Files:**
- Create: `s3fileupload/src/pages/api/list-files.ts`
- Create: `s3fileupload/src/pages/api/delete-file.ts` (replaces old S3 one)
- Delete: `s3fileupload/src/pages/api/list-s3-files.ts`
- Create: `s3fileupload/src/app/lib/requireSession.ts`

**Interfaces:**
- Produces: `requireSession(req): Promise<{email:string}|null>` (wraps `verifySessionToken`).
- Produces: `GET /api/list-files` → `{ files: {name,path,lastModified}[] }` (401 if no session).
- Produces: `DELETE /api/delete-file?path=<path>` → `{ ok: true }` (401 if no session).

- [ ] **Step 1: Implement `src/app/lib/requireSession.ts`**
```ts
import type { NextApiRequest } from 'next';
import { verifySessionToken, SESSION_COOKIE } from './session';

export async function requireSession(req: NextApiRequest) {
  return verifySessionToken(req.cookies[SESSION_COOKIE]);
}
```

- [ ] **Step 2: Implement `src/pages/api/list-files.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServiceClient, BUCKET } from '@/app/lib/supabaseServer';
import { requireSession } from '@/app/lib/requireSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireSession(req))) return res.status(401).json({ error: 'Unauthorized' });
  const supabase = getServiceClient();
  // Files live under <folder>/<name>; list folders then their contents.
  const { data: top, error } = await supabase.storage.from(BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return res.status(500).json({ error: 'List failed' });
  const files: { name: string; path: string; lastModified: string | null }[] = [];
  for (const entry of top || []) {
    if (entry.id === null) {
      const { data: inner } = await supabase.storage.from(BUCKET).list(entry.name, { limit: 1000 });
      for (const f of inner || []) {
        files.push({
          name: f.name,
          path: `${entry.name}/${f.name}`,
          lastModified: f.created_at ?? null,
        });
      }
    } else {
      files.push({ name: entry.name, path: entry.name, lastModified: entry.created_at ?? null });
    }
  }
  return res.status(200).json({ files });
}
```

- [ ] **Step 3: Implement `src/pages/api/delete-file.ts`**
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServiceClient, BUCKET } from '@/app/lib/supabaseServer';
import { requireSession } from '@/app/lib/requireSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireSession(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { path } = req.query;
  if (!path || typeof path !== 'string') return res.status(400).json({ error: 'path required' });
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
  if (error) return res.status(500).json({ error: 'Delete failed' });
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Delete old list route**
```bash
git rm s3fileupload/src/pages/api/list-s3-files.ts
```

- [ ] **Step 5: Manual verification**
```bash
# Unauthenticated must be rejected:
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/list-files   # expect 401
```

- [ ] **Step 6: Commit**
```bash
git add s3fileupload/src/pages/api/list-files.ts s3fileupload/src/pages/api/delete-file.ts s3fileupload/src/app/lib/requireSession.ts
git commit -m "feat: session-guarded list + delete via Supabase Storage"
```

### Task 4.3: Wire DownloadFiles.tsx + GoogleSignIn to the new session

**Files:**
- Modify: `s3fileupload/src/app/components/DownloadFiles.tsx`
- Modify: `s3fileupload/src/app/components/GoogleSignIn.tsx`

- [ ] **Step 1: Update `GoogleSignIn.tsx`** — in `handleCredentialResponse`, POST the credential to `/api/auth/google` before calling `onSignIn`:
```ts
const handleCredentialResponse = async (response: { credential: string }) => {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: response.credential }),
  });
  if (res.ok) onSignIn(response.credential);
  else alert('Only @thegrovery.com accounts can view files.');
};
```

- [ ] **Step 2: Update `DownloadFiles.tsx`**
  - On mount, call `GET /api/auth/me`; if 200, set `userSignedIn = true` (persists session across reloads).
  - Replace `listFilesInS3` fetch target `'/api/list-s3-files'` with `'/api/list-files'` and map `data.files` (`{name, path, lastModified}`) — store `path` alongside `name`.
  - Replace `generatePresignedUrl(bucketName, file.name)` usages with `POST /api/file-link` `{ path: file.path }` for copy-link, and for direct download call `GET /api/resolve-link` after creating a link OR add a `POST /api/file-link` then open `shortUrl`. Simplest: copy-link and download both call `/api/file-link` and use the returned `shortUrl`.
  - Replace delete fetch with `DELETE /api/delete-file?path=${encodeURIComponent(file.path)}`.
  - Remove the `generatePresignedUrl` import and the `bucketName` constant.

- [ ] **Step 3: Delete now-unused `generatePresignedUrl.ts`**
```bash
git rm s3fileupload/src/app/lib/generatePresignedUrl.ts
```

- [ ] **Step 4: Manual end-to-end verification**
  1. Sign in with a `@thegrovery.com` Google account → file list loads.
  2. Try a non-Grovery Google account → rejected with the alert; list never loads.
  3. Copy a link → paste in a private window (logged out) → downloads (public share works).
  4. Delete a file → disappears from list and from the Supabase bucket.
  5. Reload page while signed in → stays signed in (via `/api/auth/me`).

- [ ] **Step 5: Commit**
```bash
git add s3fileupload/src/app/components/DownloadFiles.tsx s3fileupload/src/app/components/GoogleSignIn.tsx
git commit -m "feat: enforce Grovery session for download/manage; keep existing login UI"
```

---

## Phase 5 — Netlify deploy & cutover

### Task 5.1: Git repo + Netlify config

**Files:**
- Create: `s3fileupload/netlify.toml`
- Create/Modify: repo root `.gitignore` (ensure `node_modules`, `.next`, `.env*.local`, `.vercel`)

- [ ] **Step 1: Init git if needed** (base folder is not yet a repo)
```bash
cd /Users/sbjm4max/Sites/file-upload-tool
git init && git add -A && git commit -m "chore: initial commit of Grovery file upload tool (Supabase/Netlify rebuild)"
```

- [ ] **Step 2: Create `s3fileupload/netlify.toml`**
```toml
[build]
  command = "pnpm build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 3: Push to a new remote and connect Netlify**
  Create a GitHub repo, push, then in Netlify: "Add new site → Import from Git", set base directory to `s3fileupload`, and add ALL env vars from `.env.local` (except they are set in the Netlify UI, not committed). Mark server-only vars as non-public.

- [ ] **Step 4: Post-deploy verification**
  - Add the Netlify URL to Google OAuth **Authorized JavaScript origins** (Google Cloud Console → Credentials → the OAuth client) so the sign-in button works in prod.
  - Smoke test on the deployed URL: upload (with password), sign in, list, copy link, download from a logged-out browser.

- [ ] **Step 5: Commit**
```bash
git add s3fileupload/netlify.toml
git commit -m "chore: Netlify Next.js build config"
```

### Task 5.2: Docs + decommission

**Files:**
- Modify: `s3fileupload/README.md`
- Create: `CLAUDE.md` (repo root)

- [ ] **Step 1: Rewrite README** — replace AWS/S3 setup with Supabase + Netlify + Google verification; document env vars and the two auth gates.

- [ ] **Step 2: Create root `CLAUDE.md`** — project purpose, stack (Next.js/Supabase/Netlify), the three flows, env var shapes, and "old files remain in the dead AWS account" note.

- [ ] **Step 3: After confirming Netlify works, remove the Vercel project** (manual, in Vercel dashboard) and delete the `.vercel/` folder:
```bash
git rm -r s3fileupload/.vercel
git commit -m "chore: remove Vercel project config after Netlify cutover"
```

---

## Self-review notes

- **Spec coverage:** storage swap (Phase 2), private bucket + 5 GB limit (Task 0.1), short links via Postgres (Phase 3), password gate server-side (Task 2.1/2.3), Google domain gate server-side (Phase 4), SendGrid retained (Task 2.3), Netlify + git (Phase 5), secret de-leaking (Task 0.2), 2 GB support (Task 2.3 Step 5). All covered.
- **Deviation from spec (intentional):** manage-auth uses server-side **Google ID token verification + signed session cookie** instead of Supabase Auth. Rationale: preserves the existing one-tap login UI the user approved, reuses the existing Google OAuth client, and removes Supabase Auth provider setup. Supabase is storage + Postgres only.
- **Contingency:** if a real ~2 GB upload proves unreliable via `uploadToSignedUrl` (single-request), switch Task 2.2 to TUS resumable uploads against `/storage/v1/upload/resumable` using the anon key as bearer with a scoped bucket RLS policy. Left out of the main path to avoid complexity unless testing shows it's needed.
