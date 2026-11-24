import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule } from './support/group-test-helpers.js';
import { MatchApi, stepUp } from './support/match-flow-helpers.js';

// Qualifier slots never face a BYE (the generator and swaps refuse it); group winners do, so this is the real
// slot -> BYE -> round 2 chain that a reopen has to unwind.
describe('reopen: a group winner carried through a BYE into round 2 (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let adminCookie: string;
  let fx: Fixtures;
  let api: MatchApi;
  let ruleId: string;
  let groupDrawId: string;
  let mainId: string;

  const sub = () => fx.subEvents.MS!;
  const dbMatch = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const place = async () => api.post(`/draws/${mainId}/place-group-qualifiers`, { expectedVersion: (await kit.prisma.draw.findUniqueOrThrow({ where: { id: mainId } })).version });
  const reopen = async (id: string) => api.post(`/matches/${id}/reopen`, { expectedVersion: (await dbMatch(id)).version, reason: 'wrong result entered' });

  /** Slot 1 of every group beats everyone, slot 2 beats slot 3, so the ranks follow the slots. */
  async function playGroups() {
    const groups = await kit.prisma.group.findMany({ where: { drawId: groupDrawId }, include: { members: true } });
    for (const group of groups) {
      const slots = new Map(group.members.map((m) => [m.entryId, m.slot]));
      for (const m of await kit.prisma.match.findMany({ where: { groupId: group.id, status: 'SCHEDULED' } })) {
        const res = await api.win(m.id, slots.get(m.side1EntryId!)! < slots.get(m.side2EntryId!)! ? 1 : 2);
        expect(res.status).toBe(200);
      }
    }
  }

  /** The first-round BYE match that carried a group winner on, with the round-2 side it fills. */
  async function byeChain() {
    const bye = await kit.prisma.match.findFirstOrThrow({
      where: { drawId: mainId, resultType: 'BYE', status: 'OFFICIAL', nextMatchId: { not: null } },
      orderBy: { matchNo: 'asc' },
    });
    const winnerKey = bye.winnerSide === 1 ? 'side1' : 'side2';
    const next = await dbMatch(bye.nextMatchId!);
    const nextKey = bye.nextMatchSide === 1 ? 'side1' : 'side2';
    return { bye, winnerKey, entryId: bye[`${winnerKey}EntryId`], next, nextKey } as const;
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    api = new MatchApi(kit, adminCookie);
    fx = await createEventFixtures(kit, adminCookie, ['MS']);
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    await kit.prisma.subEvent.update({ where: { id: sub() }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId, hasQualifying: false } });
    await new DrawFixtureKit(kit, adminCookie, fx).addEntries(sub(), 0, 9);

    const publish = async (body: object) => {
      const created = await kit.write('post', `${API}/sub-events/${sub()}/draws`, adminCookie, body).expect(201);
      await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
      return created.body.data.id as string;
    };
    // 3 groups x 2 qualifiers = 6 places in an 8-slot knockout: the two BYEs go to group winners.
    groupDrawId = await publish({ kind: 'GROUP', groupCount: 3, advancePerGroup: 2 });
    mainId = await publish({ kind: 'MAIN' });
    await playGroups();
    expect((await place()).status).toBe(200);
    await stepUp(kit, adminCookie, admin.password);
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    if (!fx) return kit.close();
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, [sub()].filter(Boolean), fx?.eventId);
    await cleanupFixtures(kit, fx);
    if (ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
    await kit.close();
  }, 60_000);

  it('seats the group winner, auto-advances it through the BYE and fills its round-2 side', async () => {
    const chain = await byeChain();
    expect(chain.entryId).toBeTruthy();
    expect(chain.next[`${chain.nextKey}EntryId`]).toBe(chain.entryId);
    const seat = await kit.prisma.bracketPosition.findFirstOrThrow({ where: { drawId: mainId, entryId: chain.entryId } });
    expect(seat.sourceRef).toMatchObject({ type: 'GROUP_PLACE', place: 1 });
  });

  it('reopening a group match previews and unwinds the BYE and the round-2 side, then placing again restores them', async () => {
    const chain = await byeChain();
    const seat = await kit.prisma.bracketPosition.findFirstOrThrow({ where: { drawId: mainId, entryId: chain.entryId } });
    const ref = seat.sourceRef as { type: 'GROUP_PLACE'; group: string; place: number };
    const group = await kit.prisma.group.findFirstOrThrow({ where: { drawId: groupDrawId, code: ref.group }, include: { members: true } });
    const slotOf = new Map(group.members.map((m) => [m.entryId, m.slot]));
    const groupMatch = (await kit.prisma.match.findMany({ where: { groupId: group.id } })).find((m) => slotOf.get(m.side1EntryId!) === 1 || slotOf.get(m.side2EntryId!) === 1)!;

    const view = (await kit.get(`${API}/matches/${groupMatch.id}/reopen-preview`, adminCookie).expect(200)).body.data;
    expect(view.blocking).toEqual([]);
    expect(view.affected).toEqual(expect.arrayContaining([
      expect.objectContaining({ matchId: chain.bye.id, entryId: chain.entryId, effect: 'REVERT_AUTO' }),
      expect.objectContaining({ matchId: chain.next.id, entryId: chain.entryId, effect: 'CLEAR_SIDE' }),
    ]));

    expect((await reopen(groupMatch.id)).status).toBe(200);

    expect(await kit.prisma.bracketPosition.findUniqueOrThrow({ where: { id: seat.id } })).toMatchObject({ source: 'GROUP_PLACE', entryId: null, sourceRef: ref });
    const byeAfter = await dbMatch(chain.bye.id);
    expect(byeAfter).toMatchObject({ resultType: 'BYE', [`${chain.winnerKey}EntryId`]: null, [`${chain.winnerKey}Source`]: ref });
    const nextAfter = await dbMatch(chain.next.id);
    expect(nextAfter[`${chain.nextKey}EntryId`]).toBeNull();
    // The round-2 side waits for the group place again, handed on by the BYE instead of "winner of the BYE match".
    expect(nextAfter[`${chain.nextKey}Source`]).toEqual(ref);

    expect((await api.win(groupMatch.id, slotOf.get(groupMatch.side1EntryId!) === 1 ? 1 : 2)).status).toBe(200);
    expect((await place()).status).toBe(200);
    const restored = await byeChain();
    expect(restored.bye.id).toBe(chain.bye.id);
    expect(restored.entryId).toBe(chain.entryId);
    expect(restored.next[`${restored.nextKey}EntryId`]).toBe(chain.entryId);
  });
});
