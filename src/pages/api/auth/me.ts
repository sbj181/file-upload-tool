import type { NextApiRequest, NextApiResponse } from 'next';
import { verifySessionToken, SESSION_COOKIE } from '@/app/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await verifySessionToken(req.cookies[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json({ email: session.email });
}
