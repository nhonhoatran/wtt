import { describe, expect, it, vi } from 'vitest';
import { publishArticle, sweepScheduledArticles } from './publishing-processors.js';

describe('publishing processors', () => {
  it('publishes a due scheduled article and refreshes its public tags', async () => {
    const articleUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const revalidateAdd = vi.fn().mockResolvedValue({});
    const prisma = {
      article: {
        findUnique: vi.fn().mockResolvedValue({ id: 'article-1', slug: 'final', status: 'SCHEDULED', publishAt: new Date(Date.now() - 1000) }),
        updateMany: articleUpdate,
      },
    };
    const revalidate = { add: revalidateAdd };

    await expect(publishArticle(prisma as never, revalidate as never, 'article-1')).resolves.toEqual({ published: true });
    expect(articleUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'article-1', status: 'SCHEDULED' }), data: expect.objectContaining({ status: 'PUBLISHED' }) }));
    expect(revalidateAdd).toHaveBeenCalled();
  });

  it('does not publish a rescheduled or non-scheduled article', async () => {
    const articleUpdate = vi.fn();
    const revalidateAdd = vi.fn();
    const prisma = { article: { findUnique: vi.fn().mockResolvedValue({ id: 'article-1', slug: 'final', status: 'SCHEDULED', publishAt: new Date(Date.now() + 60_000) }), updateMany: articleUpdate } };
    const revalidate = { add: revalidateAdd };
    await expect(publishArticle(prisma as never, revalidate as never, 'article-1')).resolves.toEqual({ published: false });
    expect(articleUpdate).not.toHaveBeenCalled();
    expect(revalidateAdd).not.toHaveBeenCalled();
  });

  it('does not publish when the schedule changes after the job reads it', async () => {
    const dueAt = new Date(Date.now() - 1000);
    const articleUpdate = vi.fn().mockResolvedValue({ count: 0 });
    const revalidateAdd = vi.fn();
    const prisma = { article: { findUnique: vi.fn().mockResolvedValue({ id: 'article-1', slug: 'final', status: 'SCHEDULED', publishAt: dueAt }), updateMany: articleUpdate } };
    const revalidate = { add: revalidateAdd };

    await expect(publishArticle(prisma as never, revalidate as never, 'article-1')).resolves.toEqual({ published: false });
    expect(articleUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'article-1', status: 'SCHEDULED', publishAt: { equals: dueAt, lte: expect.any(Date) } }) }));
    expect(revalidateAdd).not.toHaveBeenCalled();
  });

  it('retries the cache refresh after the article was already published', async () => {
    const articleUpdate = vi.fn();
    const revalidateAdd = vi.fn().mockResolvedValue({});
    const dueAt = new Date(Date.now() - 1000);
    const prisma = { article: { findUnique: vi.fn().mockResolvedValue({ id: 'article-1', slug: 'final', status: 'PUBLISHED', publishAt: dueAt }), updateMany: articleUpdate } };
    const revalidate = { add: revalidateAdd };

    await expect(publishArticle(prisma as never, revalidate as never, 'article-1')).resolves.toEqual({ published: false });
    expect(articleUpdate).not.toHaveBeenCalled();
    expect(revalidateAdd).toHaveBeenCalled();
  });

  it('bulk publishes overdue scheduled rows found by the safety sweep', async () => {
    const updateManyAndReturn = vi.fn().mockResolvedValue([{ slug: 'one' }]);
    const revalidateAdd = vi.fn().mockResolvedValue({});
    const prisma = { article: { updateManyAndReturn } };
    const revalidate = { add: revalidateAdd };
    await expect(sweepScheduledArticles(prisma as never, revalidate as never)).resolves.toEqual({ published: 1 });
    expect(updateManyAndReturn).toHaveBeenCalled();
    expect(revalidateAdd).toHaveBeenCalled();
  });
});
