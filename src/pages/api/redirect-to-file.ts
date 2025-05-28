import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).send('Invalid URL ID');
  }
  const urlData = await kv.get(`url:${id}`) as { presignedUrl?: string } | null;
  if (!urlData || !urlData.presignedUrl) {
    return res.status(404).send('URL not found');
  }
  res.writeHead(302, { Location: urlData.presignedUrl });
  res.end();
}
