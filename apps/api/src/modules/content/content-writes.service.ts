import { Injectable } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import type { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { sanitizeRichHtml } from '../../common/html/sanitize-rich-html.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { parseVideoUrl } from '../videos/video-url-parser.js';
import type { articleBody, contactStatusBody, sponsorBody, staticPageBody, updateSponsorBody, videoBody } from './admin-content-dtos.js';
import { contentAuditSnapshot, type ContentAuditEntity } from './content-audit.js';
import { PublishingEnqueueService } from './publishing-enqueue.service.js';

interface ContentChange<T> { data: T; before?: unknown; after?: unknown }
const ARTICLE_EVENTS = { events: { select: { eventId: true } } } as const;
const cleanBody = (input: { body: string; bodyEn?: string | null }) => ({
  body: sanitizeRichHtml(input.body), bodyEn: input.bodyEn ? sanitizeRichHtml(input.bodyEn) : null,
});

@Injectable()
export class ContentWritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationEnqueueService,
    private readonly publishing: PublishingEnqueueService,
  ) {}

  async createArticle(input: z.infer<typeof articleBody>) {
    const { eventIds, publishAt, ...fields } = input;
    const row = await this.commit('Article', 'article.create', undefined, async (tx) => {
      const data = await tx.article.create({ data: {
        ...fields, ...cleanBody(input), publishAt: publishAt ? new Date(publishAt) : null,
        publishedAt: fields.status === 'PUBLISHED' ? new Date() : null,
        events: { create: eventIds.map((eventId) => ({ eventId })) },
      }, include: ARTICLE_EVENTS });
      return { data, after: data };
    });
    const warnings = row.status === 'SCHEDULED' ? await this.publishing.scheduleArticle(row.id, row.publishAt) : [];
    return this.refreshed(row, warnings);
  }

  async updateArticle(id: string, input: z.infer<typeof articleBody>) {
    const { eventIds, publishAt, ...fields } = input;
    const change = await this.commit('Article', 'article.update', id, async (tx) => {
      const before = await tx.article.findUniqueOrThrow({ where: { id }, include: ARTICLE_EVENTS });
      const row = await tx.article.update({ where: { id }, data: {
        ...fields, ...cleanBody(input), publishAt: publishAt ? new Date(publishAt) : null,
        publishedAt: fields.status === 'PUBLISHED' ? before.publishedAt ?? new Date() : null,
        events: { deleteMany: {}, create: eventIds.map((eventId) => ({ eventId })) },
      }, include: ARTICLE_EVENTS });
      return { data: { before, row }, before, after: row };
    });
    const { before, row } = change;
    const warnings: string[] = [];
    if (before.status === 'SCHEDULED' && (row.status !== 'SCHEDULED' || before.publishAt?.getTime() !== row.publishAt?.getTime())) {
      warnings.push(...await this.publishing.cancelArticleSchedule(id, before.publishAt));
    }
    if (row.status === 'SCHEDULED') warnings.push(...await this.publishing.scheduleArticle(id, row.publishAt));
    return this.refreshed(row, warnings);
  }

  async deleteArticle(id: string) {
    const before = await this.commit('Article', 'article.delete', id, async (tx) => {
      const before = await tx.article.delete({ where: { id }, include: ARTICLE_EVENTS });
      return { data: before, before };
    });
    const warnings = before.status === 'SCHEDULED' ? await this.publishing.cancelArticleSchedule(id, before.publishAt) : [];
    return this.refreshed({ id }, warnings);
  }

  async saveVideo(input: z.infer<typeof videoBody>, id?: string) {
    const parsed = parseVideoUrl(input.url)!;
    const { publishedAt, ...fields } = input;
    const row = await this.commit('Video', `video.${id ? 'update' : 'create'}`, id, async (tx) => {
      const before = id ? await tx.video.findUniqueOrThrow({ where: { id } }) : undefined;
      const data = {
        ...fields, url: parsed.normalizedUrl, provider: parsed.provider, embedId: parsed.embedId,
        thumbnailUrl: parsed.thumbnailUrl,
        publishedAt: fields.status === 'PUBLISHED' ? (publishedAt ? new Date(publishedAt) : before?.publishedAt ?? new Date()) : null,
      };
      const row = id ? await tx.video.update({ where: { id }, data }) : await tx.video.create({ data });
      return { data: row, before, after: row };
    });
    return this.refreshed(row);
  }

  async deleteVideo(id: string) {
    await this.commit('Video', 'video.delete', id, async (tx) => {
      const before = await tx.video.delete({ where: { id } });
      return { data: { id }, before };
    });
    return this.refreshed({ id });
  }

  async createSponsor(input: z.infer<typeof sponsorBody>) {
    const row = await this.commit('Sponsor', 'sponsor.create', undefined, async (tx) => {
      const data = await tx.sponsor.create({ data: input });
      return { data, after: data };
    });
    return this.refreshed(row);
  }

  async updateSponsor(id: string, input: z.infer<typeof updateSponsorBody>) {
    const row = await this.commit('Sponsor', 'sponsor.update', id, async (tx) => {
      const before = await tx.sponsor.findUniqueOrThrow({ where: { id } });
      const data = await tx.sponsor.update({ where: { id }, data: input });
      return { data, before, after: data };
    });
    return this.refreshed(row);
  }

  async deleteSponsor(id: string) {
    await this.commit('Sponsor', 'sponsor.delete', id, async (tx) => {
      const before = await tx.sponsor.delete({ where: { id } });
      return { data: { id }, before };
    });
    return this.refreshed({ id });
  }

  async savePage(input: z.infer<typeof staticPageBody>, id?: string) {
    const row = await this.commit('StaticPage', `staticPage.${id ? 'update' : 'create'}`, id, async (tx) => {
      const before = id ? await tx.staticPage.findUniqueOrThrow({ where: { id } }) : undefined;
      const data = { ...input, ...cleanBody(input) };
      const row = id ? await tx.staticPage.update({ where: { id }, data }) : await tx.staticPage.create({ data });
      return { data: row, before, after: row };
    });
    return this.refreshed(row);
  }

  async deletePage(id: string) {
    await this.commit('StaticPage', 'staticPage.delete', id, async (tx) => {
      const before = await tx.staticPage.delete({ where: { id } });
      return { data: { id }, before };
    });
    return this.refreshed({ id });
  }

  async updateContact(id: string, input: z.infer<typeof contactStatusBody>) {
    const data = await this.commit('ContactMessage', 'contactMessage.update', id, async (tx) => {
      const before = await tx.contactMessage.findUniqueOrThrow({ where: { id }, select: { id: true, status: true } });
      const data = await tx.contactMessage.update({ where: { id }, data: input, select: { id: true, status: true } });
      return { data, before, after: data };
    });
    return { data };
  }

  private commit<T>(entity: ContentAuditEntity, action: string, id: string | undefined, run: (tx: Prisma.TransactionClient) => Promise<ContentChange<T>>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Table identifiers come exclusively from the fixed ContentAuditEntity union above.
      if (id) await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(`"${entity}"`)} WHERE id = ${id} FOR UPDATE`);
      const change = await run(tx);
      const entityId = id ?? (change.data as { id: string }).id;
      await this.audit.record({ action, entity, entityId,
        before: contentAuditSnapshot(entity, change.before), after: contentAuditSnapshot(entity, change.after),
      }, tx);
      return change.data;
    });
  }

  private async refreshed<T>(data: T, queueWarnings: string[] = []) {
    const warnings = [...new Set([...queueWarnings, ...await this.revalidation.enqueue(() => CACHE_TAGS['content.write']())])];
    return { data, ...(warnings.length > 0 && { warnings }) };
  }
}
