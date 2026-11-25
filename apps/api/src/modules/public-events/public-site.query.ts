import { Injectable } from '@nestjs/common';
import { appSettingRegistry, contentSettings, publicSiteDisplaySettings, publicSiteSettings, rankingSettings, type PublicSiteConfig, type PublicSitemap } from '@kamito/shared';
import { sanitizeRichHtmlOrNull } from '../../common/html/sanitize-rich-html.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { AppSettingsService } from '../settings/app-settings.service.js';

const SITEMAP_DRAW_ORDER = ['MAIN', 'QUALIFYING'] as const;

@Injectable()
export class PublicSiteQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  async config(): Promise<PublicSiteConfig> {
    const [siteName, windowSeconds, maxRequests, searchMaxRequests, maxTrackedIps, contactWindowSeconds, contactMaxRequests, navItems, socialLinks, tagline, registrationUrl, expiringSoonDays] = await Promise.all([
      this.settings.get(appSettingRegistry.siteName),
      this.settings.get(publicSiteSettings.rateLimitWindowSeconds),
      this.settings.get(publicSiteSettings.rateLimitMaxRequests),
      this.settings.get(publicSiteSettings.rateLimitSearchMaxRequests),
      this.settings.get(publicSiteSettings.rateLimitMaxTrackedIps),
      this.settings.get(contentSettings.contactRateWindowSeconds),
      this.settings.get(contentSettings.contactRateMaxRequests),
      this.settings.get(publicSiteDisplaySettings.navItems),
      this.settings.get(publicSiteDisplaySettings.socialLinks),
      this.settings.get(publicSiteDisplaySettings.tagline),
      this.settings.get(publicSiteDisplaySettings.registrationUrl),
      this.settings.get(rankingSettings.expiringSoonDays),
    ]);
    return {
      siteName,
      rateLimit: { windowSeconds, maxRequests, searchMaxRequests, maxTrackedIps },
      contactRateLimit: { windowSeconds: contactWindowSeconds, maxRequests: contactMaxRequests },
      display: { navItems, socialLinks, tagline, registrationUrl, rankingExpiringSoonDays: expiringSoonDays },
    };
  }

  /** Every public event, newest change first; the client builds the per-locale URLs. */
  async sitemap(): Promise<PublicSitemap> {
    const now = new Date();
    const [events, articles, pages, videos, matches, eventsWithMatches, eventsWithScheduledMatches] = await Promise.all([
      this.prisma.event.findMany({
        where: publicScope.events,
        select: {
          id: true, slug: true, updatedAt: true, showInfoTab: true, infoBody: true, infoBodyEn: true,
          subEvents: {
            orderBy: [{ order: 'asc' }, { code: 'asc' }],
            select: {
              code: true,
              draws: { where: publicScope.draw, select: { kind: true } },
              rankingList: { select: { isActive: true } },
              _count: { select: { entries: { where: publicScope.entry } } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null, lte: now } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.staticPage.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.video.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null, lte: now } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.match.findMany({
        where: { ...publicScope.matchIn(publicScope.events), status: 'OFFICIAL', isVoided: false },
        select: { matchNo: true, updatedAt: true, event: { select: { slug: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.match.groupBy({ by: ['eventId'], where: publicScope.matchIn(publicScope.events) }),
      this.prisma.match.groupBy({ by: ['eventId'], where: {
        ...publicScope.matchIn(publicScope.events), sessionId: { not: null }, tableId: { not: null }, scheduledAt: { not: null },
      } }),
    ]);
    const serialize = (rows: { slug: string; updatedAt: Date }[]) => rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
    const eventIdsWithMatches = new Set(eventsWithMatches.map((row) => row.eventId));
    const eventIdsWithScheduledMatches = new Set(eventsWithScheduledMatches.map((row) => row.eventId));
    return {
      events: events.map((event) => ({
        slug: event.slug,
        updatedAt: event.updatedAt.toISOString(),
        tabs: {
          matches: eventIdsWithMatches.has(event.id),
          info: eventIdsWithScheduledMatches.has(event.id) || (event.showInfoTab && (
            Boolean(sanitizeRichHtmlOrNull(event.infoBody) || sanitizeRichHtmlOrNull(event.infoBodyEn)) || event.subEvents.some((subEvent) => subEvent.rankingList?.isActive)
          )),
        },
        subEvents: event.subEvents.map((subEvent) => ({
          code: subEvent.code,
          drawKinds: SITEMAP_DRAW_ORDER.filter((kind) => subEvent.draws.some((draw) => draw.kind === kind)),
          hasGroups: subEvent.draws.some((draw) => draw.kind === 'GROUP'),
          entryCount: subEvent._count.entries,
        })),
      })),
      articles: serialize(articles),
      pages: serialize(pages),
      videos: serialize(videos),
      matches: matches.map((match) => ({ eventSlug: match.event.slug, matchNo: match.matchNo, updatedAt: match.updatedAt.toISOString() })),
    };
  }
}
