import { Prisma } from '@kamito/db';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { publicHomeEvents } from './public-home-events.query.js';

describe('publicHomeEvents', () => {
  it('filters past events per event timezone before applying the limit and preserves SQL order', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'next' }, { id: 'featured' }]);
    const findMany = vi.fn().mockResolvedValue([{ id: 'featured' }, { id: 'next' }]);
    const prisma = { $queryRaw: queryRaw, event: { findMany } } as unknown as PrismaService;

    const rows = await publicHomeEvents(prisma, new Date('2026-11-19T12:00:00.000Z'), 4, true);

    expect(rows.map(({ id }) => id)).toEqual(['next', 'featured']);
    const statement = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(statement.sql).toContain('"endDate" >=');
    expect(statement.sql).toContain('"isFeatured" = true');
    expect(statement.sql).toContain('make_interval');
    expect(statement.values).toContain(4);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['next', 'featured'] } }) }));
  });

  it('returns no rows without issuing an unrestricted ORM lookup', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findMany = vi.fn();
    const prisma = { $queryRaw: queryRaw, event: { findMany } } as unknown as PrismaService;

    await expect(publicHomeEvents(prisma, new Date(), 4)).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
