import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { resolveHeroEventSlug } from './public-home-hero.js';

const prismaFinding = (row: { slug: string } | null) => {
  const findFirst = vi.fn().mockResolvedValue(row);
  return { prisma: { event: { findFirst } } as unknown as PrismaService, findFirst };
};

describe('resolveHeroEventSlug', () => {
  it('prefers the pinned event and only looks it up inside the public scope', async () => {
    const { prisma, findFirst } = prismaFinding({ slug: 'pinned' });
    await expect(resolveHeroEventSlug(prisma, 'id-1', [{ slug: 'featured' }], [{ slug: 'next' }])).resolves.toBe('pinned');
    expect(findFirst).toHaveBeenCalledWith({ where: { publishStatus: 'PUBLISHED', isCancelled: false, id: 'id-1' }, select: { slug: true } });
  });

  it('falls back when the pinned event is a draft, cancelled or deleted', async () => {
    const { prisma } = prismaFinding(null);
    await expect(resolveHeroEventSlug(prisma, 'id-1', [{ slug: 'featured' }], [{ slug: 'next' }])).resolves.toBe('featured');
  });

  it('falls back from the featured event to the first current event, then to null', async () => {
    const { prisma, findFirst } = prismaFinding(null);
    await expect(resolveHeroEventSlug(prisma, null, [], [{ slug: 'next' }])).resolves.toBe('next');
    await expect(resolveHeroEventSlug(prisma, null, [], [])).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
