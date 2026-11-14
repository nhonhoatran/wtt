import type { AuthTestKit } from './auth-test-kit.js';
import { DrawFixtureKit } from './draw-fixtures.js';
import { cleanupDraws } from './draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './entries-fixtures.js';

export const SESSION_DATE = '2099-05-01';

export interface SchedulingFixture {
  fx: Fixtures;
  venueId: string;
  tableIds: string[];
  /** Round-one matches of the 8-player men's singles draw; the match of `sharedPlayer` comes first. */
  singles: { id: string; matchNo: number }[];
  /** Round-one matches of the 4-pair men's doubles draw; the match of the pair containing `sharedPlayer` comes first. */
  doubles: { id: string; matchNo: number }[];
  /** Plays in the first singles match and, through a pair, in the first doubles match. */
  sharedPlayer: { id: string; fullName: string };
  cleanup: () => Promise<void>;
}

/** Event with a venue of three tables and two published draws whose players overlap (a singles player also in a pair). */
export async function createSchedulingFixture(kit: AuthTestKit, adminCookie: string): Promise<SchedulingFixture> {
  const fx = await createEventFixtures(kit, adminCookie, ['MS', 'MD']);
  const venue = await kit.prisma.venue.create({
    data: { name: `Venue ${fx.tag}`, tables: { create: ['T1', 'T2', 'T3'].map((code, order) => ({ code, order })) } },
    include: { tables: { orderBy: { order: 'asc' } } },
  });
  await kit.prisma.event.update({ where: { id: fx.eventId }, data: { venueId: venue.id } });

  const players = new DrawFixtureKit(kit, adminCookie, fx);
  await players.addEntries(fx.subEvents.MS!, 0, 8);
  await players.ensurePlayers(15);
  const [p0, ...rest] = players.players;
  const shared = p0!;
  await kit.prisma.player.update({ where: { id: shared.id }, data: { club: 'CLB Alpha' } });
  const mdPlayers = [shared, ...rest.slice(7, 14)];
  for (let i = 0; i < 4; i++) {
    const [playerAId, playerBId] = [mdPlayers[2 * i]!.id, mdPlayers[2 * i + 1]!.id].sort() as [string, string];
    const pair = await kit.prisma.pair.create({ data: { playerAId, playerBId } });
    const competitor = await kit.prisma.competitor.create({ data: { type: 'PAIR', pairId: pair.id, displayName: `Pair ${i} ${fx.tag}` } });
    await kit.prisma.entry.create({ data: { subEventId: fx.subEvents.MD!, competitorId: competitor.id, stage: 'MAIN' } });
  }

  const roundOne = async (code: string) => {
    const created = await kit.write('post', `${API}/sub-events/${fx.subEvents[code]}/draws`, adminCookie, { kind: 'MAIN' }).expect(201);
    await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
    const rows = await kit.prisma.match.findMany({
      where: { drawId: created.body.data.id, round: { number: 1 } },
      orderBy: { orderInRound: 'asc' },
      select: { id: true, matchNo: true, side1Entry: { select: { competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } } }, side2Entry: { select: { competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } } } },
    });
    const hasShared = (m: (typeof rows)[number]) =>
      [m.side1Entry, m.side2Entry].some((e) => e?.competitor.playerId === shared.id || e?.competitor.pair?.playerAId === shared.id || e?.competitor.pair?.playerBId === shared.id);
    return [...rows.filter(hasShared), ...rows.filter((m) => !hasShared(m))].map(({ id, matchNo }) => ({ id, matchNo }));
  };
  const singles = await roundOne('MS');
  const doubles = await roundOne('MD');

  return {
    fx,
    venueId: venue.id,
    tableIds: venue.tables.map((t) => t.id),
    singles,
    doubles,
    sharedPlayer: shared,
    cleanup: async () => {
      const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx.eventId }, select: { id: true } })).map((m) => m.id);
      const sessionIds = (await kit.prisma.eventSession.findMany({ where: { eventId: fx.eventId }, select: { id: true } })).map((s) => s.id);
      await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: [...matchIds, ...sessionIds] } } });
      await cleanupDraws(kit, Object.values(fx.subEvents), fx.eventId);
      await cleanupFixtures(kit, fx);
      await kit.prisma.venue.deleteMany({ where: { id: venue.id } });
    },
  };
}
