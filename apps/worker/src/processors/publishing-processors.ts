import { contentSettings, PUBLISHING_SWEEP_JOB } from '@kamito/shared';
import type { PrismaClient } from '@kamito/db';
import type { Queue } from 'bullmq';
import { revalidateTagsJobs } from '@kamito/shared';

const publishTags = ['articles', 'home'];

async function enqueueTags(queue: Queue, tags: string[]): Promise<void> {
  await Promise.all(revalidateTagsJobs(tags).map((job) => queue.add(job.name, job.data, job.opts)));
}

export async function publishArticle(prisma: PrismaClient, revalidate: Queue, articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true, slug: true, status: true, publishAt: true } });
  const now = new Date();
  if (!article?.publishAt || article.publishAt > now) return { published: false };
  if (article.status === 'PUBLISHED') {
    await enqueueTags(revalidate, [...publishTags, `article-${article.slug}`]);
    return { published: false };
  }
  if (article.status !== 'SCHEDULED') return { published: false };
  const updated = await prisma.article.updateMany({
    where: { id: article.id, status: 'SCHEDULED', publishAt: { equals: article.publishAt, lte: now } },
    data: { status: 'PUBLISHED', publishedAt: now },
  });
  if (updated.count !== 1) return { published: false };
  await enqueueTags(revalidate, [...publishTags, `article-${article.slug}`]);
  return { published: true };
}

export async function sweepScheduledArticles(prisma: PrismaClient, revalidate: Queue) {
  const now = new Date();
  const rows = await prisma.article.updateManyAndReturn({
    where: { status: 'SCHEDULED', publishAt: { lte: now } },
    data: { status: 'PUBLISHED', publishedAt: now },
    select: { slug: true },
  });
  // Retrying a sweep must refresh cached lists even if its previous DB write already committed.
  await enqueueTags(revalidate, [...publishTags, ...rows.map((row) => `article-${row.slug}`)]);
  return { published: rows.length };
}

export async function cleanupContactMessages(prisma: PrismaClient): Promise<{ count: number }> {
  const row = await prisma.appSetting.findUnique({ where: { key: contentSettings.contactRetentionDays.key }, select: { value: true } });
  const days = contentSettings.contactRetentionDays.schema.parse(row?.value ?? contentSettings.contactRetentionDays.defaultValue);
  const cutoff = new Date(Date.now() - days * 86_400_000);
  return prisma.contactMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export async function readPublishSweepInterval(prisma: PrismaClient): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: contentSettings.publishSweepIntervalMinutes.key }, select: { value: true } });
  return contentSettings.publishSweepIntervalMinutes.schema.parse(row?.value ?? contentSettings.publishSweepIntervalMinutes.defaultValue);
}

export const publishingSweepName = PUBLISHING_SWEEP_JOB;
