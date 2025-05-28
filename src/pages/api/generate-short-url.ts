import type { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'aws-sdk';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  try {
    // Generate presigned URL
    const presignedUrl = s3.getSignedUrl('getObject', {
      Bucket: 'groveryuploads',
      Key: fileName,
      Expires: 60 * 60 * 24 * 7, // 7 days
    });

    // Generate a short ID (6 characters)
    const shortId = crypto.randomBytes(3).toString('hex');
    
    // Store in Vercel KV with 7-day expiration
    await kv.set(`url:${shortId}`, {
      presignedUrl,
      fileName,
      createdAt: Date.now()
    }, { ex: 60 * 60 * 24 * 7 }); // 7 days expiration

    // Robust origin fallback
    const origin =
      req.headers.origin ||
      (req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3000');
    const shortUrl = `${origin}/f/${shortId}`;

    res.status(200).json({ shortUrl });
  } catch (error) {
    console.error('Error generating short URL:', error);
    res.status(500).json({ error: 'Failed to generate short URL', details: (error as Error).message });
  }
} 