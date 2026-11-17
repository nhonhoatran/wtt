import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { publicPlayerSlug, tournamentSettings, type PublicPlayerList } from '@kamito/shared';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { mediaPublicBaseUrl } from '../media/media-dtos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parsePublicPage, parsePublicSearch } from '../public-scope/public-query-params.js';
import { publicClub } from '../public-rankings/public-rankings.query.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PUBLIC_PLAYER_SELECT, toPublicPlayer } from './public-player.serializer.js';
import { PUBLIC_LATEST_SNAPSHOTS, publicPlayerRanks } from './public-player-ranks.query.js';

export interface PublicPlayerParams { q?: unknown; gender?: unknown; club?: unknown; page?: unknown; sort?: unknown }
export const PUBLIC_PROFILE_WHERE = { isActive: true, isPublicProfile: true, mergedIntoId: null } satisfies Prisma.PlayerWhereInput;

const genderFilter = (raw: unknown): 'MALE' | 'FEMALE' | undefined => {
  const value = typeof raw === 'string' ? raw.toUpperCase() : undefined;
  return value === 'MALE' || value === 'FEMALE' ? value : undefined;
};

@Injectable()
export class PublicPlayersQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async list(query: PublicPlayerParams): Promise<PublicPlayerList> {
    const page = parsePublicPage(query.page);
    const pageSize = await this.settings.get(tournamentSettings.publicListPageSize);
    const search = parsePublicSearch(query.q);
    const club = publicClub(query.club);
    const gender = genderFilter(query.gender);
    const filters = [Prisma.sql`p."isActive" = true AND p."isPublicProfile" = true AND p."mergedIntoId" IS NULL`];
    if (search) filters.push(Prisma.sql`strpos(p."normalizedPublicName", ${search.normalized}) > 0`);
    if (club) filters.push(Prisma.sql`p.club = ${club}`);
    if (gender) filters.push(Prisma.sql`p.gender = ${gender}::"Gender"`);
    const where: Prisma.PlayerWhereInput = {
      ...PUBLIC_PROFILE_WHERE,
      ...(search && { normalizedPublicName: { contains: search.normalized } }),
      ...(club && { club }),
      ...(gender && { gender }),
    };
    const rankOrder = query.sort === 'rank' ? Prisma.sql`best.rank ASC NULLS LAST,` : Prisma.empty;
    // Both sorts happen before LIMIT/OFFSET in PostgreSQL; ties use the effective public name and id.
    const [ids, total, clubs] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH latest AS (${PUBLIC_LATEST_SNAPSHOTS})
        SELECT p.id FROM "Player" p
        LEFT JOIN LATERAL (
          SELECT min(r.rank) AS rank FROM "RankingSnapshotRow" r JOIN latest s ON s.id = r."snapshotId" WHERE r."playerId" = p.id
        ) best ON true
        WHERE ${Prisma.join(filters, ' AND ')}
        ORDER BY ${rankOrder} p."normalizedPublicName" COLLATE "C" ASC, p.id ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
      this.prisma.player.count({ where }),
      this.prisma.player.findMany({ where: { ...PUBLIC_PROFILE_WHERE, club: { not: null } }, distinct: ['club'], orderBy: { club: 'asc' }, select: { club: true } }),
    ]);
    const [players, ranks] = await Promise.all([
      ids.length ? this.prisma.player.findMany({ where: { ...PUBLIC_PROFILE_WHERE, id: { in: ids.map((p) => p.id) } }, select: PUBLIC_PLAYER_SELECT }) : [],
      publicPlayerRanks(this.prisma, ids.map((p) => p.id)),
    ]);
    const byId = new Map(players.map((p) => [p.id, p]));
    return {
      items: ids.flatMap(({ id }) => {
        const player = byId.get(id);
        return player ? [{ ...toPublicPlayer(player, mediaPublicBaseUrl(this.env)), slug: publicPlayerSlug(player.id), gender: player.gender, ranks: ranks.get(id) ?? [] }] : [];
      }),
      page,
      pageSize,
      total,
      clubs: clubs.flatMap((p) => p.club ? [p.club] : []),
    };
  }
}
