import { lockDraw, lockSubEvent, type Draw, type Prisma } from '@kamito/db';
import { drawNotFound, versionConflict } from './draw-errors.js';

type Tx = Prisma.TransactionClient;

/**
 * Opens every draw write: SubEvent lock (serialises with entry writes), then Draw lock, then
 * optimistic version check against the freshly locked row.
 */
export async function loadDrawLocked(tx: Tx, drawId: string, expectedVersion?: number): Promise<Draw> {
  const probe = await tx.draw.findUnique({ where: { id: drawId }, select: { subEventId: true } });
  if (!probe) throw drawNotFound();
  await lockSubEvent(tx, probe.subEventId);
  await lockDraw(tx, drawId);
  const draw = await tx.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw drawNotFound();
  if (expectedVersion !== undefined && draw.version !== expectedVersion) throw versionConflict(draw.version);
  return draw;
}

export function bumpVersion(tx: Tx, drawId: string, data: Prisma.DrawUpdateInput = {}) {
  return tx.draw.update({ where: { id: drawId }, data: { ...data, version: { increment: 1 } } });
}
