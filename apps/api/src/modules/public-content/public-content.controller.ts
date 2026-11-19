import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, HttpException, HttpStatus, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { contentSettings, rankingSettings, PUBLIC_API_SEGMENT, PublicArticleList, PublicHome, PublicSponsor, PublicVideoList } from '@kamito/shared';
import { REDIS_CONNECTION } from '../queue/redis-connection.provider.js';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { sanitizeRichHtml } from '../../common/html/sanitize-rich-html.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { Public } from '../access-control/access-decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { mediaPublicBaseUrl, readVariants } from '../media/media-dtos.js';
import { publicUrlFor } from '@kamito/shared/media';
import { publicScope } from '../public-scope/public-scope.js';
import { toPublicEventCard } from '../public-events/public-event.serializer.js';
import { publicHomeEvents } from '../public-events/public-home-events.query.js';
import { PUBLIC_RANKING_LIST_SELECT, PUBLIC_RANKING_ROW_SELECT, toPublicRankingList, toPublicRankingRow } from '../public-rankings/public-ranking.serializer.js';

const contactBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).nullable().optional(),
  organization: z.string().trim().max(160).nullable().optional(),
  message: z.string().trim().min(1).max(5000),
  website: z.string().max(500).optional(),
});
const pageNum = (raw: unknown) => Math.max(1, Math.min(10_000, Number.isInteger(Number(raw)) ? Number(raw) : 1));
const articleEvents = { select: { event: { select: { slug: true } } }, where: { event: publicScope.events } } as const;
const videoEvent = { select: { slug: true, publishStatus: true, isCancelled: true } } as const;
const CONTACT_RATE_LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

