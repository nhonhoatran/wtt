import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule } from './support/group-test-helpers.js';

describe('swap group members of a DRAFT group draw (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let drawId: string;
  let version = 0;
  let ruleId: string;
  let foreignEntry: string;

  const sub = (code: string) => fx.subEvents[code]!;
  const swap = (body: object, cookie = adminCookie) => kit.write('post', `${API}/draws/${drawId}/swap-group-members`, cookie, body);
  const groupsOf = () => kit.prisma.group.findMany({ where: { drawId }, orderBy: { order: 'asc' }, include: { members: { orderBy: { slot: 'asc' } } } });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie, ['MD', 'WS']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    await kit.prisma.subEvent.update({ where: { id: sub('MD') }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId } });
    await players.addEntries(sub('MD'), 0, 8);
    foreignEntry = (await players.addEntries(sub('WS'), 8, 1))[0]!;
    const created = await kit.write('post', `${API}/sub-events/${sub('MD')}/draws`, adminCookie, { kind: 'GROUP', groupCount: 2, advancePerGroup: 2 }).expect(201);
    drawId = created.body.data.id as string;
    version = created.body.data.version as number;
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
      await cleanupFixtures(kit, fx);
      await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
      await kit.close();
    }
  }, 60_000);

  it('swaps members across groups: slots, standings and generated matches follow the entries', async () => {
    const [ga, gb] = await groupsOf();
    const a = ga!.members[0]!;
    const b = gb!.members[2]!;
    const matchesBefore = await kit.prisma.match.count({ where: { drawId } });

    const res = await swap({ entryA: a.entryId, entryB: b.entryId, expectedVersion: version }).expect(200);
    expect(res.body.data.version).toBe(version + 1);
    version += 1;

    const [na, nb] = await groupsOf();
    expect(na!.members.find((m) => m.entryId === b.entryId)).toMatchObject({ slot: a.slot });
    expect(nb!.members.find((m) => m.entryId === a.entryId)).toMatchObject({ slot: b.slot });
    expect(na!.members).toHaveLength(4);
    expect(nb!.members).toHaveLength(4);
    for (const g of [na!, nb!]) {
      const ids = new Set(g.members.map((m) => m.entryId));
      const standings = await kit.prisma.groupStanding.findMany({ where: { groupId: g.id } });
      expect(new Set(standings.map((s) => s.entryId))).toEqual(ids);
      const matches = await kit.prisma.match.findMany({ where: { groupId: g.id } });
      expect(matches).toHaveLength(6);
      for (const m of matches) {
        expect(ids.has(m.side1EntryId!) && ids.has(m.side2EntryId!)).toBe(true);
      }
      for (const id of ids) expect(matches.filter((m) => m.side1EntryId === id || m.side2EntryId === id)).toHaveLength(3);
    }
    expect(await kit.prisma.match.count({ where: { drawId } })).toBe(matchesBefore);
    const audits = await kit.prisma.auditLog.findMany({ where: { entityId: drawId, action: 'draw.swapGroupMembers' } });
    expect(audits).toHaveLength(1);
  });

  it('swaps two members inside one group and swapping back restores the original', async () => {
    const [ga] = await groupsOf();
    const [first, second] = ga!.members;
    await swap({ entryA: first!.entryId, entryB: second!.entryId, expectedVersion: version }).expect(200);
    version += 1;
    const after = (await groupsOf())[0]!.members;
    expect(after.find((m) => m.entryId === first!.entryId)!.slot).toBe(second!.slot);
    expect(after.find((m) => m.entryId === second!.entryId)!.slot).toBe(first!.slot);

    await swap({ entryA: first!.entryId, entryB: second!.entryId, expectedVersion: version }).expect(200);
    version += 1;
    const restored = (await groupsOf())[0]!.members;
    expect(restored.map((m) => [m.entryId, m.slot])).toEqual(ga!.members.map((m) => [m.entryId, m.slot]));
  });

  it('rejects bad input: foreign entry, same entry, stale version', async () => {
    const [ga] = await groupsOf();
    const own = ga!.members[0]!.entryId;
    const foreign = await swap({ entryA: own, entryB: foreignEntry, expectedVersion: version }).expect(422);
    expect(foreign.body.error.code).toBe('ENTRY_NOT_IN_DRAW');
    expect((await swap({ entryA: own, entryB: own, expectedVersion: version }).expect(422)).body.error.code).toBe('INVALID_PARAMS');
    const stale = await swap({ entryA: own, entryB: ga!.members[1]!.entryId, expectedVersion: version - 1 }).expect(409);
    expect(stale.body.error.code).toBe('DRAW_VERSION_CONFLICT');
  });

  it('RESULTS_OPERATOR gets 403', async () => {
    await swap({}, operatorCookie).expect(403);
  });

  it('refuses a published draw with 409 DRAW_NOT_DRAFT', async () => {
    await kit.write('post', `${API}/draws/${drawId}/publish`, adminCookie, { expectedVersion: version }).expect(200);
    version += 1;
    const [ga] = await groupsOf();
    const res = await swap({ entryA: ga!.members[0]!.entryId, entryB: ga!.members[1]!.entryId, expectedVersion: version }).expect(409);
    expect(res.body.error.code).toBe('DRAW_NOT_DRAFT');
  });
});
