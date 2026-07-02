import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false } }
);

const BUCKET = 'grovery-uploads';

export async function uploadFile(
  file: File,
  password: string,
  onProgress: (pct: number) => void
): Promise<{ path: string }> {
  // 1. Get a signed upload URL from the server (password checked there).
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, fileName: file.name }),
  });
  if (!res.ok) {
    const msg = res.status === 401 ? 'Invalid upload password' : 'Could not start upload';
    throw new Error(msg);
  }
  const { path, token } = await res.json();

  // 2. Upload directly to Supabase Storage using the signed token.
  //    uploadToSignedUrl streams the whole file in one request; fine up to the
  //    5 GB bucket limit. Progress is coarse (start/end) since supabase-js does
  //    not expose per-chunk progress here.
  onProgress(1);
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) throw new Error('Upload failed');
  onProgress(100);
  return { path };
}
