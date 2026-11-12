import { Prisma } from '@kamito/db';
import { describe, expect, it } from 'vitest';
import { mapSeedConflict } from './entry-errors.js';

const unique = (index: string) =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { driverAdapterError: { cause: { constraint: { index } } } },
  });

describe('mapSeedConflict', () => {
  it('maps the seed index to SEED_TAKEN', () => {
    const mapped = mapSeedConflict(unique('Entry_subEventId_stage_seed_key'), 3) as { getResponse(): { code: string; message: string } };
    expect(mapped.getResponse()).toMatchObject({ code: 'SEED_TAKEN', message: 'Hạt giống 3 đã có trong vòng này' });
  });

  it('maps the competitor index to ALREADY_ENTERED', () => {
    const mapped = mapSeedConflict(unique('Entry_subEventId_competitorId_key'), null) as { getResponse(): { code: string } };
    expect(mapped.getResponse().code).toBe('ALREADY_ENTERED');
  });

  it('rethrows any other unique violation and non-Prisma errors untouched', () => {
    const other = unique('Competitor_playerId_key');
    expect(mapSeedConflict(other, 1)).toBe(other);
    const plain = new Error('boom');
    expect(mapSeedConflict(plain, 1)).toBe(plain);
  });
});
