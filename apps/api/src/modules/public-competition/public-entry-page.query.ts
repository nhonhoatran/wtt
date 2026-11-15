import { Prisma } from '@kamito/db';
import { publicScope } from '../public-scope/public-scope.js';

/** Only an already-authorized sub-event id reaches this query. Sort the public labels before LIMIT/OFFSET. */
export function publicEntryPageSql(subEventId: string, stage: 'MAIN' | 'QUALIFYING', skip: number, take: number) {
  return Prisma.sql`
    SELECT e."id"
    FROM "Entry" e
    JOIN "Competitor" c ON c."id" = e."competitorId"
    LEFT JOIN "Player" p ON p."id" = c."playerId"
    LEFT JOIN "Pair" pair ON pair."id" = c."pairId"
    LEFT JOIN "Player" a ON a."id" = pair."playerAId"
    LEFT JOIN "Player" b ON b."id" = pair."playerBId"
    WHERE e."subEventId" = ${subEventId}
      AND e."stage" = ${stage}::"EntryStage"
      AND e."status" = ${publicScope.entry.status}::"EntryStatus"
    ORDER BY e."seed" ASC NULLS LAST,
      (CASE WHEN c."playerId" IS NOT NULL THEN p."normalizedPublicName"
        ELSE a."normalizedPublicName" || ' / ' || b."normalizedPublicName" END) COLLATE "C" ASC,
      e."id" ASC
    LIMIT ${take} OFFSET ${skip}
  `;
}
