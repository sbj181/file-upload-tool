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
