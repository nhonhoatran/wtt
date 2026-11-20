import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { ARTICLE_PUBLISHING_DELAYED, PublishingEnqueueService } from './publishing-enqueue.service.js';

const queue = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn(), on: vi.fn(), close: vi.fn() }));
vi.mock('bullmq', () => ({ Queue: class { constructor() { return queue; } } }));

describe('PublishingEnqueueService', () => {
  let service: PublishingEnqueueService;
  let warn: ReturnType<typeof vi.spyOn>;
  const nextMinute = () => new Date(Date.now() + 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    queue.add.mockResolvedValue({});
    queue.remove.mockResolvedValue(1);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new PublishingEnqueueService({ REDIS_URL: 'redis://unused', QUEUE_PREFIX: 'kamito-tt:test' } as ApiEnv);
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('adds an id-only delayed job for the committed schedule', async () => {
    const publishAt = nextMinute();
    await expect(service.scheduleArticle('article-id', publishAt)).resolves.toEqual([]);
    expect(queue.add).toHaveBeenCalledWith('publish-article', { articleId: 'article-id' }, expect.objectContaining({
      jobId: `art-article-id-${publishAt.getTime()}`, attempts: 5,
    }));
  });

  it('logs and returns a warning when scheduling fails', async () => {
    queue.add.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.scheduleArticle('article-id', nextMinute())).resolves.toEqual([ARTICLE_PUBLISHING_DELAYED]);
    expect(warn).toHaveBeenCalledWith({ msg: 'article publishing enqueue failed', operation: 'schedule', articleId: 'article-id', err: { type: 'Error' } });
  });

  it('bounds a hung enqueue so a saved article can return with a warning', async () => {
    vi.useFakeTimers();
    queue.add.mockReturnValue(new Promise(() => undefined));
    const pending = service.scheduleArticle('article-id', nextMinute());
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toEqual([ARTICLE_PUBLISHING_DELAYED]);
    expect(warn).toHaveBeenCalledWith({ msg: 'article publishing enqueue failed', operation: 'schedule', articleId: 'article-id', err: { type: 'Error' } });
  });

  it('logs and returns a warning when stale job cancellation fails', async () => {
    const publishAt = nextMinute();
    queue.remove.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.cancelArticleSchedule('article-id', publishAt)).resolves.toEqual([ARTICLE_PUBLISHING_DELAYED]);
    expect(queue.remove).toHaveBeenCalledWith(`art-article-id-${publishAt.getTime()}`);
    expect(warn).toHaveBeenCalledWith({ msg: 'article publishing enqueue failed', operation: 'cancel', articleId: 'article-id', err: { type: 'Error' } });
  });

  it('does not enqueue missing or expired schedules', async () => {
    await expect(service.scheduleArticle('article-id', null)).resolves.toEqual([]);
    await expect(service.scheduleArticle('article-id', new Date(0))).resolves.toEqual([]);
    await expect(service.cancelArticleSchedule('article-id', null)).resolves.toEqual([]);
    expect(queue.add).not.toHaveBeenCalled();
    expect(queue.remove).not.toHaveBeenCalled();
  });
});
