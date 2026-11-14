import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule } from './support/group-test-helpers.js';
import { MatchApi, stepUp, straightWin, winWithOneGameLost } from './support/match-flow-helpers.js';
import { openRevalidateQueue, removeOwn, tagsSince } from './support/revalidate-queue-probe.js';

type Plan = (slotA: number, slotB: number) => { winner: number; lostOneGame?: boolean };

describe('group matches after the groups were placed into the knockout (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let adminCookie: string;
  let fx: Fixtures;
  let api: MatchApi;
  let ruleId: string;
  let groupDrawId: string;
  let mainId: string;
  let groupA: { id: string; code: string; members: { entryId: string; slot: number }[] };
  let groupB: typeof groupA;
  let slotOf: Map<string, number>;

  const sub = () => fx.subEvents.XD!;
  const dbMatch = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const positions = () => kit.prisma.bracketPosition.findMany({ where: { drawId: mainId }, orderBy: { position: 'asc' } });
  const place = async () => api.post(`/draws/${mainId}/place-group-qualifiers`, { expectedVersion: (await kit.prisma.draw.findUniqueOrThrow({ where: { id: mainId } })).version });
  const amend = async (id: string, body: object) => api.post(`/matches/${id}/amend-scores`, { expectedVersion: (await dbMatch(id)).version, reason: 'typo in game scores', ...body });
  const reopen = async (id: string) => api.post(`/matches/${id}/reopen`, { expectedVersion: (await dbMatch(id)).version, reason: 'wrong result entered' });
  const matchBetween = async (slotA: number, slotB: number, group = groupA) => {
    const slots = new Map(group.members.map((m) => [m.entryId, m.slot]));
    const rows = await kit.prisma.match.findMany({ where: { groupId: group.id } });
    return rows.find((m) => new Set([slots.get(m.side1EntryId!), slots.get(m.side2EntryId!)]).has(slotA) && new Set([slots.get(m.side1EntryId!), slots.get(m.side2EntryId!)]).has(slotB))!;
  };

  const startedAt = Date.now();
  const queue = openRevalidateQueue();

  /** Placing group qualifiers into the published MAIN draw refreshes the draw, the matches they now sit in and their player pages. */
  async function expectPlacementTags(since: number) {
    const queued = await tagsSince(queue, since, fx.tag);
    const slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId }, select: { slug: true } })).slug;
    const qualified = (await kit.prisma.groupStanding.findMany({ where: { groupId: { in: [groupA.id, groupB.id] }, qualified: true }, select: { entryId: true } })).map((r) => r.entryId);
    const matches = await kit.prisma.match.findMany({ where: { drawId: mainId, OR: [{ side1EntryId: { in: qualified } }, { side2EntryId: { in: qualified } }] }, select: { matchNo: true } });
    expect(matches.length).toBeGreaterThan(0);
    expect(queued.has(`draw-${slug}-XD`)).toBe(true);
    for (const m of matches) expect(queued.has(`match-${slug}-${m.matchNo}`), `match ${m.matchNo}`).toBe(true);
    const entry = await kit.prisma.entry.findUniqueOrThrow({ where: { id: qualified[0]! }, select: { competitor: { select: { player: { select: { slug: true } }, pair: { select: { playerA: { select: { slug: true } } } } } } } });
    expect(queued.has(`player-${entry.competitor.player?.slug ?? entry.competitor.pair!.playerA.slug}`)).toBe(true);
  }

  async function playGroup(groupId: string, plan: Plan) {
    const members = await kit.prisma.groupMember.findMany({ where: { groupId } });
    const slots = new Map(members.map((m) => [m.entryId, m.slot]));
    for (const m of await kit.prisma.match.findMany({ where: { groupId, status: 'SCHEDULED' } })) {
      const { winner, lostOneGame } = plan(slots.get(m.side1EntryId!)!, slots.get(m.side2EntryId!)!);
      const side = winner === slots.get(m.side1EntryId!) ? 1 : 2;
      const format = (await api.detail(m.id)).format;
      const games = lostOneGame ? winWithOneGameLost(format, side) : straightWin(format, side);
      const res = await api.post(`/matches/${m.id}/confirm`, { expectedVersion: m.version, resultType: 'NORMAL', games });
      expect(res.status).toBe(200);
    }
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    api = new MatchApi(kit, adminCookie);
    fx = await createEventFixtures(kit, adminCookie, ['XD']);
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    await kit.prisma.subEvent.update({ where: { id: sub() }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId, hasQualifying: false } });
    await new DrawFixtureKit(kit, adminCookie, fx).addEntries(sub(), 0, 8);

    const publish = async (body: object) => {
      const created = await kit.write('post', `${API}/sub-events/${sub()}/draws`, adminCookie, body).expect(201);
      await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
      return created.body.data.id as string;
    };
    groupDrawId = await publish({ kind: 'GROUP', groupCount: 2, advancePerGroup: 2 });
    mainId = await publish({ kind: 'MAIN' });
    const groups = await kit.prisma.group.findMany({ where: { drawId: groupDrawId }, orderBy: { code: 'asc' }, include: { members: true } });
    groupA = groups[0]!;
    groupB = groups[1]!;
    slotOf = new Map(groupA.members.map((m) => [m.entryId, m.slot]));

    // Slot 1 beats everyone; slots 2, 3, 4 win one match each (2 > 3 > 4 > 2), so their order rests on the game ratio.
    const cycle: Record<string, ReturnType<Plan>> = {
      '2-3': { winner: 2 },
      '3-4': { winner: 3, lostOneGame: true },
      '2-4': { winner: 4 },
    };
    const groupPlan: Plan = (a, b) => (a === 1 || b === 1 ? { winner: 1 } : cycle[`${Math.min(a, b)}-${Math.max(a, b)}`]!);
    await playGroup(groupA.id, groupPlan);
    await playGroup(groupB.id, groupPlan);
    const since = Date.now();
    const placed = await place();
    expect(placed.status).toBe(200);
    expect(placed.body.warnings).toBeUndefined();
    await expectPlacementTags(since);
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, [sub()].filter(Boolean), fx?.eventId);
    await cleanupFixtures(kit, fx);
    if (ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
    if (fx) await removeOwn(queue, startedAt, fx.tag);
    await queue.close();
    await kit.close();
  }, 60_000);

  it('refuses an amend that reshuffles the ranks of a placed group and rolls everything back', async () => {
    const m = await matchBetween(3, 4);
    const format = (await api.detail(m.id)).format;
    const side = slotOf.get(m.side1EntryId!) === 3 ? 1 : 2;
    const before = await dbMatch(m.id);
    const standingsBefore = await kit.prisma.groupStanding.findMany({ where: { groupId: groupA.id }, orderBy: { entryId: 'asc' } });

    const res = await amend(m.id, { games: straightWin(format, side) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AMEND_CHANGES_PLACED_RANKS');
    expect(await dbMatch(m.id)).toMatchObject({ version: before.version, games2: before.games2, games1: before.games1 });
    expect(await kit.prisma.groupStanding.findMany({ where: { groupId: groupA.id }, orderBy: { entryId: 'asc' } })).toEqual(standingsBefore);
  });

  it('amends a group match without moving any rank: the standings are recomputed', async () => {
    const m = await matchBetween(1, 4);
    const entry = (slot: number) => [...slotOf].find(([, s]) => s === slot)![0];
    const before = await kit.prisma.groupStanding.findUniqueOrThrow({ where: { groupId_entryId: { groupId: groupA.id, entryId: entry(1) } } });
    const format = (await api.detail(m.id)).format;
    const side = slotOf.get(m.side1EntryId!) === 1 ? 1 : 2;

    const res = await amend(m.id, { games: winWithOneGameLost(format, side) });
    expect(res.status).toBe(200);
    const after = await kit.prisma.groupStanding.findUniqueOrThrow({ where: { groupId_entryId: { groupId: groupA.id, entryId: entry(1) } } });
    expect(after.gamesAgainst).toBe(before.gamesAgainst + 1);
    expect(after.rank).toBe(before.rank);
  });

  it('reopening a group match previews and frees the group places in the knockout, then they are placed again', async () => {
    const m = await matchBetween(1, 3);
    const qualified = await kit.prisma.groupStanding.findMany({ where: { groupId: groupA.id, rank: { in: [1, 2] } } });
    const seated = (await positions()).filter((p) => qualified.some((q) => q.entryId === p.entryId));
    expect(seated).toHaveLength(2);

    const view = (await kit.get(`${API}/matches/${m.id}/reopen-preview`, adminCookie).expect(200)).body.data;
    expect(view.blocking).toEqual([]);
    expect(view.affected.map((c: { entryId: string; via: string }) => [c.entryId, c.via]).sort()).toEqual(qualified.map((q) => [q.entryId, 'SEAT']).sort());

    await stepUp(kit, adminCookie, admin.password);
    expect((await reopen(m.id)).status).toBe(200);
    expect(await dbMatch(m.id)).toMatchObject({ status: 'LIVE', winnerSide: null });

    const freed = (await positions()).filter((p) => seated.some((s) => s.id === p.id));
    expect(freed.map((p) => p.source)).toEqual(['GROUP_PLACE', 'GROUP_PLACE']);
    expect(freed.map((p) => p.sourceRef).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual([
      { type: 'GROUP_PLACE', group: groupA.code, place: 1 },
      { type: 'GROUP_PLACE', group: groupA.code, place: 2 },
    ]);
    // Group B is still seated in the knockout, so its table stays frozen although group A's seats were freed.
    const inB = await matchBetween(3, 4, groupB);
    const formatB = (await api.detail(inB.id)).format;
    const slotsB = new Map(groupB.members.map((x) => [x.entryId, x.slot]));
    const guarded = await amend(inB.id, { games: straightWin(formatB, slotsB.get(inB.side1EntryId!) === 3 ? 1 : 2) });
    expect(guarded.status).toBe(409);
    expect(guarded.body.error.code).toBe('AMEND_CHANGES_PLACED_RANKS');
    const tiebreak = await kit.write('patch', `${API}/groups/${groupB.id}/manual-ranks`, adminCookie, { ranks: {}, reason: 'try anyway', expectedVersion: 0 });
    expect(tiebreak.body.error.code).toBe('GROUPS_ALREADY_PLACED');

    const incomplete = await place();
    expect(incomplete.status).toBe(409);
    expect(incomplete.body.error).toMatchObject({ code: 'GROUPS_NOT_FINISHED', pendingGroups: [groupA.code] });

    expect((await api.win(m.id, slotOf.get(m.side1EntryId!) === 1 ? 1 : 2)).status).toBe(200);
    expect((await place()).status).toBe(200);
    expect((await positions()).some((p) => p.source === 'GROUP_PLACE')).toBe(false);
  });
});
