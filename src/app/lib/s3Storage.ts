import { S3Client } from '@aws-sdk/client-s3';

// Server-only S3 client for Supabase Storage's S3-compatible endpoint.
// Used for multipart uploads of large files (browser uploads each part to a
// presigned URL; the server creates/finalizes the multipart upload).
let cached: S3Client | null = null;

export function getS3(): S3Client {
  if (cached) return cached;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  if (!supabaseUrl || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage not configured');
  }
  cached = new S3Client({
    endpoint: `${supabaseUrl}/storage/v1/s3`,
    region: process.env.SUPABASE_S3_REGION || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return cached;
}

export const BUCKET = process.env.SUPABASE_BUCKET || 'grovery-uploads';

// 10 MB parts: S3 minimum is 5 MB; 10 MB keeps part counts low (2 GB = 200 parts)
// while staying small enough to retry cheaply on a flaky connection.
export const PART_SIZE = 10 * 1024 * 1024;

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
}
