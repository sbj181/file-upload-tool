import type { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';
import { passwordMatches } from '@/app/lib/uploadPassword';

// Escape user-supplied text before putting it in email HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { fileName, password } = req.body || {};
  // Same gate as the upload itself — prevents anyone from spamming/injecting
  // the internal notification inbox with arbitrary content.
  if (!passwordMatches(password)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const safeName = escapeHtml(typeof fileName === 'string' ? fileName : '').slice(0, 300) || 'a file';

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.FROM_EMAIL;
  // Email is best-effort: if not configured, skip without failing the upload.
  if (!apiKey || !to || !from) return res.status(200).json({ ok: false, skipped: true });
  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from, to,
      subject: 'New file uploaded',
      html: `<p>A new file <strong>${safeName}</strong> was uploaded to the Grovery file tool.</p>`,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify error', e);
    return res.status(200).json({ ok: false });
  }
}
