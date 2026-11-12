import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

interface NamedPlayer {
  id: string;
  fullName: string;
}

/** Singles: the name; pairs: "A / B" in the stored (id) order so it never flips. */
export function competitorDisplayName(players: NamedPlayer[]): string {
  return [...players]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((player) => player.fullName)
    .join(' / ');
}

/** Pair ids are stored sorted so (A, B) and (B, A) are the same pair. */
export function orderPairIds(first: string, second: string): [string, string] {
  return first < second ? [first, second] : [second, first];
}

/**
 * The competitor for one player (singles) or two players (pair), creating Pair/Competitor when
 * missing. Run inside a transaction; concurrent creators are resolved by the unique keys.
 */
export async function findOrCreateCompetitor(tx: Tx, playerIds: string[]) {
  const players = await tx.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, fullName: true } });
  if (players.length !== new Set(playerIds).size) throw new Error('Unknown player id');

  if (playerIds.length === 1) {
    const playerId = playerIds[0]!;
    return tx.competitor.upsert({
      where: { playerId },
      create: { type: 'PLAYER', playerId, displayName: competitorDisplayName(players) },
      update: {},
    });
  }

  const [playerAId, playerBId] = orderPairIds(playerIds[0]!, playerIds[1]!);
  const pair = await tx.pair.upsert({
    where: { playerAId_playerBId: { playerAId, playerBId } },
    create: { playerAId, playerBId },
    update: {},
  });
  return tx.competitor.upsert({
    where: { pairId: pair.id },
    create: { type: 'PAIR', pairId: pair.id, displayName: competitorDisplayName(players) },
    update: {},
  });
}

/** Recomputes displayName of the player's own competitor and of every pair they belong to. */
export async function refreshCompetitorNames(tx: Tx, playerId: string): Promise<void> {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { id: true, fullName: true } });
  await tx.competitor.updateMany({ where: { playerId }, data: { displayName: player.fullName } });
  const pairs = await tx.pair.findMany({
    where: { OR: [{ playerAId: playerId }, { playerBId: playerId }] },
    select: { id: true, playerA: { select: { id: true, fullName: true } }, playerB: { select: { id: true, fullName: true } } },
  });
  for (const pair of pairs) {
    await tx.competitor.updateMany({ where: { pairId: pair.id }, data: { displayName: competitorDisplayName([pair.playerA, pair.playerB]) } });
  }
}

/** Player ids of the competitor (1 for singles, 2 for a pair). */
export function competitorPlayerIds(competitor: { playerId: string | null; pair?: { playerAId: string; playerBId: string } | null }): string[] {
  if (competitor.playerId) return [competitor.playerId];
  return competitor.pair ? [competitor.pair.playerAId, competitor.pair.playerBId] : [];
}
