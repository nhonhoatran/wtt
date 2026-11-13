import type { Prisma } from '@kamito/db';
import type { MatchDetailRow } from '../matches/match-result-view.js';
import type { MatchTagContext } from '../revalidation/cache-tags.js';

type Tx = Prisma.TransactionClient;

const SLUG = { select: { slug: true } } as const;

/** Reads, inside the write transaction, the public identifiers the cache tags of a match are built from. */
export async function loadMatchTagContext(tx: Tx, match: MatchDetailRow, advancedMatchNos: number[] = []): Promise<MatchTagContext> {
  const event = await tx.event.findUniqueOrThrow({ where: { id: match.eventId }, select: { slug: true } });
  const entryIds = [match.side1EntryId, match.side2EntryId].filter((id): id is string => Boolean(id));
  const entries = await tx.entry.findMany({
    where: { id: { in: entryIds } },
    select: { competitor: { select: { player: SLUG, pair: { select: { playerA: SLUG, playerB: SLUG } } } } },
  });
  const playerSlugs = entries.flatMap(({ competitor: c }) => (c.player ? [c.player.slug] : c.pair ? [c.pair.playerA.slug, c.pair.playerB.slug] : []));
  return {
    eventSlug: event.slug,
    subEventCode: match.subEvent.code,
    matchNos: [match.matchNo, ...advancedMatchNos],
    isGroupMatch: match.groupId !== null,
    playerSlugs,
  };
}
