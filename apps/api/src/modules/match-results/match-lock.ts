import { lockGroups, type Prisma } from '@kamito/db';
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

const DRAW_LOCK_ORDER = ['QUALIFYING', 'GROUP', 'MAIN'] as const;

/**
 * Reopening can touch the other draws of the sub-event (qualifier slot, group place), so every draw is
 * locked in the fixed order QUALIFYING, GROUP, MAIN before the match row; the root draw must be published.
 */
export async function loadMatchLockedAcrossDraws(tx: Tx, matchId: string, expectedVersion?: number): Promise<MatchDetailRow> {
  const probe = await tx.match.findUnique({ where: { id: matchId }, select: { subEventId: true, drawId: true } });
  if (!probe) throw matchNotFound();
  const draws = await tx.draw.findMany({ where: { subEventId: probe.subEventId }, select: { id: true, kind: true } });
  draws.sort((a, b) => DRAW_LOCK_ORDER.indexOf(a.kind) - DRAW_LOCK_ORDER.indexOf(b.kind));
  for (const { id, kind } of draws) {
    const draw = await loadDrawLocked(tx, id);
    if (id === probe.drawId && draw.status !== 'PUBLISHED') throw notPublished();
    if (kind === 'GROUP') await lockGroups(tx, id);
  }
  await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${matchId} FOR UPDATE`;
  const match = await tx.match.findUnique({ where: { id: matchId }, include: MATCH_DETAIL_INCLUDE });
  if (!match) throw matchNotFound();
  if (expectedVersion !== undefined && match.version !== expectedVersion) throw matchVersionConflict(match.version);
  return match;
}
