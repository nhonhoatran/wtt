import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule } from './support/group-test-helpers.js';
import { MatchApi, stepUp, straightWin, winWithOneGameLost } from './support/match-flow-helpers.js';

describe('concurrent match writes (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let adminCookie: string;
  let fx: Fixtures;
  let api: MatchApi;
  let ruleId: string;
  let groupId: string;
  let knockoutId: string;

  const dbMatch = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const publish = async (code: string, body: object) => {
    const created = await kit.write('post', `${API}/sub-events/${fx.subEvents[code]}/draws`, adminCookie, body).expect(201);
    await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
    return created.body.data.id as string;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    api = new MatchApi(kit, adminCookie);
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'MD']);
    const players = new DrawFixtureKit(kit, adminCookie, fx);
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    await kit.prisma.subEvent.update({ where: { id: fx.subEvents.MD! }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId, hasQualifying: false } });
    await players.addEntries(fx.subEvents.MD!, 0, 4);
    await players.addEntries(fx.subEvents.MS!, 4, 8);
    groupId = (await kit.prisma.group.findFirstOrThrow({ where: { drawId: await publish('MD', { kind: 'GROUP', groupCount: 1, advancePerGroup: 2 }) } })).id;
    knockoutId = await publish('MS', { kind: 'MAIN' });
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    if (ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
    await kit.close();
  }, 60_000);

  it('confirming every match of one group at the same time leaves standings that reflect all of them', async () => {
    const members = await kit.prisma.groupMember.findMany({ where: { groupId } });
    const slots = new Map(members.map((m) => [m.entryId, m.slot]));
    const matches = await kit.prisma.match.findMany({ where: { groupId } });
    expect(matches).toHaveLength(6);

    const results = await Promise.all(
      matches.map(async (m) => {
        const format = (await api.detail(m.id)).format;
        const side = slots.get(m.side1EntryId!)! < slots.get(m.side2EntryId!)! ? 1 : 2;
        return api.post(`/matches/${m.id}/confirm`, { expectedVersion: m.version, resultType: 'NORMAL', games: straightWin(format, side) });
      }),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);

    const standings = await kit.prisma.groupStanding.findMany({ where: { groupId } });
    expect(standings).toHaveLength(4);
    for (const row of standings) {
      expect(row.played).toBe(3);
      expect(row.won).toBe(4 - slots.get(row.entryId)!);
      expect(row.rank).toBe(slots.get(row.entryId));
    }
    expect(await kit.prisma.match.count({ where: { groupId, status: 'OFFICIAL' } })).toBe(6);
  });

  it('two different group matches amended together both bump the group once each', async () => {
    const draw = await kit.prisma.draw.findFirstOrThrow({ where: { groups: { some: { id: groupId } } } });
    expect(draw.kind).toBe('GROUP');
    const [first, second] = await kit.prisma.match.findMany({ where: { groupId }, orderBy: { matchNo: 'asc' } });
    const before = await kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    const amends = await Promise.all(
      [first!, second!].map(async (m) => {
        const format = (await api.detail(m.id)).format;
        const side = (await dbMatch(m.id)).winnerSide as 1 | 2;
        return api.post(`/matches/${m.id}/amend-scores`, {
          expectedVersion: m.version,
          reason: 'both scorers corrected a typo',
          games: winWithOneGameLost(format, side),
        });
      }),
    );
    expect(amends.map((r) => r.status)).toEqual([200, 200]);
    expect((await kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } })).version).toBe(before.version + 2);
  });

  it('two requests with the same expectedVersion: one wins, the other gets 409', async () => {
    const [m] = await kit.prisma.match.findMany({ where: { drawId: knockoutId, round: { number: 1 } }, orderBy: { orderInRound: 'asc' } });
    const started = (await api.post(`/matches/${m!.id}/start`, { expectedVersion: m!.version })).body.data;
    const body = { expectedVersion: started.version, games: [{ score1: 5, score2: 3 }] };
    const saves = await Promise.all([api.post(`/matches/${m!.id}/save-progress`, body), api.post(`/matches/${m!.id}/save-progress`, body)]);
    expect(saves.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(saves.find((r) => r.status === 409)!.body.error.code).toBe('MATCH_VERSION_CONFLICT');
    expect(await kit.prisma.game.count({ where: { matchId: m!.id } })).toBe(1);

    const unStarts = await Promise.all([1, 2].map(() => api.post(`/matches/${m!.id}/un-start`, { expectedVersion: started.version + 1 })));
    expect(unStarts.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await dbMatch(m!.id)).status).toBe('SCHEDULED');
  });

  it('two reopen requests with the same expectedVersion: one wins, the other gets 409', async () => {
    const [m] = await kit.prisma.match.findMany({ where: { drawId: knockoutId, round: { number: 1 } }, orderBy: { orderInRound: 'desc' } });
    expect((await api.win(m!.id, 1)).status).toBe(200);
    const { version } = await dbMatch(m!.id);
    await stepUp(kit, adminCookie, admin.password);
    const body = { expectedVersion: version, reason: 'double click on reopen' };
    const reopens = await Promise.all([api.post(`/matches/${m!.id}/reopen`, body), api.post(`/matches/${m!.id}/reopen`, body)]);
    expect(reopens.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await dbMatch(m!.id)).toMatchObject({ status: 'LIVE', version: version + 1 });
    expect(await kit.prisma.auditLog.count({ where: { entityId: m!.id, action: 'match.reopen' } })).toBe(1);
  });

  it('a schedule change while scores are being saved does not lose the scores', async () => {
    const m = await dbMatch((await kit.prisma.match.findMany({ where: { drawId: knockoutId, round: { number: 1 } }, orderBy: { orderInRound: 'asc' } }))[1]!.id);
    const started = (await api.post(`/matches/${m.id}/start`, { expectedVersion: m.version })).body.data;
    const games = [{ score1: 11, score2: 4 }, { score1: 6, score2: 2 }];

    const [save, schedule] = await Promise.all([
      api.post(`/matches/${m.id}/save-progress`, { expectedVersion: started.version, games }),
      // The schedule endpoint refuses non-SCHEDULED matches, so the same column writes are issued directly.
      kit.prisma.match.update({ where: { id: m.id }, data: { orderInSession: 7, scheduledAt: new Date('2099-05-01T09:00:00Z'), scheduleVersion: { increment: 1 } } }),
    ]);
    expect(save.status).toBe(200);
    expect(schedule.scheduleVersion).toBe(m.scheduleVersion + 1);

    const after = await dbMatch(m.id);
    expect(after.version).toBe(started.version + 1);
    expect(after).toMatchObject({ scheduleVersion: m.scheduleVersion + 1, orderInSession: 7 });
    expect((await kit.prisma.game.findMany({ where: { matchId: m.id }, orderBy: { number: 'asc' } })).map((g) => [g.score1, g.score2])).toEqual([
      [11, 4],
      [6, 2],
    ]);
  });
});
