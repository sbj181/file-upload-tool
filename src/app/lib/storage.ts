const BUCKET = 'grovery-uploads';
const MAX_ATTEMPTS = 3;

export interface UploadStats {
  percent: number;      // 0–100
  bytesPerSec: number;  // current transfer rate
  etaSeconds: number;   // estimated time remaining
  attempt?: number;     // which retry attempt is in flight (1 = first try)
}

/** Ask the server (password-gated) for a fresh signed upload URL. */
async function getSignedUpload(file: File, password: string): Promise<{ path: string; token: string }> {
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, fileName: file.name }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Invalid upload password' : 'Could not start upload');
  }
  return res.json();
}

/** One PUT attempt straight to Supabase Storage, with live progress. */
function putToStorage(
  file: File,
  path: string,
  token: string,
  attempt: number,
  onProgress: (stats: UploadStats) => void
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}?token=${token}`;
  return new Promise<void>((resolve, reject) => {
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
      onProgress({ percent: Math.round((e.loaded / e.total) * 100), bytesPerSec, etaSeconds, attempt });
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('network')); // e.g. dropped/corrupted TLS connection
    xhr.ontimeout = () => reject(new Error('network'));
    xhr.send(file);
  });
}

/**
 * Upload a file directly to Supabase Storage via a server-issued signed URL.
 * Password is verified server-side in /api/upload-url; the browser never sees
 * storage credentials. Uses XHR for real progress/speed/ETA (matters for
 * 500 MB–2 GB files) and auto-retries transient network failures — a dropped
 * TLS connection mid-transfer (ERR_SSL_BAD_RECORD_MAC_ALERT etc.) would
 * otherwise kill the whole upload.
 */
export async function uploadFile(
  file: File,
  password: string,
  onProgress: (stats: UploadStats) => void
): Promise<{ path: string }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Fresh signed URL per attempt (tokens are single-use / may expire).
      const { path, token } = await getSignedUpload(file, password);
      await putToStorage(file, path, token, attempt, onProgress);
      return { path };
    } catch (err) {
      lastErr = err;
      // Never retry a bad password — that won't fix itself.
      if (err instanceof Error && err.message === 'Invalid upload password') throw err;
      if (attempt < MAX_ATTEMPTS) {
        // brief backoff, then retry from the start
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
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
