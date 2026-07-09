import type { NextApiRequest, NextApiResponse } from 'next';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/app/lib/s3Storage';
import { passwordMatches } from '@/app/lib/uploadPassword';

// Clean up a multipart upload the browser gave up on, so half-uploaded parts
// don't linger and accrue storage.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, key, uploadId } = req.body || {};
  if (!passwordMatches(password)) return res.status(401).json({ error: 'Invalid upload password' });
  if (typeof key !== 'string' || typeof uploadId !== 'string') {
    return res.status(400).json({ error: 'key and uploadId required' });
  }
  try {
    await getS3().send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('abort multipart error', e);
    return res.status(200).json({ ok: false });
  }
}
