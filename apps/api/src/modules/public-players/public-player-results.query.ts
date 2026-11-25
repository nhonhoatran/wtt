import { Injectable } from '@nestjs/common';
import { publicPlayerIdFromSlug, tournamentSettings, type PublicPlayerResults } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageWindow, parsePublicPage } from '../public-scope/public-query-params.js';
import { PUBLIC_MATCH_CARD_SELECT, toPublicMatchCard } from '../public-competition/public-match.serializer.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PUBLIC_PROFILE_WHERE } from './public-players.query.js';
import { publicPlayerResultsWhere } from './public-player-results-where.js';

@Injectable()
export class PublicPlayerResultsQuery {
  constructor(private readonly prisma: PrismaService, private readonly settings: AppSettingsService) {}

  async results(slug: string, pageParam: unknown): Promise<PublicPlayerResults | null> {
    const id = publicPlayerIdFromSlug(slug);
    const player = await this.prisma.player.findFirst({ where: { ...PUBLIC_PROFILE_WHERE, ...(id ? { id } : { slug }) }, select: { id: true } });
    if (!player) return null;
    const page = parsePublicPage(pageParam);
    const pageSize = await this.settings.get(tournamentSettings.publicListPageSize);
    const where = publicPlayerResultsWhere(player.id);
    const [rows, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        select: { ...PUBLIC_MATCH_CARD_SELECT, officialAt: true, event: { select: { slug: true, name: true, nameEn: true, timezone: true } } },
        orderBy: [{ officialAt: { sort: 'desc', nulls: 'last' } }, { eventId: 'asc' }, { matchNo: 'desc' }],
        ...pageWindow(page, pageSize),
      }),
      this.prisma.match.count({ where }),
    ]);
    return { items: rows.map((row) => ({
      ...toPublicMatchCard(row),
      event: { slug: row.event.slug, name: row.event.name, nameEn: row.event.nameEn, timezone: row.event.timezone },
      officialAt: row.officialAt?.toISOString() ?? null,
    })), page, pageSize, total };
  }
}
