import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Serialises entry writes of one sub-event (capacity, one-player-one-entry checks). */
export async function lockSubEvent(tx: Tx, subEventId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "SubEvent" WHERE "id" = ${subEventId} FOR UPDATE`;
}

/** Transaction-scoped advisory lock keyed by text (import commit per event, player merge per pair). */
export async function advisoryLock(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/**
 * Players among `playerIds` that already have a CONFIRMED entry in the sub-event (alone or in a
 * pair), other than `excludeEntryId`.
 */
export async function playersAlreadyEntered(
  tx: Tx,
  subEventId: string,
  playerIds: string[],
  excludeEntryId?: string,
): Promise<string[]> {
  const entries = await tx.entry.findMany({
    where: {
      subEventId,
      status: 'CONFIRMED',
      ...(excludeEntryId && { id: { not: excludeEntryId } }),
      competitor: {
        OR: [
          { playerId: { in: playerIds } },
          { pair: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] } },
        ],
      },
    },
    select: { competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } },
  });
  const wanted = new Set(playerIds);
  const found = new Set<string>();
  for (const { competitor } of entries) {
    for (const id of [competitor.playerId, competitor.pair?.playerAId, competitor.pair?.playerBId]) {
      if (id && wanted.has(id)) found.add(id);
    }
  }
  return [...found];
}

export async function confirmedEntryCount(tx: Tx, subEventId: string, excludeEntryId?: string): Promise<number> {
  return tx.entry.count({ where: { subEventId, status: 'CONFIRMED', ...(excludeEntryId && { id: { not: excludeEntryId } }) } });
}

// Phase 06 hook: draws do not exist yet, so nothing is locked. Once Draw lands, return the entry
// ids (resp. sub-event ids) whose draw status is not DRAFT, and the ids whose draw is DRAFT.
export async function entriesInLockedDraw(_tx: Tx, _entryIds: string[]): Promise<{ locked: string[]; draft: string[] }> {
  return { locked: [], draft: [] };
}

export async function subEventsWithLockedDraw(_tx: Tx, _subEventIds: string[]): Promise<string[]> {
  return [];
}
