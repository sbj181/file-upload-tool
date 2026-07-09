const MAX_PART_ATTEMPTS = 6;

export interface UploadStats {
  percent: number;      // 0–100
  bytesPerSec: number;  // current transfer rate
  etaSeconds: number;   // estimated time remaining
  attempt?: number;     // retry attempt of the part currently in flight (1 = first try)
}

interface PartUrl {
  partNumber: number;
  url: string;
}

/** PUT one part to its presigned S3 URL, reporting bytes uploaded for this part. */
function putPart(url: string, body: Blob, onPartProgress: (loaded: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    // Do NOT set Content-Type: the presigned URL wasn't signed with one, and the
    // sliced Blob has an empty type, so the browser sends no Content-Type header.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPartProgress(e.loaded);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`part failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('network')); // dropped/corrupted connection
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body);
  });
}

/** PUT a part with retries — a corrupted/dropped connection re-sends just this part. */
async function putPartWithRetry(
  url: string,
  body: Blob,
  onPartProgress: (loaded: number, attempt: number) => void
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
    try {
      await putPart(url, body, (loaded) => onPartProgress(loaded, attempt));
      return;
    } catch (err) {
      lastErr = err;
      onPartProgress(0, attempt); // reset this part's progress before retrying
      if (attempt < MAX_PART_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 8000)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
}

/**
 * Upload a file to Supabase Storage via S3 multipart upload.
 *
 * The file is split into ~10 MB parts, each PUT directly to a presigned S3 URL.
 * A dropped/corrupted connection only re-sends the current part (up to 6 tries),
 * so large uploads survive flaky networks instead of restarting from zero.
 * Password is verified server-side in every /api/upload/* route (S3 credentials
 * never reach the browser); the server also creates and finalizes the upload.
 */
export async function uploadFile(
  file: File,
  password: string,
  onProgress: (stats: UploadStats) => void
): Promise<{ path: string }> {
  // 1. Server checks password, opens the multipart upload, returns presigned part URLs.
  const createRes = await fetch('/api/upload/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
    }),
  });
  if (!createRes.ok) {
    throw new Error(createRes.status === 401 ? 'Invalid upload password' : 'Could not start upload');
  }
  const { key, uploadId, partSize, urls } = (await createRes.json()) as {
    key: string;
    uploadId: string;
    partSize: number;
    urls: PartUrl[];
  };

  const total = file.size;
  const startedAt = Date.now();
  let completedBytes = 0; // bytes from fully-uploaded parts

  const report = (currentPartLoaded: number, attempt: number) => {
    const done = completedBytes + currentPartLoaded;
    const elapsed = (Date.now() - startedAt) / 1000;
    const bytesPerSec = elapsed > 0 ? done / elapsed : 0;
    const etaSeconds = bytesPerSec > 0 ? (total - done) / bytesPerSec : 0;
    onProgress({
      percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
      bytesPerSec,
      etaSeconds,
      attempt,
    });
  };

  try {
    // 2. Upload each part sequentially (with retry).
    for (const { partNumber, url } of urls) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, total);
      const chunk = file.slice(start, end); // Blob with empty type — no Content-Type sent
      await putPartWithRetry(url, chunk, (loaded, attempt) => report(loaded, attempt));
      completedBytes = end;
    }

    // 3. Server finalizes (fetches part ETags itself, then CompleteMultipartUpload).
    const completeRes = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, key, uploadId }),
    });
    if (!completeRes.ok) throw new Error('Could not finalize upload');

    return { path: key };
  } catch (err) {
    // Best-effort cleanup so abandoned parts don't linger.
    fetch('/api/upload/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, key, uploadId }),
    }).catch(() => {});
    throw err;
  }
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
