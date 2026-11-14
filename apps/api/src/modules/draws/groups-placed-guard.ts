import type { Prisma } from '@kamito/db';
import { conflict } from './draw-errors.js';

/**
 * A group's table is frozen into the knockout while any of its members holds a MAIN bracket slot.
 * Per group on purpose: reopening one group frees only its own seats and must not unprotect the others.
 */
export async function isGroupPlaced(tx: Prisma.TransactionClient, subEventId: string, groupId: string): Promise<boolean> {
  const main = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId, kind: 'MAIN' } }, select: { id: true } });
  if (!main) return false;
  return (await tx.bracketPosition.count({ where: { drawId: main.id, entry: { groupMemberships: { some: { groupId } } } } })) > 0;
}

export async function assertGroupNotPlaced(tx: Prisma.TransactionClient, subEventId: string, groupId: string, message: string): Promise<void> {
  if (await isGroupPlaced(tx, subEventId, groupId)) throw conflict('GROUPS_ALREADY_PLACED', message);
}
