import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

beforeAll(() => { process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-1234'; });

describe('session tokens', () => {
  it('round-trips a valid token', async () => {
    const t = await createSessionToken('scottj@thegrovery.com');
    expect(await verifySessionToken(t)).toEqual({ email: 'scottj@thegrovery.com' });
  });
  it('rejects garbage', async () => {
    expect(await verifySessionToken('not-a-token')).toBeNull();
  });
  it('rejects undefined', async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});
