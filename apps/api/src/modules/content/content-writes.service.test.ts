import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@kamito/db';
import type { AuditService } from '../../common/audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { PUBLIC_REFRESH_DELAYED } from '../revalidation/revalidation-enqueue.service.js';
import { articleBody, sponsorBody, staticPageBody, videoBody } from './admin-content-dtos.js';
import { ContentWritesService } from './content-writes.service.js';
import { ARTICLE_PUBLISHING_DELAYED, type PublishingEnqueueService } from './publishing-enqueue.service.js';

function kit(row: Record<string, unknown> = { id: 'content-id', status: 'DRAFT' }) {
  const events: string[] = [];
  const delegate = () => ({
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    create: vi.fn().mockResolvedValue(row), update: vi.fn().mockResolvedValue(row), delete: vi.fn().mockResolvedValue(row),
  });
  const tx = { article: delegate(), video: delegate(), sponsor: delegate(), staticPage: delegate(), contactMessage: delegate(), $queryRaw: vi.fn().mockResolvedValue([]) };
  const prisma = { $transaction: vi.fn(async (run: (value: Prisma.TransactionClient) => Promise<unknown>) => {
    events.push('begin');
    try { const result = await run(tx as unknown as Prisma.TransactionClient); events.push('commit'); return result; }
    catch (error) { events.push('rollback'); throw error; }
  }) };
  const audit = { record: vi.fn().mockImplementation(async () => { events.push('audit'); }) };
  const revalidation = { enqueue: vi.fn().mockImplementation(async () => { events.push('refresh'); return []; }) };
  const publishing = {
    scheduleArticle: vi.fn().mockImplementation(async () => { events.push('schedule'); return []; }),
    cancelArticleSchedule: vi.fn().mockImplementation(async () => { events.push('cancel'); return []; }),
  };
  const service = new ContentWritesService(
    prisma as unknown as PrismaService, audit as unknown as AuditService,
    revalidation as unknown as RevalidationEnqueueService, publishing as unknown as PublishingEnqueueService,
  );
  return { service, tx, prisma, audit, revalidation, publishing, events };
}

const articleInput = () => articleBody.parse({ slug: 'news', title: 'News', body: '<script>evil()</script><p>Safe draft</p>' });

