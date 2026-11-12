import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseEnv, requiredString, secretString } from './env-validation.js';

const schema = z.object({ QUEUE_PREFIX: requiredString, AUTH_SECRET: secretString });

describe('parseEnv', () => {
  it('returns parsed values when valid', () => {
    const secret = 'x'.repeat(32);
    expect(parseEnv(schema, { QUEUE_PREFIX: 'kamito-tt:dev', AUTH_SECRET: secret })).toEqual({
      QUEUE_PREFIX: 'kamito-tt:dev',
      AUTH_SECRET: secret,
    });
  });

  it('names missing variables, treating empty strings as missing', () => {
    expect(() => parseEnv(schema, { QUEUE_PREFIX: '', AUTH_SECRET: 'x'.repeat(32) })).toThrow(/QUEUE_PREFIX: missing/);
  });

  it('rejects the .env.example placeholder secrets', () => {
    expect(() =>
      parseEnv(schema, { QUEUE_PREFIX: 'p', AUTH_SECRET: 'replace-with-32-plus-random-bytes-auth' }),
    ).toThrow(/AUTH_SECRET: still the .env.example placeholder/);
  });

  it('never echoes the offending value', () => {
    const leaked = 'short-secret-value';
    try {
      parseEnv(schema, { QUEUE_PREFIX: 'p', AUTH_SECRET: leaked });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain('AUTH_SECRET');
      expect(String(error)).not.toContain(leaked);
    }
  });
});
