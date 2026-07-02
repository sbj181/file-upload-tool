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