describe('ContentWritesService', () => {
  it('commits sanitized article and audit together, then returns queue/cache warnings', async () => {
    const publishAt = new Date(Date.now() + 60_000);
    const k = kit({ id: 'content-id', status: 'SCHEDULED', publishAt, slug: 'news', body: 'Private draft', authorName: 'Private author', events: [] });
    k.publishing.scheduleArticle.mockImplementation(async () => { k.events.push('schedule'); return [ARTICLE_PUBLISHING_DELAYED]; });
    k.revalidation.enqueue.mockImplementation(async () => { k.events.push('refresh'); return [PUBLIC_REFRESH_DELAYED]; });
    const result = await k.service.createArticle({ ...articleInput(), status: 'SCHEDULED', publishAt: publishAt.toISOString() });
    expect(k.tx.article.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ body: '<p>Safe draft</p>' }) }));
    expect(k.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'article.create', entity: 'Article', entityId: 'content-id',
      after: { id: 'content-id', status: 'SCHEDULED', slug: 'news', publishAt: publishAt.toISOString(), eventIds: [] },
    }), k.tx);
    expect(k.events).toEqual(['begin', 'audit', 'commit', 'schedule', 'refresh']);
    expect(result.warnings).toEqual([ARTICLE_PUBLISHING_DELAYED, PUBLIC_REFRESH_DELAYED]);
  });

  it('rolls back instead of scheduling or refreshing when the atomic audit write fails', async () => {
    const k = kit();
    k.audit.record.mockRejectedValue(new Error('audit unavailable'));
    await expect(k.service.createArticle(articleInput())).rejects.toThrow('audit unavailable');
    expect(k.events).toEqual(['begin', 'rollback']);
    expect(k.publishing.scheduleArticle).not.toHaveBeenCalled();
    expect(k.revalidation.enqueue).not.toHaveBeenCalled();
  });

  it('audits before/after metadata and preserves the original publication date on article edits', async () => {
    const publishedAt = new Date('2026-11-18T00:00:00Z');
    const k = kit({ id: 'content-id', status: 'PUBLISHED', publishedAt, publishAt: null, events: [] });
    await k.service.updateArticle('content-id', { ...articleInput(), status: 'PUBLISHED' });
    expect(k.tx.article.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publishedAt }) }));
    expect(k.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'article.update', before: expect.objectContaining({ publishedAt: publishedAt.toISOString() }),
      after: expect.objectContaining({ publishedAt: publishedAt.toISOString() }),
    }), k.tx);
    expect(k.tx.$queryRaw).toHaveBeenCalledOnce();
  });

  it('attempts the new schedule even when stale-job cancellation returns a warning', async () => {
    const oldDate = new Date(Date.now() + 60_000);
    const newDate = new Date(Date.now() + 120_000);
    const k = kit({ id: 'content-id', status: 'SCHEDULED', publishAt: oldDate, publishedAt: null, events: [] });
    k.tx.article.update.mockResolvedValue({ id: 'content-id', status: 'SCHEDULED', publishAt: newDate, events: [] });
    k.publishing.cancelArticleSchedule.mockResolvedValue([ARTICLE_PUBLISHING_DELAYED]);
    k.publishing.scheduleArticle.mockResolvedValue([ARTICLE_PUBLISHING_DELAYED]);
    const result = await k.service.updateArticle('content-id', { ...articleInput(), status: 'SCHEDULED', publishAt: newDate.toISOString() });
    expect(k.publishing.cancelArticleSchedule).toHaveBeenCalledWith('content-id', oldDate);
    expect(k.publishing.scheduleArticle).toHaveBeenCalledWith('content-id', newDate);
    expect(result.warnings).toEqual([ARTICLE_PUBLISHING_DELAYED]);
  });

  it('keeps a deleted scheduled article successful when cancellation needs a retry', async () => {
    const publishAt = new Date(Date.now() + 60_000);
    const k = kit({ id: 'content-id', status: 'SCHEDULED', publishAt });
    k.publishing.cancelArticleSchedule.mockResolvedValue([ARTICLE_PUBLISHING_DELAYED]);
    await expect(k.service.deleteArticle('content-id')).resolves.toEqual({ data: { id: 'content-id' }, warnings: [ARTICLE_PUBLISHING_DELAYED] });
    expect(k.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'article.delete', before: { id: 'content-id', status: 'SCHEDULED', publishAt: publishAt.toISOString() }, after: undefined }), k.tx);
  });

  it('records contact state changes without loading or auditing inbox PII', async () => {
    const k = kit({ id: 'content-id', status: 'NEW', name: 'Sender', email: 'sender@example.test', message: 'private' });
    k.tx.contactMessage.update.mockResolvedValue({ id: 'content-id', status: 'READ' });
    await expect(k.service.updateContact('content-id', { status: 'READ' })).resolves.toEqual({ data: { id: 'content-id', status: 'READ' } });
    expect(k.tx.contactMessage.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'content-id' }, select: { id: true, status: true } });
    expect(k.audit.record).toHaveBeenCalledWith({ action: 'contactMessage.update', entity: 'ContactMessage', entityId: 'content-id', before: { id: 'content-id', status: 'NEW' }, after: { id: 'content-id', status: 'READ' } }, k.tx);
    expect(k.revalidation.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ['video.create', (k: ReturnType<typeof kit>) => k.service.saveVideo(videoBody.parse({ slug: 'clip', title: 'Clip', url: 'https://www.youtube.com/watch?v=Abcdef_1234' }))],
    ['video.update', (k: ReturnType<typeof kit>) => k.service.saveVideo(videoBody.parse({ slug: 'clip', title: 'Clip', url: 'https://www.youtube.com/watch?v=Abcdef_1234' }), 'content-id')],
    ['video.delete', (k: ReturnType<typeof kit>) => k.service.deleteVideo('content-id')],
    ['sponsor.create', (k: ReturnType<typeof kit>) => k.service.createSponsor(sponsorBody.parse({ name: 'Sponsor' }))],
    ['sponsor.update', (k: ReturnType<typeof kit>) => k.service.updateSponsor('content-id', { order: 3 })],
    ['sponsor.delete', (k: ReturnType<typeof kit>) => k.service.deleteSponsor('content-id')],
    ['staticPage.create', (k: ReturnType<typeof kit>) => k.service.savePage(staticPageBody.parse({ slug: 'about', title: 'About', body: '<p>Body</p>' }))],
    ['staticPage.update', (k: ReturnType<typeof kit>) => k.service.savePage(staticPageBody.parse({ slug: 'about', title: 'About', body: '<p>Body</p>' }), 'content-id')],
    ['staticPage.delete', (k: ReturnType<typeof kit>) => k.service.deletePage('content-id')],
  ] as const)('audits %s in the mutation transaction and returns public cache warnings', async (action, run) => {
    const k = kit();
    k.revalidation.enqueue.mockResolvedValue([PUBLIC_REFRESH_DELAYED]);
    expect(await run(k)).toEqual(expect.objectContaining({ warnings: [PUBLIC_REFRESH_DELAYED] }));
    expect(k.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action, entityId: 'content-id' }), k.tx);
    expect(k.events).toEqual(['begin', 'audit', 'commit']);
  });
});
