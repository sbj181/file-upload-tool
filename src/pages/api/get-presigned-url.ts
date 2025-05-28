import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid URL ID' });
  }

  try {
    const urlData = await kv.get(`url:${id}`) as { presignedUrl?: string } | null;

    if (!urlData || !urlData.presignedUrl) {
      return res.status(404).json({ error: 'URL not found' });
    }

    res.status(200).json({ presignedUrl: urlData.presignedUrl });
  } catch (error) {
    console.error('Error retrieving presigned URL:', error);
    res.status(500).json({ error: 'Failed to retrieve URL' });
  }
}