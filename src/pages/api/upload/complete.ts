import type { NextApiRequest, NextApiResponse } from 'next';
import { ListPartsCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/app/lib/s3Storage';
import { passwordMatches } from '@/app/lib/uploadPassword';

// Finalize a multipart upload. The server fetches the part ETags itself via
// ListParts, so the browser never has to read cross-origin ETag headers.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, key, uploadId } = req.body || {};
  if (!passwordMatches(password)) return res.status(401).json({ error: 'Invalid upload password' });
  if (typeof key !== 'string' || typeof uploadId !== 'string') {
    return res.status(400).json({ error: 'key and uploadId required' });
  }

  const s3 = getS3();
  try {
    const parts: { PartNumber: number; ETag: string | undefined }[] = [];
    let partMarker: string | undefined;
    // Paginate in case of many parts (max 1000 per page).
    do {
      const page = await s3.send(
        new ListPartsCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumberMarker: partMarker })
      );
      for (const p of page.Parts || []) parts.push({ PartNumber: p.PartNumber!, ETag: p.ETag });
      partMarker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (partMarker);

    if (parts.length === 0) return res.status(400).json({ error: 'No parts uploaded' });
    parts.sort((a, b) => a.PartNumber - b.PartNumber);

    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
      })
    );
    return res.status(200).json({ ok: true, key });
  } catch (e) {
    console.error('complete multipart error', e);
    return res.status(500).json({ error: 'Could not finalize upload' });
  }
}
