import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueueName, PUBLISH_ARTICLE_JOB } from '@kamito/shared';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CmsTestKit } from './support/cms-test-kit.js';

interface PublishingProcessors {
  publishArticle(prisma: unknown, queue: Queue, articleId: string): Promise<{ published: boolean }>;
}

describe('CMS article publishing (real Postgres + Redis)', () => {
  let cms: CmsTestKit;
  let revalidate: Queue;
  let processors: PublishingProcessors;
  beforeAll(async () => {
    cms = await CmsTestKit.start();
    revalidate = new Queue(QueueName.Revalidate, { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });
    const file = path.resolve(import.meta.dirname, '../../worker/src/processors/publishing-processors.ts');
    processors = await import(/* @vite-ignore */ pathToFileURL(file).href) as PublishingProcessors;
  }, 90_000);
  afterAll(async () => { await revalidate?.close(); if (cms) await cms.close(); }, 60_000);

  it('queues id-only delayed work, replaces the schedule, and removes cancelled work', async () => {
    const publishAt = new Date(Date.now() + 600_000).toISOString();
    const payload = { slug: `scheduled-${cms.tag}`, title: 'Scheduled article', body: '<p>Scheduled body</p>', status: 'SCHEDULED', publishAt };
    const article = await cms.create('articles', payload);
    const firstJobId = `art-${article.id}-${new Date(publishAt).getTime()}`;
    cms.jobs.add(firstJobId);
    const first = await cms.publishing.getJob(firstJobId);
    expect(first?.name).toBe(PUBLISH_ARTICLE_JOB);
    expect(first?.data).toEqual({ articleId: article.id });
    expect(await first?.getState()).toBe('delayed');
    expect((await cms.publicGet(`articles/${payload.slug}`).expect(200)).body.data).toBeNull();

    const later = new Date(Date.now() + 1_200_000).toISOString();
    await cms.write('patch', `articles/${article.id}`, { ...payload, publishAt: later }).expect(200);
    const nextJobId = `art-${article.id}-${new Date(later).getTime()}`;
    cms.jobs.add(nextJobId);
    expect(await cms.publishing.getJob(firstJobId)).toBeUndefined();
    expect(await (await cms.publishing.getJob(nextJobId))?.getState()).toBe('delayed');

    await cms.write('patch', `articles/${article.id}`, { ...payload, status: 'DRAFT', publishAt: null }).expect(200);
    expect(await cms.publishing.getJob(nextJobId)).toBeUndefined();
    expect((await cms.get(`articles/${article.id}`).expect(200)).body.data).toMatchObject({ status: 'DRAFT', publishAt: null });
  });

  it('publishes a due article through the real processor and keeps future reschedules hidden', async () => {
    const article = await cms.create('articles', { slug: `processor-${cms.tag}`, title: 'Processor article', body: '<p>Visible after publishing</p>' });
    await cms.kit.prisma.article.update({ where: { id: article.id }, data: { status: 'SCHEDULED', publishAt: new Date(Date.now() - 1000) } });
    expect(await processors.publishArticle(cms.kit.prisma, revalidate, article.id)).toEqual({ published: true });
    const published = await cms.kit.prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
    expect((await cms.publicGet(`articles/${article.slug}`).expect(200)).body.data.slug).toBe(article.slug);
    await cms.kit.prisma.article.update({ where: { id: article.id }, data: { status: 'SCHEDULED', publishAt: new Date(Date.now() + 600_000), publishedAt: null } });
    expect(await processors.publishArticle(cms.kit.prisma, revalidate, article.id)).toEqual({ published: false });
    expect((await cms.publicGet(`articles/${article.slug}`).expect(200)).body.data).toBeNull();
  });
});
