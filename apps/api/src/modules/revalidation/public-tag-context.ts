import type { Prisma } from '@kamito/db';
import type { EntryChangeTagContext } from '@kamito/shared';
import type { PlayerTagContext } from './cache-tags.js';

type Db = Pick<Prisma.TransactionClient, 'subEvent' | 'entry' | 'player' | 'match'>;

const entriesOfPlayers = (playerIds: string[]): Prisma.EntryWhereInput => ({
  competitor: { OR: [{ playerId: { in: playerIds } }, { pair: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] } }] },
});

export async function loadSubEventCodes(db: Db, eventId: string): Promise<string[]> {
  const rows = await db.subEvent.findMany({ where: { eventId }, select: { code: true } });
  return rows.map((row) => row.code);
}

export async function loadEventMatchNos(db: Db, eventId: string): Promise<number[]> {
  const rows = await db.match.findMany({ where: { eventId }, select: { matchNo: true } });
  return rows.map((row) => row.matchNo);
}

export async function loadEntryTagContext(db: Db, subEventId: string, playerIds: string[]): Promise<EntryChangeTagContext> {
  const subEvent = await db.subEvent.findUniqueOrThrow({ where: { id: subEventId }, select: { code: true, event: { select: { slug: true } } } });
  const players = await db.player.findMany({ where: { id: { in: playerIds } }, select: { slug: true } });
  return { eventSlug: subEvent.event.slug, subEventCodes: [subEvent.code], playerSlugs: players.map((player) => player.slug) };
}

export async function loadPlayerIdsOfEntries(db: Db, entryIds: string[]): Promise<string[]> {
  const rows = await db.entry.findMany({
    where: { id: { in: entryIds } },
    select: { competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } },
  });
  return [...new Set(rows.flatMap(({ competitor }) => (competitor.playerId ? [competitor.playerId] : competitor.pair ? [competitor.pair.playerAId, competitor.pair.playerBId] : [])))];
}

/** Events that show the players (entered alone or in a pair): their draws, groups, schedule and the matches they play. */
export async function loadPlayerTagContext(db: Db, playerIds: string[]): Promise<PlayerTagContext> {
  const entryFilter = entriesOfPlayers(playerIds);
  const [players, entries, matches] = await Promise.all([
    db.player.findMany({ where: { id: { in: playerIds } }, select: { slug: true } }),
    db.entry.findMany({ where: entryFilter, select: { subEvent: { select: { code: true, event: { select: { slug: true } } } } } }),
    db.match.findMany({
      where: { OR: [{ side1Entry: entryFilter }, { side2Entry: entryFilter }] },
      select: { matchNo: true, event: { select: { slug: true } } },
    }),
  ]);
  const byEvent = new Map<string, { codes: Set<string>; matchNos: Set<number> }>();
  const slot = (slug: string) => byEvent.get(slug) ?? byEvent.set(slug, { codes: new Set(), matchNos: new Set() }).get(slug)!;
  for (const { subEvent } of entries) slot(subEvent.event.slug).codes.add(subEvent.code);
  for (const match of matches) slot(match.event.slug).matchNos.add(match.matchNo);
  return {
    playerSlugs: players.map((player) => player.slug),
    events: [...byEvent].map(([eventSlug, { codes, matchNos }]) => ({ eventSlug, subEventCodes: [...codes], matchNos: [...matchNos] })),
  };
}

export async function loadEventPlayerSlugs(db: Pick<Prisma.TransactionClient, 'entry'>, eventId: string): Promise<string[]> {
  const slug = { select: { slug: true } } as const;
  const rows = await db.entry.findMany({
    where: { subEvent: { eventId } },
    select: { competitor: { select: { player: slug, pair: { select: { playerA: slug, playerB: slug } } } } },
  });
  return [...new Set(rows.flatMap(({ competitor: c }) => (c.player ? [c.player.slug] : c.pair ? [c.pair.playerA.slug, c.pair.playerB.slug] : [])))];
}
