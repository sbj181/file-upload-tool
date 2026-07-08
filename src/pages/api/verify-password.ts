import type { NextApiRequest, NextApiResponse } from 'next';
import { passwordMatches } from '@/app/lib/uploadPassword';

// Lightweight password check for the upload gate — no side effects, so the
// login step doesn't burn real signed-upload calls on every attempt.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password } = req.body || {};
  if (!passwordMatches(password)) {
    return res.status(401).json({ error: 'Invalid upload password' });
  }
  return res.status(200).json({ ok: true });
}
