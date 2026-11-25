import type { Prisma } from '@kamito/db';
import { publicPlayerSlug, type EntryChangeTagContext } from '@kamito/shared';
import { publicScope } from '../public-scope/public-scope.js';
import type { PlayerTagContext, VenueTableTagContext } from './cache-tags.js';

type Db = Pick<Prisma.TransactionClient, 'subEvent' | 'entry' | 'player' | 'match'>;

/** Refresh both legacy links and the opaque public profile identifier. */
const profileSlugs = (player: { id: string; slug: string }) => [player.slug, publicPlayerSlug(player.id)];

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
  const players = await db.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, slug: true } });
  return { eventSlug: subEvent.event.slug, subEventCodes: [subEvent.code], playerSlugs: players.flatMap(profileSlugs) };
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
    db.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, slug: true } }),
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
    playerSlugs: players.flatMap(profileSlugs),
    events: [...byEvent].map(([eventSlug, { codes, matchNos }]) => ({ eventSlug, subEventCodes: [...codes], matchNos: [...matchNos] })),
  };
}

export async function loadEventPlayerSlugs(db: Pick<Prisma.TransactionClient, 'entry'>, eventId: string): Promise<string[]> {
  const slug = { select: { id: true, slug: true } } as const;
  const rows = await db.entry.findMany({
    where: { subEvent: { eventId } },
    select: { competitor: { select: { player: slug, pair: { select: { playerA: slug, playerB: slug } } } } },
  });
  return [...new Set(rows.flatMap(({ competitor: c }) => (c.player ? profileSlugs(c.player) : c.pair ? [...profileSlugs(c.pair.playerA), ...profileSlugs(c.pair.playerB)] : [])))];
}

const sideSelect = {
  select: { competitor: { select: { player: { select: { id: true, slug: true } }, pair: { select: { playerA: { select: { id: true, slug: true } }, playerB: { select: { id: true, slug: true } } } } } } },
} as const;

type SideRow = { competitor: { player: { id: string; slug: string } | null; pair: { playerA: { id: string; slug: string }; playerB: { id: string; slug: string } } | null } } | null;

const sideSlugs = (side: SideRow): string[] => {
  const c = side?.competitor;
  return c?.player ? profileSlugs(c.player) : c?.pair ? [...profileSlugs(c.pair.playerA), ...profileSlugs(c.pair.playerB)] : [];
};

/** Public matches played on the table (draft events and draws are skipped) with the players of both sides. */
export async function loadVenueTableTagContext(db: Pick<Prisma.TransactionClient, 'match'>, tableId: string): Promise<VenueTableTagContext> {
  const rows = await db.match.findMany({
    where: { tableId, ...publicScope.matchIn({}) },
    select: { matchNo: true, groupId: true, event: { select: { slug: true } }, subEvent: { select: { code: true } }, side1Entry: sideSelect, side2Entry: sideSelect },
  });
  return {
    matches: rows.map((m) => ({
      eventSlug: m.event.slug,
      subEventCode: m.subEvent.code,
      matchNo: m.matchNo,
      isGroupMatch: m.groupId !== null,
      playerSlugs: [...sideSlugs(m.side1Entry), ...sideSlugs(m.side2Entry)],
    })),
  };
}
