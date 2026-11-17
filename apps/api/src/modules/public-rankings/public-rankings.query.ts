import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { PLAYER_CLUB_MAX_LENGTH, rankingSettings, tournamentSettings, type PublicRankingList, type PublicRankingOverview } from '@kamito/shared';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { mediaPublicBaseUrl } from '../media/media-dtos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dateOnly } from '../public-events/public-event.serializer.js';
import { pageWindow, parsePublicPage, parsePublicSearch } from '../public-scope/public-query-params.js';
import { publicScope } from '../public-scope/public-scope.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { breakdownEventIds, PUBLIC_RANKING_LIST_SELECT, PUBLIC_RANKING_ROW_SELECT, toPublicRankingList, toPublicRankingRow, type RankingRow } from './public-ranking.serializer.js';

export interface PublicRankingParams { q?: unknown; club?: unknown; page?: unknown; pageSize?: unknown }

const SNAPSHOT_ORDER = [{ asOfDate: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] as const;

/** Technical cap for public requests, independent of the admin list page size. */
export const publicPageSize = (raw: unknown, fallback: number): number => {
  const value = typeof raw === 'string' && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 1 ? Math.min(value, 100) : fallback;
};

/** Club names are labels rather than catalog codes; limit input and never interpolate into SQL. */
export const publicClub = (raw: unknown): string | undefined => typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, PLAYER_CLUB_MAX_LENGTH) : undefined;

@Injectable()
export class PublicRankingsQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async overview(): Promise<PublicRankingOverview> {
    const topN = await this.settings.get(rankingSettings.overviewTopN);
    const lists = await this.prisma.rankingList.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
      select: {
        ...PUBLIC_RANKING_LIST_SELECT,
        snapshots: {
          where: { status: 'PUBLISHED' },
          orderBy: [...SNAPSHOT_ORDER],
          take: 1,
          select: { asOfDate: true, publishedAt: true, rows: {
            orderBy: [{ rank: 'asc' }, { playerId: 'asc' }], take: topN,
            select: { ...PUBLIC_RANKING_ROW_SELECT, breakdown: false },
          } },
        },
      },
    });
    const base = mediaPublicBaseUrl(this.env);
    return {
      topN,
      items: lists.map((list) => {
        const snapshot = list.snapshots[0];
        return {
          list: toPublicRankingList(list),
          asOfDate: snapshot ? dateOnly(snapshot.asOfDate) : null,
          publishedAt: snapshot?.publishedAt?.toISOString() ?? null,
          // Compact overview cards do not render breakdowns; fetch them only on the full list page.
          items: (snapshot?.rows ?? []).map((row) => toPublicRankingRow({ ...row, breakdown: [] }, base, new Map())),
        };
      }),
    };
  }

  async list(code: string, query: PublicRankingParams): Promise<PublicRankingList | null> {
    const list = await this.prisma.rankingList.findFirst({
      where: { code, isActive: true },
      select: {
        ...PUBLIC_RANKING_LIST_SELECT,
        snapshots: { where: { status: 'PUBLISHED' }, orderBy: [...SNAPSHOT_ORDER], take: 1, select: { id: true, asOfDate: true, publishedAt: true } },
      },
    });
    if (!list) return null;
    const page = parsePublicPage(query.page);
    const pageSize = publicPageSize(query.pageSize, await this.settings.get(tournamentSettings.publicListPageSize));
    const snapshot = list.snapshots[0];
    if (!snapshot) return { list: toPublicRankingList(list), asOfDate: null, publishedAt: null, items: [], page, pageSize, total: 0, clubs: [] };

    const player: Prisma.PlayerWhereInput = {};
    const search = parsePublicSearch(query.q);
    if (search) player.normalizedPublicName = { contains: search.normalized };
    const club = publicClub(query.club);
    if (club) player.club = club;
    const where = { snapshotId: snapshot.id, player };
    const [rows, total, clubs] = await Promise.all([
      this.prisma.rankingSnapshotRow.findMany({ where, select: PUBLIC_RANKING_ROW_SELECT, orderBy: [{ rank: 'asc' }, { playerId: 'asc' }], ...pageWindow(page, pageSize) }),
      this.prisma.rankingSnapshotRow.count({ where }),
      this.prisma.player.findMany({ where: { club: { not: null }, rankingSnapshotRows: { some: { snapshotId: snapshot.id } } }, distinct: ['club'], select: { club: true }, orderBy: { club: 'asc' } }),
    ]);
    const publicEvents = await this.publicEvents(rows);
    return {
      list: toPublicRankingList(list),
      asOfDate: dateOnly(snapshot.asOfDate),
      publishedAt: snapshot.publishedAt?.toISOString() ?? null,
      items: rows.map((row) => toPublicRankingRow(row, mediaPublicBaseUrl(this.env), publicEvents)),
      page,
      pageSize,
      total,
      clubs: clubs.flatMap((p) => p.club ? [p.club] : []),
    };
  }

  private async publicEvents(rows: RankingRow[]): Promise<Map<string, string>> {
    const ids = breakdownEventIds(rows);
    if (!ids.length) return new Map();
    const events = await this.prisma.event.findMany({ where: { ...publicScope.events, id: { in: ids } }, select: { id: true, slug: true } });
    return new Map(events.map((event) => [event.id, event.slug]));
  }
}
