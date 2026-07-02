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
