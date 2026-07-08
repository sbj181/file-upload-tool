import type { NextApiRequest } from 'next';
import { verifySessionToken, SESSION_COOKIE } from './session';

export async function requireSession(req: NextApiRequest) {
  return verifySessionToken(req.cookies[SESSION_COOKIE]);
}
