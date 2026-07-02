import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'grovery_session';

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET not configured');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.email === 'string') return { email: payload.email };
    return null;
  } catch {
    return null;
  }
}
