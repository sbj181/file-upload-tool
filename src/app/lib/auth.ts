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

// 6 bytes = 12 hex chars (~281 trillion) so short-link IDs aren't feasibly
// brute-forced to find valid, unexpired links.
export function makeShortId(bytes = 6): string {
  return crypto.randomBytes(bytes).toString('hex');
}
