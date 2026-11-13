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

/**
 * Splits entries that occupy a bracket position or group slot by draw status: `locked` when any
 * such draw is not DRAFT, `draft` when all of them are DRAFT. Entries in no draw appear in neither.
 */
export async function entriesInLockedDraw(tx: Tx, entryIds: string[]): Promise<{ locked: string[]; draft: string[] }> {
  if (!entryIds.length) return { locked: [], draft: [] };
  const [positions, members] = await Promise.all([
    tx.bracketPosition.findMany({ where: { entryId: { in: entryIds } }, select: { entryId: true, draw: { select: { status: true } } } }),
    tx.groupMember.findMany({ where: { entryId: { in: entryIds } }, select: { entryId: true, group: { select: { draw: { select: { status: true } } } } } }),
  ]);
  const locked = new Set<string>();
  const draft = new Set<string>();
  const mark = (entryId: string | null, status: 'DRAFT' | 'PUBLISHED') => {
    if (entryId) (status === 'DRAFT' ? draft : locked).add(entryId);
  };
  for (const row of positions) mark(row.entryId, row.draw.status);
  for (const row of members) mark(row.entryId, row.group.draw.status);
  for (const id of locked) draft.delete(id);
  return { locked: [...locked], draft: [...draft] };
}

/** Sub-events (among `subEventIds`) with at least one draw that is not DRAFT. */
export async function subEventsWithLockedDraw(tx: Tx, subEventIds: string[]): Promise<string[]> {
  if (!subEventIds.length) return [];
  const rows = await tx.draw.findMany({
    where: { subEventId: { in: subEventIds }, status: { not: 'DRAFT' } },
    select: { subEventId: true },
    distinct: ['subEventId'],
  });
  return rows.map((row) => row.subEventId);
}
