import { Prisma } from '@kamito/db';
import type { PublicPlayerRank } from '@kamito/shared';
import type { PrismaService } from '../prisma/prisma.service.js';

/** The same latest-snapshot selection is used by names/rank sorting and by profile ranks. */
export const PUBLIC_LATEST_SNAPSHOTS = Prisma.sql`
  SELECT DISTINCT ON (s."rankingListId") s.id, s."rankingListId", s."asOfDate"
  FROM "RankingSnapshot" s
  JOIN "RankingList" l ON l.id = s."rankingListId" AND l."isActive" = true
  WHERE s.status = 'PUBLISHED'
  ORDER BY s."rankingListId", s."asOfDate" DESC, s."publishedAt" DESC, s.id DESC
`;

/** Reads all active current ranks for the current page in one SQL statement, never one request per player. */
export async function publicPlayerRanks(prisma: PrismaService, playerIds: string[]): Promise<Map<string, PublicPlayerRank[]>> {
  if (!playerIds.length) return new Map();
  const rows = await prisma.$queryRaw<{ playerId: string; value: PublicPlayerRank }[]>(Prisma.sql`
    WITH latest AS (${PUBLIC_LATEST_SNAPSHOTS})
    SELECT r."playerId", jsonb_build_object(
      'list', jsonb_build_object(
        'code', l.code, 'name', l.name, 'nameEn', l."nameEn", 'competitorKind', l."competitorKind", 'genderRule', l."genderRule",
        'category', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('code', c.code, 'name', c.name, 'nameEn', c."nameEn") END
      ),
      'rank', r.rank, 'points', r.points, 'movement', r.movement, 'asOfDate', s."asOfDate"::text
    ) AS value
    FROM "RankingSnapshotRow" r
    JOIN latest s ON s.id = r."snapshotId"
    JOIN "RankingList" l ON l.id = s."rankingListId"
    LEFT JOIN "Category" c ON c.id = l."categoryId"
    WHERE r."playerId" IN (${Prisma.join(playerIds)})
    ORDER BY l."order" ASC, l.code ASC
  `);
  const result = new Map<string, PublicPlayerRank[]>();
  for (const row of rows) result.set(row.playerId, [...(result.get(row.playerId) ?? []), row.value]);
  return result;
}
