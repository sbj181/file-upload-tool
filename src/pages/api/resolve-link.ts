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
