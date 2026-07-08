import { describe, it, expect } from 'vitest';
import { isAllowedGroveryEmail, makeShortId } from './auth';

describe('isAllowedGroveryEmail', () => {
  it('accepts verified @thegrovery.com', () => {
    expect(isAllowedGroveryEmail('scottj@thegrovery.com', true, 'thegrovery.com')).toBe(true);
  });
  it('is case-insensitive on domain', () => {
    expect(isAllowedGroveryEmail('Scott@TheGrovery.com', true, 'thegrovery.com')).toBe(true);
  });
  it('rejects unverified email', () => {
    expect(isAllowedGroveryEmail('scottj@thegrovery.com', false, 'thegrovery.com')).toBe(false);
  });
  it('rejects other domains', () => {
    expect(isAllowedGroveryEmail('scott@gmail.com', true, 'thegrovery.com')).toBe(false);
  });
  it('rejects lookalike domains', () => {
    expect(isAllowedGroveryEmail('a@thegrovery.com.evil.com', true, 'thegrovery.com')).toBe(false);
  });
  it('rejects undefined', () => {
    expect(isAllowedGroveryEmail(undefined, true, 'thegrovery.com')).toBe(false);
  });
});

describe('makeShortId', () => {
  it('makes a 12-char hex id by default', () => {
    expect(makeShortId()).toMatch(/^[0-9a-f]{12}$/);
  });
  it('is unique across calls', () => {
    expect(makeShortId()).not.toBe(makeShortId());
  });
});
