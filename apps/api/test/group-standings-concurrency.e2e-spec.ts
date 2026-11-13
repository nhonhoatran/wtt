import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule, finishGroupMatches } from './support/group-test-helpers.js';

describe('group standings under concurrent writes (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let fx: Fixtures;
  let ruleId: string;
  let drawId: string;
  let groupId: string;
  let members: string[];

  const patch = (ranks: Record<string, number>, expectedVersion: number) =>
    kit.write('patch', `${API}/groups/${groupId}/manual-ranks`, cookie, { ranks, reason: 'tie settled by lots', expectedVersion });
  const recompute = () => kit.write('post', `${API}/groups/${groupId}/recompute`, cookie);
  const group = () => kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  const standings = async () =>
    (await kit.prisma.groupStanding.findMany({ where: { groupId }, orderBy: { entryId: 'asc' } })).map((s) => ({ ...s }));

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, cookie, ['MD']);
    const subEventId = fx.subEvents.MD!;
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    await kit.prisma.subEvent.update({ where: { id: subEventId }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId } });
    await new DrawFixtureKit(kit, cookie, fx).addEntries(subEventId, 0, 3);
    const created = await kit.write('post', `${API}/sub-events/${subEventId}/draws`, cookie, { kind: 'GROUP' }).expect(201);
    drawId = created.body.data.id;
    await kit.write('post', `${API}/draws/${drawId}/publish`, cookie, { expectedVersion: 0 }).expect(200);
    const row = await kit.prisma.group.findFirstOrThrow({ where: { drawId }, include: { members: { orderBy: { slot: 'asc' } } } });
    groupId = row.id;
    members = row.members.map((m) => m.entryId);
    const cyclic = new Map([[`${members[0]}|${members[1]}`, members[0]!], [`${members[1]}|${members[2]}`, members[1]!], [`${members[0]}|${members[2]}`, members[2]!]]);
    await finishGroupMatches(kit, groupId, (a, b) => cyclic.get(`${a}|${b}`) ?? cyclic.get(`${b}|${a}`)!);
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      await kit.prisma.draw.deleteMany({ where: { subEventId: { in: Object.values(fx?.subEvents ?? {}) } } });
      await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: [groupId, drawId].filter(Boolean) } } });
      await kit.prisma.eventMatchCounter.deleteMany({ where: { eventId: fx?.eventId } });
      await cleanupFixtures(kit, fx);
      if (ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
      await kit.close();
    }
  }, 60_000);

  it('recompute is idempotent: same table, version +1 each call, audited', async () => {
    const first = await recompute().expect(200);
    const afterFirst = await standings();
    const version = (await group()).version;
    await recompute().expect(200);
    expect(await standings()).toEqual(afterFirst);
    expect((await group()).version).toBe(version + 1);
    expect(first.body.data.standings.every((s: { needsManualTiebreak: boolean }) => s.needsManualTiebreak)).toBe(true);
    expect(await kit.prisma.auditLog.count({ where: { entityId: groupId, action: 'group.recompute' } })).toBe(2);
  });

  it('concurrent recomputes all succeed and leave one consistent table', async () => {
    const before = await group();
    const reference = await standings();
    const results = await Promise.all([recompute(), recompute(), recompute(), recompute()]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(await standings()).toEqual(reference);
    expect((await group()).version).toBe(before.version + 4);
  });

  it('two manual-rank writes with the same version: one wins, the other gets GROUP_VERSION_CONFLICT', async () => {
    const version = (await group()).version;
    const [a, b, c] = members as [string, string, string];
    const results = await Promise.all([patch({ [a]: 1, [b]: 2, [c]: 3 }, version), patch({ [c]: 1, [b]: 2, [a]: 3 }, version)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.error.code).toBe('GROUP_VERSION_CONFLICT');
    expect(loser.body.error.currentVersion).toBe(version + 1);

    const winner = results.find((r) => r.status === 200)!;
    const rows = await standings();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => [r.entryId, r.manualRank])).toEqual(
      winner.body.data.standings.map((s: { entryId: string; manualRank: number }) => [s.entryId, s.manualRank]).sort((x: string[], y: string[]) => x[0]!.localeCompare(y[0]!)),
    );
    expect((await group()).version).toBe(version + 1);
    expect(await kit.prisma.auditLog.count({ where: { entityId: groupId, action: 'group.manualRanks' } })).toBe(1);
  });

  it('a recompute racing a manual-rank write never corrupts the table or the version', async () => {
    const version = (await group()).version;
    const [a, b, c] = members as [string, string, string];
    const [write, ...recomputes] = await Promise.all([patch({ [b]: 1, [a]: 2, [c]: 3 }, version), recompute(), recompute()]);
    expect(recomputes.map((r) => r.status)).toEqual([200, 200]);
    expect([200, 409]).toContain(write.status);
    expect((await group()).version).toBe(version + 2 + (write.status === 200 ? 1 : 0));
    const rows = await standings();
    expect(rows).toHaveLength(3);
    if (write.status === 200) {
      const ranked = Object.fromEntries(rows.map((r) => [r.entryId, r.manualRank]));
      expect([ranked[b], ranked[a], ranked[c]]).toEqual([1, 2, 3]);
      expect(rows.every((r) => !r.needsManualTiebreak)).toBe(true);
    } else {
      expect(write.body.error.code).toBe('GROUP_VERSION_CONFLICT');
    }
  });
});
