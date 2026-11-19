import { Injectable } from '@nestjs/common';
import { appSettingRegistry, contentSettings, publicSiteSettings, type PublicSiteConfig, type PublicSitemap } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { AppSettingsService } from '../settings/app-settings.service.js';

@Injectable()
export class PublicSiteQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  async config(): Promise<PublicSiteConfig> {
    const [siteName, windowSeconds, maxRequests, searchMaxRequests, maxTrackedIps, contactWindowSeconds, contactMaxRequests] = await Promise.all([
      this.settings.get(appSettingRegistry.siteName),
      this.settings.get(publicSiteSettings.rateLimitWindowSeconds),
      this.settings.get(publicSiteSettings.rateLimitMaxRequests),
      this.settings.get(publicSiteSettings.rateLimitSearchMaxRequests),
      this.settings.get(publicSiteSettings.rateLimitMaxTrackedIps),
      this.settings.get(contentSettings.contactRateWindowSeconds),
      this.settings.get(contentSettings.contactRateMaxRequests),
    ]);
    return { siteName, rateLimit: { windowSeconds, maxRequests, searchMaxRequests, maxTrackedIps }, contactRateLimit: { windowSeconds: contactWindowSeconds, maxRequests: contactMaxRequests } };
  }

  /** Every public event, newest change first; the client builds the per-locale URLs. */
  async sitemap(): Promise<PublicSitemap> {
    const [events, articles, pages] = await Promise.all([
      this.prisma.event.findMany({ where: publicScope.events, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.article.findMany({ where: { status: 'PUBLISHED', publishedAt: { not: null, lte: new Date() } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.staticPage.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
    ]);
    const serialize = (rows: { slug: string; updatedAt: Date }[]) => rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
    return { events: serialize(events), articles: serialize(articles), pages: serialize(pages) };
  }
}
