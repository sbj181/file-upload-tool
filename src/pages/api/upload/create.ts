import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3, BUCKET, PART_SIZE, sanitizeName } from '@/app/lib/s3Storage';
import { passwordMatches } from '@/app/lib/uploadPassword';

// Start a multipart upload and hand the browser a presigned URL per part.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, fileName, fileSize, contentType } = req.body || {};
  if (!passwordMatches(password)) return res.status(401).json({ error: 'Invalid upload password' });
  if (typeof fileName !== 'string' || !fileName) return res.status(400).json({ error: 'fileName required' });
  if (typeof fileSize !== 'number' || fileSize <= 0) return res.status(400).json({ error: 'fileSize required' });

  const key = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}/${sanitizeName(fileName)}`;
  const s3 = getS3();

  try {
    const { UploadId } = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: typeof contentType === 'string' && contentType ? contentType : 'application/octet-stream',
      })
    );
    if (!UploadId) return res.status(500).json({ error: 'Could not start upload' });

    const partCount = Math.max(1, Math.ceil(fileSize / PART_SIZE));
    const urls: { partNumber: number; url: string }[] = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId, PartNumber: partNumber }),
        { expiresIn: 6 * 60 * 60 } // 6h — enough for a slow 2 GB upload
      );
      urls.push({ partNumber, url });
    }

    return res.status(200).json({ key, uploadId: UploadId, partSize: PART_SIZE, urls });
  } catch (e) {
    console.error('create multipart error', e);
    return res.status(500).json({ error: 'Could not start upload' });
  }
}
