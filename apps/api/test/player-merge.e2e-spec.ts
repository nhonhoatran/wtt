import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API, cleanupFixtures, createEventFixtures, createPlayer, type Fixtures } from './support/entries-fixtures.js';

describe('player merge (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let category: { id: string };
  let secondDoubles: string;

  const man = (label: string) => createPlayer(kit, adminCookie, fx, { fullName: `Gộp ${label} ${fx.tag}`, gender: 'MALE' });
  const enter = async (subEventId: string, playerIds: string[]) =>
    (await kit.write('post', `${API}/sub-events/${subEventId}/entries`, adminCookie, { playerIds }).expect(201)).body.data;
  const preview = (targetId: string, sourceId: string) => kit.get(`${API}/players/merge/preview?targetId=${targetId}&sourceId=${sourceId}`, adminCookie);
  const merge = (cookie: string, body: object) => kit.write('post', `${API}/players/merge`, cookie, body);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'MD']);
    category = await kit.prisma.category.create({ data: { kind: 'OPEN', code: `M${fx.tag}`, name: `Merge ${fx.tag}` } });
    const md = await kit.prisma.discipline.findFirstOrThrow({ where: { code: 'MD' } });
    const created = await kit
      .write('post', `${API}/events/${fx.eventId}/sub-events`, adminCookie, { disciplineId: md.id, categoryId: category.id, format: 'KNOCKOUT' })
      .expect(201);
    secondDoubles = created.body.data.id;
    await kit.write('post', '/api/v1/auth/step-up', adminCookie, { password: admin.password }).expect(200);
  });

  afterAll(async () => {
    await cleanupFixtures(kit, fx);
    await kit.prisma.category.deleteMany({ where: { id: category.id } });
    await kit.close();
  });

  it('previews counts and reports no conflict when the profiles never meet', async () => {
    const [target, source, partner] = [await man('A1'), await man('B1'), await man('X1')];
    await enter(fx.subEvents.MS!, [source.id]);
    await enter(fx.subEvents.MD!, [source.id, partner.id]);

    const res = await preview(target.id, source.id).expect(200);
    expect(res.body.data).toMatchObject({
      target: { id: target.id, code: target.code, fullName: target.fullName },
      source: { id: source.id, code: source.code },
      counts: { entries: 2, pairs: 1, matches: 0 },
      conflicts: [],
      canMerge: true,
    });
    await kit.get(`${API}/players/merge/preview?targetId=${target.id}`, adminCookie).expect(422);
  });

  it('reports SAME_PLAYER, SAME_SUB_EVENT, PAIR_OF_BOTH and ALREADY_MERGED', async () => {
    const [a, b, c] = [await man('A2'), await man('B2'), await man('C2')];
    const same = await preview(a.id, a.id).expect(200);
    expect(same.body.data).toMatchObject({ canMerge: false, conflicts: [{ code: 'SAME_PLAYER' }] });

    await enter(fx.subEvents.MS!, [a.id]);
    await enter(fx.subEvents.MS!, [b.id]);
    const shared = await preview(a.id, b.id).expect(200);
    expect(shared.body.data.canMerge).toBe(false);
    expect(shared.body.data.conflicts).toEqual([expect.objectContaining({ code: 'SAME_SUB_EVENT', subEventId: fx.subEvents.MS })]);

    await enter(fx.subEvents.MD!, [b.id, c.id]);
    const pair = await preview(c.id, b.id).expect(200);
    expect(pair.body.data.conflicts.map((row: { code: string }) => row.code)).toContain('PAIR_OF_BOTH');

    await kit.prisma.player.update({ where: { id: c.id }, data: { mergedIntoId: a.id, mergedAt: new Date(), isActive: false } });
    const merged = await preview(a.id, c.id).expect(200);
    expect(merged.body.data.conflicts.map((row: { code: string }) => row.code)).toContain('ALREADY_MERGED');
    await kit.get(`${API}/players/merge/preview?targetId=${a.id}&sourceId=00000000-0000-4000-8000-000000000000`, adminCookie).expect(404);
  });

  it('needs step-up, a reason and the players.manage permission', async () => {
    const [target, source] = [await man('A3'), await man('B3')];
    const fresh = await kit.createUser({ role: 'ADMIN' });
    const freshCookie = await kit.signIn(fresh);
    const denied = await merge(freshCookie, { targetId: target.id, sourceId: source.id, reason: 'Trùng hồ sơ' }).expect(403);
    expect(denied.body.error.code).toBe('STEP_UP_REQUIRED');
    await merge(operatorCookie, { targetId: target.id, sourceId: source.id, reason: 'Trùng hồ sơ' }).expect(403);
    const short = await merge(adminCookie, { targetId: target.id, sourceId: source.id, reason: 'ngắn' }).expect(422);
    expect(short.body.error.fields).toHaveProperty('reason');
    const untouched = await kit.prisma.player.findUniqueOrThrow({ where: { id: source.id } });
    expect(untouched.mergedIntoId).toBeNull();
  });

  it('moves entries and pairs of the source to the target and retires the source profile', async () => {
    const [target, source, partner] = [await man('A4'), await man('B4'), await man('X4')];
    const single = await enter(fx.subEvents.MS!, [source.id]);
    const double = await enter(fx.subEvents.MD!, [source.id, partner.id]);

    const res = await merge(adminCookie, { targetId: target.id, sourceId: source.id, reason: 'Trùng hồ sơ nhập tay' }).expect(200);
    expect(res.body.data).toMatchObject({ targetId: target.id, sourceId: source.id, movedEntries: 2, movedPairs: 1 });

    const retired = await kit.prisma.player.findUniqueOrThrow({ where: { id: source.id } });
    expect(retired).toMatchObject({ mergedIntoId: target.id, isActive: false });
    expect(retired.mergedAt).toBeInstanceOf(Date);
    expect(await kit.prisma.competitor.count({ where: { playerId: source.id } })).toBe(0);

    const targetCompetitor = await kit.prisma.competitor.findUniqueOrThrow({ where: { playerId: target.id } });
    expect(targetCompetitor.displayName).toBe(target.fullName);
    const singleRow = await kit.prisma.entry.findUniqueOrThrow({ where: { id: single.id } });
    expect(singleRow.competitorId).toBe(targetCompetitor.id);

    const pair = await kit.prisma.pair.findFirstOrThrow({ where: { competitor: { entries: { some: { id: double.id } } } } });
    expect([pair.playerAId, pair.playerBId].sort()).toEqual([target.id, partner.id].sort());
    expect(pair.playerAId < pair.playerBId).toBe(true);
    const pairCompetitor = await kit.prisma.competitor.findUniqueOrThrow({ where: { pairId: pair.id } });
    expect(pairCompetitor.displayName).toContain(target.fullName);
    expect(pairCompetitor.displayName).not.toContain(source.fullName);

    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: target.id, action: 'player.merge' } });
    expect(audit.reason).toBe('Trùng hồ sơ nhập tay');
    expect(audit.before).toMatchObject({ sourceId: source.id });
    expect((audit.before as { entryIds: string[] }).entryIds.sort()).toEqual([single.id, double.id].sort());
    expect(audit.after).toMatchObject({ targetId: target.id });

    const list = await kit.get(`${API}/players?q=${encodeURIComponent(`gop b4 ${fx.tag}`)}`, adminCookie).expect(200);
    expect(list.body.data).toEqual([]);
    const detail = (await kit.get(`${API}/players/${target.id}`, adminCookie).expect(200)).body.data;
    expect(detail).toMatchObject({ entryCount: 2, pairCount: 1 });
    const again = await merge(adminCookie, { targetId: target.id, sourceId: source.id, reason: 'Gộp lại lần hai' }).expect(409);
    expect(again.body.error.code).toBe('MERGE_CONFLICT');
  });

  it('refuses a conflicting merge with MERGE_CONFLICT and changes nothing', async () => {
    const [a, b] = [await man('A5'), await man('B5')];
    const entryA = await enter(fx.subEvents.MS!, [a.id]);
    const entryB = await enter(fx.subEvents.MS!, [b.id]);
    const res = await merge(adminCookie, { targetId: a.id, sourceId: b.id, reason: 'Thử gộp xung đột' }).expect(409);
    expect(res.body.error.code).toBe('MERGE_CONFLICT');
    expect(res.body.error.issues).toEqual([expect.objectContaining({ code: 'SAME_SUB_EVENT', subEventId: fx.subEvents.MS })]);
    const rows = await kit.prisma.entry.findMany({ where: { id: { in: [entryA.id, entryB.id] } }, include: { competitor: true } });
    expect(rows.map((row) => row.competitor.playerId).sort()).toEqual([a.id, b.id].sort());
    expect((await kit.prisma.player.findUniqueOrThrow({ where: { id: b.id } })).mergedIntoId).toBeNull();
  });

  it('collapses the duplicate pair (A,X) + (B,X) into one, moving its entries', async () => {
    const [target, source, partner] = [await man('A6'), await man('B6'), await man('X6')];
    const keep = await enter(fx.subEvents.MD!, [target.id, partner.id]);
    const move = await enter(secondDoubles, [source.id, partner.id]);
    const preview6 = await preview(target.id, source.id).expect(200);
    expect(preview6.body.data).toMatchObject({ canMerge: true, counts: { entries: 1, pairs: 1 } });

    await merge(adminCookie, { targetId: target.id, sourceId: source.id, reason: 'Cặp trùng sau gộp' }).expect(200);

    const pairs = await kit.prisma.pair.findMany({ where: { OR: [{ playerAId: partner.id }, { playerBId: partner.id }] }, include: { competitor: true } });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.competitor).not.toBeNull();
    const rows = await kit.prisma.entry.findMany({ where: { id: { in: [keep.id, move.id] } } });
    expect(new Set(rows.map((row) => row.competitorId)).size).toBe(1);
    expect(rows.map((row) => row.competitorId)[0]).toBe(pairs[0]!.competitor!.id);
    expect(await kit.prisma.pair.count({ where: { OR: [{ playerAId: source.id }, { playerBId: source.id }] } })).toBe(0);
    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: target.id, action: 'player.merge', reason: 'Cặp trùng sau gộp' } });
    expect(audit.after).toMatchObject({ pairs: [expect.objectContaining({ absorbed: true, toPairId: pairs[0]!.id })] });
  });
});
