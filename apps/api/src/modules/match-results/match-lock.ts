import type { Prisma } from '@kamito/db';
import { notPublished } from '../draws/draw-errors.js';
import { loadDrawLocked } from '../draws/draw-lock.js';
import type { GroupStandingsService } from '../groups/group-standings.service.js';
import { MATCH_DETAIL_INCLUDE, type MatchDetailRow } from '../matches/match-result-view.js';
import { matchNotFound, matchVersionConflict } from './match-result-errors.js';

type Tx = Prisma.TransactionClient;

/**
 * Opens every match write in the fixed lock order SubEvent, Draw, Group (group matches), Match,
 * then checks the optimistic version against the locked row.
 */
export async function loadMatchLocked(tx: Tx, standings: GroupStandingsService, matchId: string, expectedVersion: number): Promise<MatchDetailRow> {
  const probe = await tx.match.findUnique({ where: { id: matchId }, select: { drawId: true, groupId: true } });
  if (!probe) throw matchNotFound();
  const draw = probe.groupId ? (await standings.lockForWrite(tx, probe.groupId)).draw : await loadDrawLocked(tx, probe.drawId);
  if (draw.status !== 'PUBLISHED') throw notPublished();
  await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
  const match = await tx.match.findUnique({ where: { id: matchId }, include: MATCH_DETAIL_INCLUDE });
  if (!match) throw matchNotFound();
  if (match.version !== expectedVersion) throw matchVersionConflict(match.version);
  return match;
}
