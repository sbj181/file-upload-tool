import crypto from 'crypto';

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * UPLOAD_PASSWORD may be a comma-separated list; any exact match passes.
 * Each candidate is compared in constant time; empty entries are ignored.
 * Server-only — never import into client code.
 */
export function passwordMatches(input: unknown): boolean {
  if (typeof input !== 'string') return false;
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
