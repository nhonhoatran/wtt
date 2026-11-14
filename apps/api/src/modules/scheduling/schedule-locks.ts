import { lockDraw, lockSubEventsInOrder, Prisma } from '@kamito/db';
import { concurrentScheduleRetry } from './scheduling-errors.js';

type Tx = Prisma.TransactionClient;

export const lockSessionsInOrder = async (tx: Tx, sessionIds: string[]): Promise<void> => {
  const ids = [...new Set(sessionIds)].sort();
  if (ids.length) await tx.$queryRaw`SELECT "id" FROM "EventSession" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
};

const subEventsOf = async (tx: Tx, sessionIds: string[], matchIds: string[]): Promise<string[]> => {
  const rows = await tx.match.findMany({
    where: { OR: [{ sessionId: { in: sessionIds } }, { id: { in: matchIds } }] },
    select: { subEventId: true },
  });
  return [...new Set(rows.map((r) => r.subEventId))];
};

/**
 * One global lock order shared with result entry and draw edits: SubEvent (ascending id) -> Draw -> Session -> Match.
 * Result writers always start with their SubEvent lock, so holding every sub-event that has a match in the
 * affected sessions makes the re-timing UPDATEs unable to cycle with a confirm or reopen. Locking the
 * sub-events (rather than only matches by id) is what gives that: confirm updates the next-round match
 * after its own, an order a by-id match lock cannot match.
 */
export async function lockScheduleScope(tx: Tx, scope: { sessionIds: string[]; matchIds?: string[]; drawId?: string }): Promise<void> {
  const matchIds = scope.matchIds ?? [];
  const before = await subEventsOf(tx, scope.sessionIds, matchIds);
  await lockSubEventsInOrder(tx, before);
  if (scope.drawId) await lockDraw(tx, scope.drawId);
  await lockSessionsInOrder(tx, scope.sessionIds);
  const after = await subEventsOf(tx, scope.sessionIds, matchIds);
  if (after.some((id) => !before.includes(id))) throw concurrentScheduleRetry();
}