@Public()
@UseGuards(SsrInternalGuard)
@Controller(PUBLIC_API_SEGMENT)
export class PublicContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
  ) {}

  @Get('articles')
  async articles(@Query('category') category?: string, @Query('page') rawPage?: string, @Query('event') event?: string): Promise<{ data: PublicArticleList }> {
    const [pageSize, categories] = await Promise.all([
      this.settings.get(contentSettings.newsPageSize), this.settings.get(contentSettings.newsCategories),
    ]);
    const page = pageNum(rawPage);
    const where = {
      status: 'PUBLISHED' as const, publishedAt: { not: null, lte: new Date() },
      ...(category && categories.includes(category) ? { category } : {}),
      ...(typeof event === 'string' && event ? { events: { some: { event: publicScope.event(event) } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.article.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, include: { events: articleEvents, coverMedia: true } }),
      this.prisma.article.count({ where }),
    ]);
    return { data: { data: rows.map((row) => this.articleCard(row)), total, page, pageSize, categories } };
  }

  @Get('home')
  async home(): Promise<{ data: PublicHome }> {
    const sections = await this.settings.get(contentSettings.homeSections);
    const [itemLimit, topN] = await Promise.all([
      this.settings.get(contentSettings.homeItemsPerSection), this.settings.get(rankingSettings.overviewTopN),
    ]);
    const now = new Date();
    const [featuredEventRows, eventRows, articles, videos, sponsors, rankingLists] = await Promise.all([
      publicHomeEvents(this.prisma, now, itemLimit, true),
      publicHomeEvents(this.prisma, now, itemLimit),
      this.prisma.article.findMany({ where: { status: 'PUBLISHED', isFeatured: true, publishedAt: { not: null, lte: now } }, orderBy: { publishedAt: 'desc' }, take: itemLimit, include: { events: articleEvents, coverMedia: true } }),
      this.prisma.video.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null, lte: now } }, orderBy: { publishedAt: 'desc' }, take: itemLimit, include: { event: videoEvent } }),
      this.prisma.sponsor.findMany({ where: { isActive: true, eventId: null }, orderBy: [{ order: 'asc' }, { name: 'asc' }], take: itemLimit, include: { logoMedia: true, logoDarkMedia: true } }),
      sections.rankings ? this.prisma.rankingList.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { code: 'asc' }], take: itemLimit, select: { ...PUBLIC_RANKING_LIST_SELECT, snapshots: { where: { status: 'PUBLISHED' }, orderBy: [{ asOfDate: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }], take: 1, select: { asOfDate: true, publishedAt: true, rows: { orderBy: [{ rank: 'asc' }, { playerId: 'asc' }], take: topN, select: { ...PUBLIC_RANKING_ROW_SELECT, breakdown: false } } } } } }) : Promise.resolve([]),
    ]);
    return { data: {
      featuredEvents: sections.hero ? featuredEventRows.map((event) => toPublicEventCard(event, mediaPublicBaseUrl(this.env))) : [],
      upcomingEvents: sections.events ? eventRows.map((event) => toPublicEventCard(event, mediaPublicBaseUrl(this.env))) : [],
      featuredArticles: sections.news ? articles.map((article) => this.articleCard(article)) : [],
      latestVideos: sections.videos ? videos.map((video) => this.videoView(video)) : [],
      sponsors: sections.sponsors ? sponsors.map((sponsor) => this.sponsorView(sponsor)) : [],
      topRankings: sections.rankings ? rankingLists.map((list) => {
        const snapshot = list.snapshots[0];
        return {
          list: toPublicRankingList(list),
          asOfDate: snapshot?.asOfDate.toISOString().slice(0, 10) ?? null,
          publishedAt: snapshot?.publishedAt?.toISOString() ?? null,
          items: (snapshot?.rows ?? []).map((row) => toPublicRankingRow({ ...row, breakdown: [] }, mediaPublicBaseUrl(this.env), new Map())),
        };
      }) : [],
      sections,
    } };
  }

  @Get('events/:slug/content')
  async eventContent(@Param('slug') slug: string) {
    const event = await this.prisma.event.findFirst({ where: publicScope.event(slug), select: { id: true } });
    if (!event) return { data: { articles: [], videos: [], sponsors: [] } };
    const itemLimit = await this.settings.get(contentSettings.homeItemsPerSection);
    const [articles, videos, sponsors] = await Promise.all([
      this.prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null, lte: new Date() }, events: { some: { eventId: event.id } } }, orderBy: { publishedAt: 'desc' }, take: itemLimit, include: { events: articleEvents, coverMedia: true } }),
      this.prisma.video.findMany({ where: { eventId: event.id, status: 'PUBLISHED', publishedAt: { not: null, lte: new Date() } }, orderBy: { publishedAt: 'desc' }, take: itemLimit, include: { event: videoEvent } }),
      this.prisma.sponsor.findMany({ where: { isActive: true, OR: [{ eventId: null }, { eventId: event.id }] }, orderBy: [{ order: 'asc' }, { name: 'asc' }], include: { logoMedia: true, logoDarkMedia: true } }),
    ]);
    return { data: { articles: articles.map((article) => this.articleCard(article)), videos: videos.map((video) => this.videoView(video)), sponsors: sponsors.map((sponsor) => this.sponsorView(sponsor)) } };
  }

  @Get('articles/:slug')
  async article(@Param('slug') slug: string) {
    const row = await this.prisma.article.findFirst({ where: { slug, status: 'PUBLISHED', publishedAt: { not: null, lte: new Date() } }, include: { events: articleEvents, coverMedia: true } });
    return { data: row ? { ...this.articleCard(row), body: sanitizeRichHtml(row.body), bodyEn: row.bodyEn ? sanitizeRichHtml(row.bodyEn) : null } : null };
  }

  @Get('videos')
  async videos(@Query('page') rawPage?: string): Promise<{ data: PublicVideoList }> {
    const page = pageNum(rawPage);
    const pageSize = await this.settings.get(contentSettings.newsPageSize);
    const where = { status: 'PUBLISHED' as const, publishedAt: { not: null, lte: new Date() } };
    const [rows, total] = await Promise.all([
      this.prisma.video.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, include: { event: videoEvent } }),
      this.prisma.video.count({ where }),
    ]);
    return { data: { data: rows.map((row) => this.videoView(row)), total, page, pageSize } };
  }

  @Get('videos/:slug')
  async video(@Param('slug') slug: string) {
    const row = await this.prisma.video.findFirst({ where: { slug, status: 'PUBLISHED', publishedAt: { not: null, lte: new Date() } }, include: { event: videoEvent } });
    return { data: row ? this.videoView(row) : null };
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const row = await this.prisma.staticPage.findFirst({ where: { slug, status: 'PUBLISHED' } });
    return { data: row ? { slug: row.slug, title: row.title, titleEn: row.titleEn, body: sanitizeRichHtml(row.body), bodyEn: row.bodyEn ? sanitizeRichHtml(row.bodyEn) : null, updatedAt: row.updatedAt.toISOString() } : null };
  }

  @Get('footer')
  async footer() {
    const [pages, sponsors] = await Promise.all([
      this.prisma.staticPage.findMany({ where: { status: 'PUBLISHED', footerGroup: { not: null } }, orderBy: [{ footerOrder: 'asc' }, { title: 'asc' }], select: { slug: true, title: true, titleEn: true, footerGroup: true, footerOrder: true } }),
      this.prisma.sponsor.findMany({ where: { isActive: true, eventId: null }, orderBy: [{ order: 'asc' }, { name: 'asc' }], include: { logoMedia: true, logoDarkMedia: true } }),
    ]);
    return { data: { pages: pages.map((p) => ({ slug: p.slug, title: p.title, titleEn: p.titleEn, group: p.footerGroup, order: p.footerOrder ?? 0 })), sponsors: sponsors.map((s) => this.sponsorView(s)) } };
  }

  @Get('sponsors')
  async sponsors(@Query('eventSlug') eventSlug?: string): Promise<{ data: PublicSponsor[] }> {
    const event = eventSlug ? await this.prisma.event.findFirst({ where: publicScope.event(eventSlug), select: { id: true } }) : null;
    const rows = await this.prisma.sponsor.findMany({ where: { isActive: true, OR: [{ eventId: null }, ...(event ? [{ eventId: event.id }] : [])] }, orderBy: [{ order: 'asc' }, { name: 'asc' }], include: { logoMedia: true, logoDarkMedia: true } });
    return { data: rows.map((row) => this.sponsorView(row)) };
  }

  @Post('contact')
  @HttpCode(202)
  async contact(@Body() body: unknown, @Headers('x-verified-client-ip') verifiedIp?: string) {
    const input = parseBody(contactBody, body);
    if (input.website) return { data: { accepted: true } };
    if (!verifiedIp || isIP(verifiedIp) === 0) throw new UnprocessableEntityException({ code: 'CLIENT_IP_REQUIRED' });
    const ipHash = createHash('sha256').update(this.env.IP_HASH_SALT).update(':').update(verifiedIp).digest('hex');
    const [windowSeconds, maxRequests] = await Promise.all([
      this.settings.get(contentSettings.contactRateWindowSeconds), this.settings.get(contentSettings.contactRateMaxRequests),
    ]);
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `${this.env.QUEUE_PREFIX}:contact:${ipHash}:${bucket}`;
    const count = Number(await this.redis.eval(CONTACT_RATE_LIMIT, 1, key, windowSeconds));
    if (count > maxRequests) throw new HttpException({ code: 'TOO_MANY_REQUESTS' }, HttpStatus.TOO_MANY_REQUESTS);
    await this.prisma.contactMessage.create({ data: { name: input.name, email: input.email, phone: input.phone || null, organization: input.organization || null, message: input.message, ipHash } });
    return { data: { accepted: true } };
  }

  private articleCard(row: { slug: string; title: string; titleEn: string | null; summary: string | null; summaryEn: string | null; category: string | null; authorName: string | null; publishedAt: Date | null; body: string; coverMedia: { status: string; width: number | null; height: number | null; altText: string | null; altTextEn: string | null; variants: unknown } | null; events: Array<{ event: { slug: string } }> }) {
    const variant = readVariants(row.coverMedia?.variants as never).at(-1);
    const cover = row.coverMedia?.status === 'READY' && variant ? { url: publicUrlFor(mediaPublicBaseUrl(this.env), variant.key), width: variant.width, height: variant.height, alt: row.coverMedia.altText, altEn: row.coverMedia.altTextEn } : null;
    return { slug: row.slug, title: row.title, titleEn: row.titleEn, summary: row.summary, summaryEn: row.summaryEn, cover, category: row.category, authorName: row.authorName, publishedAt: row.publishedAt?.toISOString() ?? '', eventSlugs: row.events.map((event) => event.event.slug) };
  }

  private videoView(row: { slug: string; title: string; titleEn: string | null; provider: string; embedId: string; url: string; thumbnailUrl: string | null; durationText: string | null; publishedAt: Date | null; event: { slug: string; publishStatus: string; isCancelled: boolean } | null }) {
    return { slug: row.slug, title: row.title, titleEn: row.titleEn, provider: row.provider, embedId: row.embedId, url: row.url, thumbnailUrl: row.thumbnailUrl, durationText: row.durationText, publishedAt: row.publishedAt?.toISOString() ?? '', eventSlug: row.event?.publishStatus === 'PUBLISHED' && !row.event.isCancelled ? row.event.slug : null };
  }

  private sponsorView(row: { name: string; logoMedia: { status: string; width: number | null; height: number | null; altText: string | null; altTextEn: string | null; variants: unknown } | null; logoDarkMedia: { status: string; width: number | null; height: number | null; altText: string | null; altTextEn: string | null; variants: unknown } | null; url: string | null; roleLabel: string | null; roleLabelEn: string | null }): PublicSponsor {
    const toImage = (asset: typeof row.logoMedia) => {
      const variant = readVariants(asset?.variants as never).at(-1);
      return asset?.status === 'READY' && variant ? { url: publicUrlFor(mediaPublicBaseUrl(this.env), variant.key), width: variant.width, height: variant.height, alt: asset.altText, altEn: asset.altTextEn } : null;
    };
    return { name: row.name, logo: toImage(row.logoMedia), logoDark: toImage(row.logoDarkMedia), url: row.url, roleLabel: row.roleLabel, roleLabelEn: row.roleLabelEn };
  }
}
