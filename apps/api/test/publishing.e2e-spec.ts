import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueueName, PUBLISH_ARTICLE_JOB, REVALIDATE_TAGS_JOB, contentSettings } from '@kamito/shared';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CmsTestKit } from './support/cms-test-kit.js';
import { assertPublishingTestTarget, withRetentionSetting } from './support/publishing-test-safety.js';

interface PublishingProcessors {
  publishArticle(prisma: unknown, queue: Queue, articleId: string): Promise<{ published: boolean }>;
  sweepScheduledArticles(prisma: unknown, queue: Queue): Promise<{ published: number }>;
  cleanupContactMessages(prisma: unknown): Promise<{ count: number }>;
}

describe('CMS article publishing (real Postgres + Redis)', () => {
  let cms: CmsTestKit;
  let revalidate: Queue;
  let processors: PublishingProcessors;
  beforeAll(async () => {
    assertPublishingTestTarget(process.env);
    cms = await CmsTestKit.start();
    revalidate = new Queue(QueueName.Revalidate, { connection: { url: process.env.REDIS_URL }, prefix: `${process.env.QUEUE_PREFIX}:cms-${cms.tag}` });
    const file = path.resolve(import.meta.dirname, '../../worker/src/processors/publishing-processors.ts');
    processors = await import(/* @vite-ignore */ pathToFileURL(file).href) as PublishingProcessors;
  }, 90_000);
  afterAll(async () => {
    try {
      // This queue has a fixture-unique prefix and no consumer; remove only this probe's jobs.
      if (revalidate) { await revalidate.drain(true); await revalidate.close(); }
    } finally { if (cms) await cms.close(); }
  }, 60_000);

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

  it('recovers a missing delayed job through the safety sweep without publishing future articles or drafts', async () => {
    const publishAt = new Date(Date.now() + 600_000).toISOString();
    const article = await cms.create('articles', { slug: `sweep-${cms.tag}`, title: 'Sweep recovery', body: '<p>Recovered</p>', status: 'SCHEDULED', publishAt });
    const jobId = `art-${article.id}-${new Date(publishAt).getTime()}`;
    cms.jobs.add(jobId);
    expect(await cms.publishing.getJob(jobId)).toBeDefined();
    await cms.publishing.remove(jobId);
    expect(await cms.publishing.getJob(jobId)).toBeUndefined();
    const draft = await cms.create('articles', { slug: `sweep-draft-${cms.tag}`, title: 'Keep draft', body: '<p>Draft</p>' });
    const future = await cms.create('articles', { slug: `sweep-future-${cms.tag}`, title: 'Keep future', body: '<p>Future</p>', status: 'SCHEDULED', publishAt });
    cms.jobs.add(`art-${future.id}-${new Date(publishAt).getTime()}`);
    await cms.kit.prisma.article.update({ where: { id: article.id }, data: { publishAt: new Date(Date.now() - 1000) } });
    // Lock writers while checking the sweep's global predicate, so foreign rows cannot enter it.
    const result = await cms.kit.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE "Article" IN SHARE ROW EXCLUSIVE MODE`;
      const foreign = await tx.article.count({ where: { status: 'SCHEDULED', id: { notIn: cms.ids.articles } } });
      expect(foreign, 'Refusing a global sweep while another fixture owns scheduled articles').toBe(0);
      return processors.sweepScheduledArticles(tx, revalidate);
    });
    expect(result).toEqual({ published: 1 });
    expect((await cms.publicGet(`articles/${article.slug}`).expect(200)).body.data.slug).toBe(article.slug);
    expect((await cms.kit.prisma.article.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('DRAFT');
    expect((await cms.kit.prisma.article.findUniqueOrThrow({ where: { id: future.id } })).status).toBe('SCHEDULED');
    const jobs = await revalidate.getJobs(['waiting']);
    expect(jobs.some((job) => job.name === REVALIDATE_TAGS_JOB && job.data.tags.includes(`article-${article.slug}`))).toBe(true);
  });

  it('retries a completed publication idempotently and enqueues a fresh cache refresh', async () => {
    const article = await cms.create('articles', { slug: `retry-${cms.tag}`, title: 'Retry publication', body: '<p>Retry</p>' });
    await cms.kit.prisma.article.update({ where: { id: article.id }, data: { status: 'SCHEDULED', publishAt: new Date(Date.now() - 1000) } });
    expect(await processors.publishArticle(cms.kit.prisma, revalidate, article.id)).toEqual({ published: true });
    const published = await cms.kit.prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    const before = await revalidate.getJobs(['waiting']);
    expect(await processors.publishArticle(cms.kit.prisma, revalidate, article.id)).toEqual({ published: false });
    expect((await cms.kit.prisma.article.findUniqueOrThrow({ where: { id: article.id } })).publishedAt).toEqual(published.publishedAt);
    const previousIds = new Set(before.map((job) => job.id));
    const fresh = (await revalidate.getJobs(['waiting'])).filter((job) => !previousIds.has(job.id));
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ name: REVALIDATE_TAGS_JOB, data: { tags: ['articles', 'home', `article-${article.slug}`] } });
  });

  it('reads changed retention settings and deletes only messages older than the configured window', async () => {
    const day = 86_400_000;
    const ids: string[] = [];
    for (const [age, status] of [[10, 'NEW'], [4, 'READ'], [0, 'ARCHIVED']] as const) {
      const email = `retention-${age}-${cms.tag}@example.test`;
      cms.contactEmails.add(email);
      const row = await cms.kit.prisma.contactMessage.create({ data: {
        name: 'Retention fixture', email, message: 'Retention probe', ipHash: 'fixture', status, createdAt: new Date(Date.now() - age * day),
      } });
      ids.push(row.id);
    }
    await withRetentionSetting(cms.kit.prisma, async (setDays) => {
      for (const days of [7, 2]) {
        await setDays(days);
        const result = await cms.kit.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`LOCK TABLE "ContactMessage" IN SHARE ROW EXCLUSIVE MODE`;
          await tx.$executeRaw`LOCK TABLE "AppSetting" IN SHARE MODE`;
          const setting = await tx.appSetting.findUniqueOrThrow({ where: { key: contentSettings.contactRetentionDays.key } });
          expect(setting.value, 'Refusing cleanup after an external retention change').toBe(days);
          const foreign = await tx.contactMessage.count({ where: { id: { notIn: ids }, createdAt: { lt: new Date(Date.now() - days * day + 60_000) } } });
          expect(foreign, 'Refusing retention cleanup while it could delete another fixture\'s messages').toBe(0);
          return processors.cleanupContactMessages(tx);
        });
        expect(result).toEqual({ count: 1 });
        const kept = await cms.kit.prisma.contactMessage.findMany({ where: { id: { in: ids } }, select: { id: true } });
        expect(kept.map(({ id }) => id).sort()).toEqual((days === 7 ? ids.slice(1) : ids.slice(2)).sort());
      }
    });
  });
});
