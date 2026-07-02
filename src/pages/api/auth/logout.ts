import type { NextApiRequest, NextApiResponse } from 'next';
import { SESSION_COOKIE } from '@/app/lib/session';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`);
  return res.status(200).json({ ok: true });
}
