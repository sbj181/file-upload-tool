import type { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { fileName } = req.body || {};
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
      html: `<p>A new file <strong>${fileName}</strong> was uploaded to the Grovery file tool.</p>`,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify error', e);
    return res.status(200).json({ ok: false });
  }
}
