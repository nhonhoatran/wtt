import type { Prisma } from '@kamito/db';
import { conflict } from './draw-errors.js';

/** Once the MAIN draw of the sub-event has no GROUP_PLACE slot left, the group tables are frozen into it. */
export async function assertGroupsNotPlaced(tx: Prisma.TransactionClient, subEventId: string, message: string): Promise<void> {
  const main = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId, kind: 'MAIN' } }, select: { id: true } });
  if (main && !(await tx.bracketPosition.count({ where: { drawId: main.id, source: 'GROUP_PLACE' } }))) {
    throw conflict('GROUPS_ALREADY_PLACED', message);
  }
}
