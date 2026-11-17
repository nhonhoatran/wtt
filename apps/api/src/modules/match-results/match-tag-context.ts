import type { Prisma } from '@kamito/db';
import { publicPlayerSlug } from '@kamito/shared';
import type { MatchDetailRow } from '../matches/match-result-view.js';
import type { MatchTagContext } from '../revalidation/cache-tags.js';

type Tx = Prisma.TransactionClient;

const SLUG = { select: { id: true, slug: true } } as const;

/**
 * Reads, inside the write transaction, the public identifiers the cache tags of a match are built from.
 * `extraEntryIds` are entries of other matches the write touched (advanced, removed or reset).
 */
export async function loadMatchTagContext(
  tx: Tx,
  match: MatchDetailRow,
  advancedMatchNos: number[] = [],
  extraEntryIds: string[] = [],
): Promise<MatchTagContext> {
  const event = await tx.event.findUniqueOrThrow({ where: { id: match.eventId }, select: { slug: true } });
  const entryIds = [...new Set([match.side1EntryId, match.side2EntryId, ...extraEntryIds].filter((id): id is string => Boolean(id)))];
  const entries = await tx.entry.findMany({
    where: { id: { in: entryIds } },
    select: { competitor: { select: { player: SLUG, pair: { select: { playerA: SLUG, playerB: SLUG } } } } },
  });
  const players = entries.flatMap(({ competitor: c }) => (c.player ? [c.player] : c.pair ? [c.pair.playerA, c.pair.playerB] : []));
  const playerSlugs = players.flatMap((player) => [player.slug, publicPlayerSlug(player.id)]);
  return {
    eventSlug: event.slug,
    subEventCode: match.subEvent.code,
    matchNos: [...new Set([match.matchNo, ...advancedMatchNos])],
    isGroupMatch: match.groupId !== null,
    playerSlugs: [...new Set(playerSlugs)],
  };
}
