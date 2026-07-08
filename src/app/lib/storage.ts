const BUCKET = 'grovery-uploads';

export interface UploadStats {
  percent: number;      // 0–100
  bytesPerSec: number;  // current transfer rate
  etaSeconds: number;   // estimated time remaining
}

/**
 * Upload a file directly to Supabase Storage via a server-issued signed URL.
 * The password is verified server-side in /api/upload-url; the browser never
 * sees storage credentials. Uses XHR so we get real upload progress + speed
 * (the supabase-js helper reports none), which matters for 500 MB–2 GB files.
 */
export async function uploadFile(
  file: File,
  password: string,
  onProgress: (stats: UploadStats) => void
): Promise<{ path: string }> {
  // 1. Server checks the password and issues a short-lived signed upload token.
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, fileName: file.name }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Invalid upload password' : 'Could not start upload');
  }
  const { path, token } = await res.json();

  // 2. Stream the file straight to Supabase Storage with live progress.
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}?token=${token}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'true');

    const startedAt = Date.now();
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = (Date.now() - startedAt) / 1000;
      const bytesPerSec = elapsed > 0 ? e.loaded / elapsed : 0;
      const etaSeconds = bytesPerSec > 0 ? (e.total - e.loaded) / bytesPerSec : 0;
      onProgress({
        percent: Math.round((e.loaded / e.total) * 100),
        bytesPerSec,
        etaSeconds,
      });
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(file);
  });

  return { path };
}

/** Format bytes/sec as a human string, e.g. "12.3 MB/s". */
export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return '—';
  const mb = bytesPerSec / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

/** Format seconds remaining as "2m 15s" / "45s". */
export function formatEta(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s left`;
}
