import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule, finishGroupMatches, slotWinner } from './support/group-test-helpers.js';

describe('draw guards from the phase 06 review (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  const ruleIds: string[] = [];

  const sub = (code: string) => fx.subEvents[code]!;
  const post = (path: string, body: object = {}) => kit.write('post', `${API}${path}`, adminCookie, body);
  const generate = (code: string, body: object) => post(`/sub-events/${sub(code)}/draws`, body);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS', 'MD', 'WD']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
      await cleanupFixtures(kit, fx);
      await kit.prisma.groupScoringRule.deleteMany({ where: { id: { in: ruleIds } } });
      await kit.close();
    }
  }, 60_000);

  it('H4: a LIVE match with a null resultType blocks changing the round format; M4: the seed is admin-only', async () => {
    await players.addEntries(sub('MS'), 0, 8);
    const drawId = (await generate('MS', { kind: 'MAIN', seedCount: 0 }).expect(201)).body.data.id as string;
    await post(`/draws/${drawId}/publish`, { expectedVersion: 0 }).expect(200);
    const round = await kit.prisma.round.findFirstOrThrow({ where: { drawId, number: 1 } });
    const patch = (version: number) => kit.write('patch', `${API}/rounds/${round.id}`, adminCookie, { matchFormatId: null, expectedVersion: version });

    await patch(1).expect(200);
    const live = await kit.prisma.match.findFirstOrThrow({ where: { drawId, roundId: round.id, resultType: null } });
    await kit.prisma.match.update({ where: { id: live.id }, data: { status: 'LIVE' } });
    expect((await patch(2).expect(409)).body.error.code).toBe('ROUND_STARTED');

    const asAdmin = await kit.get(`${API}/draws/${drawId}/bracket`, adminCookie).expect(200);
    const asOperator = await kit.get(`${API}/draws/${drawId}/bracket`, operatorCookie).expect(200);
    expect(typeof asAdmin.body.data.randomSeed).toBe('string');
    expect(asOperator.body.data).not.toHaveProperty('randomSeed');
    const groups = await kit.get(`${API}/draws/${drawId}/groups`, operatorCookie).expect(200);
    expect(groups.body.data).not.toHaveProperty('randomSeed');
  });

  it('M2 and M1: regenerating a draft needs expectedVersion; stage changes are refused once published', async () => {
    const entries = await players.addEntries(sub('WS'), 0, 6);
    const drawId = (await generate('WS', { kind: 'MAIN', seedCount: 0 }).expect(201)).body.data.id as string;
    const blind = await generate('WS', { kind: 'MAIN', seedCount: 0 }).expect(409);
    expect(blind.body.error).toMatchObject({ code: 'DRAW_VERSION_CONFLICT', currentVersion: 0 });
    const regenerated = await generate('WS', { kind: 'MAIN', seedCount: 0, expectedVersion: 0 }).expect(201);
    expect(regenerated.body.data).toMatchObject({ id: drawId, version: 1 });

    await post(`/draws/${drawId}/publish`, { expectedVersion: 1 }).expect(200);

    const single = await kit.write('patch', `${API}/entries/${entries[1]}`, adminCookie, { stage: 'QUALIFYING' }).expect(409);
    expect(single.body.error.code).toBe('ENTRY_IN_PUBLISHED_DRAW');
    const bulk = await kit.write('post', `${API}/entries/bulk`, adminCookie, { ids: [entries[1], entries[2]], action: 'setStage', stage: 'QUALIFYING' }).expect(409);
    expect(bulk.body.error.code).toBe('ENTRY_IN_PUBLISHED_DRAW');
    expect(await kit.prisma.entry.count({ where: { id: { in: entries }, stage: 'QUALIFYING' } })).toBe(0);
  });

  it('H3 and M3: a withdrawn group finisher passes the slot to the next entry; placed groups freeze their tables', async () => {
    const rule = await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS');
    ruleIds.push(rule.id);
    await kit.prisma.subEvent.update({ where: { id: sub('MD') }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: rule.id } });
    await players.addEntries(sub('MD'), 0, 8);
    const groupDrawId = (await generate('MD', { kind: 'GROUP', groupCount: 2, advancePerGroup: 2 }).expect(201)).body.data.id as string;
    await post(`/draws/${groupDrawId}/publish`, { expectedVersion: 0 }).expect(200);
    const mainId = (await generate('MD', { kind: 'MAIN' }).expect(201)).body.data.id as string;
    const groups = await kit.prisma.group.findMany({ where: { drawId: groupDrawId }, orderBy: { order: 'asc' }, include: { members: { orderBy: { slot: 'asc' } } } });
    for (const g of groups) await finishGroupMatches(kit, g.id, await slotWinner(kit, g.id));

    const [first, second, third] = groups[0]!.members.map((m) => m.entryId);
    await post(`/draws/${groupDrawId}/withdraw-entry`, { entryId: second, reason: 'injured', expectedVersion: 1 }).expect(200);
    const standings = await kit.prisma.groupStanding.findMany({ where: { groupId: groups[0]!.id } });
    expect(standings.find((s) => s.entryId === second)).toMatchObject({ rank: 2, qualified: false });
    expect(standings.find((s) => s.entryId === third)).toMatchObject({ rank: 3, qualified: true });

    await post(`/draws/${mainId}/place-group-qualifiers`, { expectedVersion: 0 }).expect(200);
    const placed = (await kit.prisma.bracketPosition.findMany({ where: { drawId: mainId } })).map((p) => p.entryId);
    expect(placed).toEqual(expect.arrayContaining([first, third]));
    expect(placed).not.toContain(second);

    const base = { reason: 'drawing of lots', expectedVersion: (await kit.prisma.group.findUniqueOrThrow({ where: { id: groups[1]!.id } })).version };
    const [a, b] = groups[1]!.members.map((m) => m.entryId);
    const frozen = await kit.write('patch', `${API}/groups/${groups[1]!.id}/manual-ranks`, adminCookie, { ...base, ranks: { [a!]: 1, [b!]: 2 } }).expect(409);
    expect(frozen.body.error.code).toBe('GROUPS_ALREADY_PLACED');
    expect((await post(`/groups/${groups[1]!.id}/recompute`).expect(409)).body.error.code).toBe('GROUPS_ALREADY_PLACED');
  });

  it('L1: the default number of qualifier slots comes from the draw.defaultQualifierCount setting', async () => {
    await players.addEntries(sub('WD'), 0, 8, { stage: 'QUALIFYING' });
    const res = await post(`/sub-events/${sub('WD')}/draws/preview`, { kind: 'QUALIFYING' }).expect(200);
    expect(res.body.data.defaults.qualifierCount).toBe(4);
    expect(res.body.data.params.qualifierCount).toBe(res.body.data.defaults.qualifierCount);
  });
});
