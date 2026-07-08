import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getServiceClient, BUCKET } from '@/app/lib/supabaseServer';
import { passwordMatches } from '@/app/lib/uploadPassword';

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, fileName } = req.body || {};
  if (!passwordMatches(password)) {
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
