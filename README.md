# Grovery File Upload Tool

An internal file-transfer tool for The Grovery — for moving files too large to email,
in both directions (share files out to clients, or let clients upload large files in).

Built with **Next.js + Tailwind**, storage on **Supabase**, hosted on **Netlify**.
Live at **https://files.thegrovery.com**.

> Full architecture, env vars, and operational notes are in [`CLAUDE.md`](./CLAUDE.md).

## Features

- **Drag & drop upload** with real-time progress, live speed (MB/s) and ETA.
- **Direct-to-storage uploads** (browser → Supabase), no server size/timeout limit (up to 5 GB).
- **Password-gated uploads** — a shared password (comma-separated list supported) you can
  hand to clients so they can send you large files.
- **Employee-only file management** — Google sign-in restricted to `@thegrovery.com`,
  verified server-side.
- **Public share links** (`/f/{id}`) — send a client a link; they download without logging in.

## Prerequisites

- Node.js 22, **pnpm**
- A Supabase project (Storage bucket + a `short_links` table)
- A Google OAuth client (for the employee sign-in)
- A Resend account (optional, for upload notification emails)

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the values (see CLAUDE.md for the shape)
pnpm dev
```

## Scripts

```bash
pnpm dev     # local dev server
pnpm build   # production build
pnpm test    # vitest unit tests
```

## Deployment

Hosted on Netlify (site `groveryfiles`), auto-deploying from the `main` branch of
`github.com/sbj181/file-upload-tool`. Environment variables are set in the Netlify UI.

## License

MIT. 👨🏼‍💻 Originally by Scott Johnson.
