import crypto from 'crypto';

export function isAllowedGroveryEmail(
  email: string | undefined,
  verified: boolean | undefined,
  domain: string
): boolean {
  if (!email || verified !== true) return false;
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const emailDomain = email.slice(at + 1).toLowerCase();
  return emailDomain === domain.toLowerCase();
}

export function makeShortId(bytes = 4): string {
  return crypto.randomBytes(bytes).toString('hex');
}
