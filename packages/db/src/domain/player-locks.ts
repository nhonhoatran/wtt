import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export interface LockedPlayer {
  id: string;
  code: string;
  fullName: string;
  isActive: boolean;
  mergedIntoId: string | null;
}

const sortedUnique = (ids: string[]): string[] => [...new Set(ids)].sort();

/** Entry writers hold this while a merge waits; lock order is SubEvent rows first, Player rows second. */
export async function lockPlayersForShare(tx: Tx, playerIds: string[]): Promise<LockedPlayer[]> {
  const ids = sortedUnique(playerIds);
  if (!ids.length) return [];
  return tx.$queryRaw<LockedPlayer[]>`
    SELECT "id", "code", "fullName", "isActive", "mergedIntoId" FROM "Player"
    WHERE "id" = ANY(${ids}::text[]) ORDER BY "id" FOR SHARE`;
}

export async function lockPlayersForUpdate(tx: Tx, playerIds: string[]): Promise<LockedPlayer[]> {
  const ids = sortedUnique(playerIds);
  if (!ids.length) return [];
  return tx.$queryRaw<LockedPlayer[]>`
    SELECT "id", "code", "fullName", "isActive", "mergedIntoId" FROM "Player"
    WHERE "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE`;
}

/** Sub-events must be locked in ascending id order to stay deadlock-free with merges. */
export async function lockSubEventsInOrder(tx: Tx, subEventIds: string[]): Promise<void> {
  for (const id of sortedUnique(subEventIds)) {
    await tx.$queryRaw`SELECT "id" FROM "SubEvent" WHERE "id" = ${id} FOR UPDATE`;
  }
}
