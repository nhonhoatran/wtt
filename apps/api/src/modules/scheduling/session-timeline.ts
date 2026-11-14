import { Prisma } from '@kamito/db';
import { DURATION_SELECT, matchDurationMinutes } from './match-duration.js';

type Tx = Prisma.TransactionClient;

const MINUTE_MS = 60_000;

/**
 * Derives `scheduledAt` for the matches of a session: each table is a queue from the session start, every
 * match lasting its format's estimated minutes (zero for walkovers and BYEs). LIVE and OFFICIAL matches keep
 * their real time but still take their place in the sequence. One set-based UPDATE writes the changes.
 * Returns the numbers of matches whose time changed. Callers hold the session lock.
 */
export async function recomputeSessionTimes(tx: Tx, sessionId: string): Promise<number[]> {
  const session = await tx.eventSession.findUnique({ where: { id: sessionId }, select: { startTime: true } });
  if (!session) return [];
  const matches = await tx.match.findMany({
    where: { sessionId, isVoided: false },
    orderBy: [{ tableId: 'asc' }, { orderInSession: 'asc' }, { id: 'asc' }],
    select: { id: true, matchNo: true, tableId: true, status: true, resultType: true, scheduledAt: true, ...DURATION_SELECT },
  });
  const changes: { id: string; at: Date }[] = [];
  let cursor = session.startTime.getTime();
  let currentTable: string | null | undefined;
  for (const m of matches) {
    if (m.tableId !== currentTable) {
      currentTable = m.tableId;
      cursor = session.startTime.getTime();
    }
    const duration = (m.resultType === 'WALKOVER' || m.resultType === 'BYE' ? 0 : matchDurationMinutes(m)) * MINUTE_MS;
    if (m.status === 'SCHEDULED') {
      if (m.scheduledAt?.getTime() !== cursor) changes.push({ id: m.id, at: new Date(cursor) });
      cursor += duration;
    } else {
      cursor = Math.max(cursor, (m.scheduledAt?.getTime() ?? cursor) + duration);
    }
  }
  if (changes.length === 0) return [];
  const values = Prisma.join(changes.map((c) => Prisma.sql`(${c.id}::text, ${c.at.toISOString()}::timestamptz)`));
  const updated = await tx.$queryRaw<{ matchNo: number }[]>`
    UPDATE "Match" AS m SET "scheduledAt" = (v.at AT TIME ZONE 'UTC')
    FROM (VALUES ${values}) AS v(id, at)
    WHERE m."id" = v.id
    RETURNING m."matchNo"`;
  return updated.map((r) => r.matchNo);
}
