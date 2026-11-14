import { Injectable } from '@nestjs/common';
import { appSettingRegistry, publicSiteSettings, type PublicSiteConfig, type PublicSitemap } from '@kamito/shared';
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
    const [siteName, windowSeconds, maxRequests, searchMaxRequests, maxTrackedIps] = await Promise.all([
      this.settings.get(appSettingRegistry.siteName),
      this.settings.get(publicSiteSettings.rateLimitWindowSeconds),
      this.settings.get(publicSiteSettings.rateLimitMaxRequests),
      this.settings.get(publicSiteSettings.rateLimitSearchMaxRequests),
      this.settings.get(publicSiteSettings.rateLimitMaxTrackedIps),
    ]);
    return { siteName, rateLimit: { windowSeconds, maxRequests, searchMaxRequests, maxTrackedIps } };
  }

  /** Every public event, newest change first; the client builds the per-locale URLs. */
  async sitemap(): Promise<PublicSitemap> {
    const rows = await this.prisma.event.findMany({
      where: publicScope.events,
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    return { events: rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() })) };
  }
}
