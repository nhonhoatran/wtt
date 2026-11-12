import { Prisma } from '@kamito/db';
import { describe, expect, it } from 'vitest';
import { isDefaultIndexViolation } from './delete-guard.js';

const p2002 = (message: string, meta: Record<string, unknown> = {}) =>
  new Prisma.PrismaClientKnownRequestError(message, { code: 'P2002', clientVersion: 'test', meta });

describe('isDefaultIndexViolation', () => {
  it('recognises the single-default partial index', () => {
    expect(isDefaultIndexViolation(p2002('Unique constraint failed on the fields: (`isDefault`)'))).toBe(true);
    expect(isDefaultIndexViolation(p2002('x', { driverAdapterError: { cause: { constraint: { index: 'MatchFormat_single_default' } } } }))).toBe(true);
  });

  it('leaves other unique violations and other errors alone', () => {
    expect(isDefaultIndexViolation(p2002('Unique constraint failed on the fields: (`code`)', { target: ['code'] }))).toBe(false);
    expect(isDefaultIndexViolation(new Error('isDefault'))).toBe(false);
  });
});
