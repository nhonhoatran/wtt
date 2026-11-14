import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { lifecycleFromDates, todayInTimezone, tournamentSettings, type PublicResultsStrip } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { dateOnly } from '../public-events/public-event.serializer.js';
import { publicScope } from '../public-scope/public-scope.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PUBLIC_MATCH_CARD_SELECT, toPublicMatchCard } from './public-match.serializer.js';

const DAY_MS = 86_400_000;

const STRIP_SELECT = { ...PUBLIC_MATCH_CARD_SELECT, event: { select: { slug: true, name: true, nameEn: true } } } satisfies Prisma.MatchSelect;

@Injectable()
export class PublicResultsStripQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Null while the strip is switched off. Live matches first, then the latest confirmed (voided results left out), of events in progress today. */
  async strip(): Promise<PublicResultsStrip | null> {
    const [enabled, limit] = await Promise.all([
      this.settings.get(tournamentSettings.resultsStripEnabled),
      this.settings.get(tournamentSettings.resultsStripLimit),
    ]);
    if (!enabled) return null;

    // A one-day margin on each side covers every time zone; the exact check runs per event below.
    const now = Date.now();
    const candidates = await this.prisma.event.findMany({
      where: { ...publicScope.events, startDate: { lte: new Date(now + DAY_MS) }, endDate: { gte: new Date(now - 2 * DAY_MS) } },
      select: { slug: true, startDate: true, endDate: true, timezone: true },
    });
    const slugs = candidates
      .filter((e) => lifecycleFromDates({ startDate: dateOnly(e.startDate), endDate: dateOnly(e.endDate), isCancelled: false, today: todayInTimezone(e.timezone) }) === 'ONGOING')
      .map((e) => e.slug);
    if (!slugs.length) return { items: [] };

    const scope = publicScope.matchIn({ slug: { in: slugs } });
    const [live, official] = await Promise.all([
      this.prisma.match.findMany({ where: { ...scope, status: 'LIVE' }, select: STRIP_SELECT, orderBy: [{ startedAt: 'desc' }, { matchNo: 'desc' }], take: limit }),
      this.prisma.match.findMany({ where: { ...scope, status: 'OFFICIAL', isVoided: false }, select: STRIP_SELECT, orderBy: [{ officialAt: { sort: 'desc', nulls: 'last' } }, { matchNo: 'desc' }], take: limit }),
    ]);
    return {
      items: [...live, ...official].slice(0, limit).map((row) => ({ ...toPublicMatchCard(row), event: { slug: row.event.slug, name: row.event.name, nameEn: row.event.nameEn } })),
    };
  }
}
