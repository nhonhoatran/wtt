import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Take before reading or writing anything that belongs to a draw; lock order is SubEvent, Draw, Group. */
export async function lockDraw(tx: Tx, drawId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Draw" WHERE "id" = ${drawId} FOR UPDATE`;
}

/** Group rows are locked in id order so two writers never wait on each other in a cycle. */
export async function lockGroups(tx: Tx, drawId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "drawId" = ${drawId} ORDER BY "id" FOR UPDATE`;
}

/** True once a non-BYE match is LIVE or OFFICIAL; derived from data, never stored. */
export async function isStructureLocked(tx: Tx, drawId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ locked: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "Match"
      WHERE "drawId" = ${drawId}
        AND "status" IN ('LIVE'::"MatchStatus", 'OFFICIAL'::"MatchStatus")
        AND "resultType" IS DISTINCT FROM 'BYE'::"ResultType"
    ) AS "locked"`;
  return rows[0]?.locked === true;
}

/**
 * Reserves `count` consecutive match numbers for the event and returns the first one.
 * The upsert takes a row lock held until the transaction ends, so blocks never interleave.
 */
export async function allocateMatchNumbers(tx: Tx, eventId: string, count: number): Promise<number> {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be a positive integer');
  const rows = await tx.$queryRaw<{ lastMatchNo: number }[]>`
    INSERT INTO "EventMatchCounter" ("eventId", "lastMatchNo")
    VALUES (${eventId}, ${count})
    ON CONFLICT ("eventId")
    DO UPDATE SET "lastMatchNo" = "EventMatchCounter"."lastMatchNo" + ${count}
    RETURNING "lastMatchNo"`;
  const last = rows[0]?.lastMatchNo;
  if (last === undefined) throw new Error('Match counter upsert returned no row');
  return last - count + 1;
}
