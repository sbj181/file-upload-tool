import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import { isAllowedGroveryEmail } from '@/app/lib/auth';
import { createSessionToken, SESSION_COOKIE } from '@/app/lib/session';

const client = new OAuth2Client();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { credential } = req.body || {};
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const domain = process.env.ALLOWED_EMAIL_DOMAIN || 'thegrovery.com';
  if (typeof credential !== 'string' || !clientId) {
    return res.status(400).json({ error: 'Missing credential' });
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!isAllowedGroveryEmail(payload?.email, payload?.email_verified, domain)) {
      return res.status(401).json({ error: 'Not a Grovery account' });
    }
    const token = await createSessionToken(payload!.email!);
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${12 * 3600}; SameSite=Lax; Secure`);
    return res.status(200).json({ email: payload!.email });
  } catch {
    return res.status(401).json({ error: 'Invalid Google token' });
  }
}
