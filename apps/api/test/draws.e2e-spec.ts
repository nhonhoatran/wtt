import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRng, fillQualifierSlots, generateKnockout, type BracketPositionData } from '@kamito/competition-engine';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';

describe('draws and matches (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let msEntries: string[];
  let msDrawId: string;
  let msSeed: string;

  const sub = (code: string) => fx.subEvents[code]!;
  const post = (path: string, body: object = {}, cookie = adminCookie) => kit.write('post', `${API}${path}`, cookie, body);
  const generate = (code: string, body: object) => post(`/sub-events/${sub(code)}/draws`, body);
  const bracket = (drawId: string, cookie = adminCookie) => kit.get(`${API}/draws/${drawId}/bracket`, cookie);
  const audits = (entityId: string, action: string) => kit.prisma.auditLog.findMany({ where: { entityId, action }, orderBy: { createdAt: 'asc' } });
  const dbPositions = (drawId: string) => kit.prisma.bracketPosition.findMany({ where: { drawId }, orderBy: [{ section: 'asc' }, { position: 'asc' }] });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS', 'MD', 'WD']);
    await kit.prisma.subEvent.update({ where: { id: sub('WD') }, data: { format: 'GROUP_KNOCKOUT' } });
    await kit.prisma.subEvent.update({ where: { id: sub('MD') }, data: { hasQualifying: false } });
    players = new DrawFixtureKit(kit, adminCookie, fx);
    msEntries = await players.addEntries(sub('MS'), 0, 51, { seeds: 16 });
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      const subEventIds = Object.values(fx?.subEvents ?? {});
      await kit.prisma.draw.deleteMany({ where: { subEventId: { in: subEventIds } } });
      await kit.prisma.eventMatchCounter.deleteMany({ where: { eventId: fx?.eventId } });
      await cleanupFixtures(kit, fx);
      await kit.close();
    }
  }, 60_000);

  it('previews with defaults filled from settings and the sub-event', async () => {
    const res = await post(`/sub-events/${sub('MS')}/draws/preview`, { kind: 'MAIN' }).expect(200);
    expect(res.body.data).toMatchObject({ size: 64, byeCount: 13, seedCount: 16, qualifierSlots: 0 });
    expect(res.body.data.params).toMatchObject({ kind: 'MAIN', entryCount: 51, seedCount: 16, qualifierCount: 0 });
    expect(res.body.data.defaults).toMatchObject({ seedPercent: 25 });
    expect(res.body.data.existingDraw).toBeNull();
    await post(`/sub-events/${sub('MS')}/draws/preview`, { kind: 'BAD' }).expect(422);
  });

  it('generates a 64 bracket with 13 BYE, 16 seeds and auto-advanced BYE matches', async () => {
    const res = await generate('MS', { kind: 'MAIN' }).expect(201);
    const draw = res.body.data;
    msDrawId = draw.id;
    msSeed = draw.randomSeed;
    expect(draw).toMatchObject({ kind: 'MAIN', status: 'DRAFT', size: 64, byeCount: 13, seedCount: 16, version: 0, locked: false, matchCount: 63 });

    const positions = await dbPositions(msDrawId);
    expect(positions).toHaveLength(64);
    expect(positions.filter((p) => p.source === 'BYE')).toHaveLength(13);
    const matches = await kit.prisma.match.findMany({ where: { drawId: msDrawId }, include: { round: true } });
    expect(matches).toHaveLength(63);
    expect(new Set(matches.map((m) => m.matchNo)).size).toBe(63);
    expect(matches.filter((m) => m.nextMatchId === null)).toHaveLength(1);

    const byes = matches.filter((m) => m.resultType === 'BYE');
    expect(byes).toHaveLength(13);
    for (const bye of byes) {
      expect(bye.status).toBe('OFFICIAL');
      expect([1, 2]).toContain(bye.winnerSide);
      const winner = bye.winnerSide === 1 ? bye.side1EntryId : bye.side2EntryId;
      const next = matches.find((m) => m.id === bye.nextMatchId)!;
      expect(winner).toBeTruthy();
      expect(bye.nextMatchSide === 1 ? next.side1EntryId : next.side2EntryId).toBe(winner);
    }
  });

  it('is reproducible from the stored randomSeed', async () => {
    const entries = await kit.prisma.entry.findMany({ where: { subEventId: sub('MS') }, select: { id: true, seed: true, pointsAtEntry: true }, orderBy: { id: 'asc' } });
    const again = generateKnockout({ entries, seedCount: 16, rng: createRng(msSeed) });
    const stored = await dbPositions(msDrawId);
    expect(stored.map((p) => [p.position, p.source, p.entryId])).toEqual(again.positions.map((p) => [p.position, p.source, p.entryId ?? null]));
  });

  it('audits the generation with randomSeed and params', async () => {
    const [row] = await audits(msDrawId, 'draw.generate');
    const after = row!.after as { randomSeed: string; params: Record<string, unknown>; effective: Record<string, unknown> };
    expect(after.randomSeed).toBe(msSeed);
    expect(after.params).toMatchObject({ size: 64, seedCount: 16 });
    expect(after.effective).toMatchObject({ entryCount: 51, seedCount: 16 });
  });

  it('overwrites a DRAFT of the same kind, auditing the discarded one', async () => {
    await generate('MS', { kind: 'MAIN', expectedVersion: 5 }).expect(409);
    const res = await generate('MS', { kind: 'MAIN', expectedVersion: 0 }).expect(201);
    expect(res.body.data).toMatchObject({ id: msDrawId, version: 1, matchCount: 63 });
    expect(res.body.data.randomSeed).not.toBe(msSeed);
    const discards = await audits(msDrawId, 'draw.discard');
    expect(discards).toHaveLength(1);
    expect(discards[0]!.before).toMatchObject({ randomSeed: msSeed, params: { size: 64, seedCount: 16 } });
    const generated = await audits(msDrawId, 'draw.generate');
    expect(generated).toHaveLength(2);
    expect((generated[1]!.after as { randomSeed: string }).randomSeed).toBe(res.body.data.randomSeed);
    msSeed = res.body.data.randomSeed;
    expect(await kit.prisma.match.count({ where: { drawId: msDrawId } })).toBe(63);
  });

  it('reads the bracket joined with entries, rounds and effective formats; operators can read but not write', async () => {
    const res = await bracket(msDrawId).expect(200);
    const data = res.body.data;
    expect(data).toMatchObject({ id: msDrawId, kind: 'MAIN', status: 'DRAFT', version: 1, locked: false, randomSeed: msSeed });
    expect(data.positions).toHaveLength(64);
    const seeded = data.positions.find((p: { entry: { seed: number } | null }) => p.entry?.seed === 1);
    expect(seeded.entry.displayName).toContain('Draw');
    expect(data.rounds.map((r: { code: string }) => r.code)).toEqual(['R64', 'R32', 'R16', 'QF', 'SF', 'F']);
    expect(data.rounds[0]).toMatchObject({ matchFormatSource: 'SUB_EVENT', matchFormatId: null });
    expect(data.matches).toHaveLength(63);
    await bracket(msDrawId, operatorCookie).expect(200);
    await post(`/draws/${msDrawId}/swap`, {}, operatorCookie).expect(403);
    await post(`/sub-events/${sub('MS')}/draws`, { kind: 'MAIN' }, operatorCookie).expect(403);
  });

  it('swaps two entries; concurrent swaps with the same version give one 200 and one 409', async () => {
    const positions = (await bracket(msDrawId)).body.data.positions as { id: string; position: number; source: string }[];
    const entries = positions.filter((p) => p.source === 'ENTRY');
    const [a, b, c, d] = [entries[10]!, entries[20]!, entries[11]!, entries[21]!];
    const results = await Promise.all([
      post(`/draws/${msDrawId}/swap`, { positionA: a.id, positionB: b.id, expectedVersion: 1 }),
      post(`/draws/${msDrawId}/swap`, { positionA: c.id, positionB: d.id, expectedVersion: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('DRAW_VERSION_CONFLICT');
    const draw = await kit.prisma.draw.findUniqueOrThrow({ where: { id: msDrawId } });
    expect(draw.version).toBe(2);
    expect(await audits(msDrawId, 'draw.swap')).toHaveLength(1);
  });

  it('keeps matches consistent when a BYE is swapped with an entry', async () => {
    const rows = await dbPositions(msDrawId);
    const byPos = new Map(rows.map((r) => [r.position, r]));
    const partner = (p: number) => byPos.get(p % 2 === 1 ? p + 1 : p - 1)!;
    const bye = rows.find((r) => r.source === 'BYE')!;
    const target = rows.find((r) => r.source === 'ENTRY' && partner(r.position).source === 'ENTRY' && partner(r.position).id !== partner(bye.position).id)!;
    const matchNosBefore = (await kit.prisma.match.findMany({ where: { drawId: msDrawId }, select: { id: true, matchNo: true } })).sort((x, y) => x.matchNo - y.matchNo);
    await post(`/draws/${msDrawId}/swap`, { positionA: bye.id, positionB: target.id, expectedVersion: 2 }).expect(200);

    const after = await dbPositions(msDrawId);
    expect(after.filter((p) => p.source === 'BYE')).toHaveLength(13);
    const matches = await kit.prisma.match.findMany({ where: { drawId: msDrawId } });
    expect(matches.filter((m) => m.resultType === 'BYE')).toHaveLength(13);
    expect(matches.map((m) => m.matchNo).sort((x, y) => x - y)).toEqual(matchNosBefore.map((m) => m.matchNo));
    const r1 = await kit.prisma.match.findMany({ where: { drawId: msDrawId, round: { number: 1 } }, include: { round: true } });
    for (const m of r1) {
      const isBye = m.resultType === 'BYE';
      const first = after[(m.orderInRound - 1) * 2]!;
      const second = after[(m.orderInRound - 1) * 2 + 1]!;
      expect(isBye).toBe(first.source === 'BYE' || second.source === 'BYE');
      expect(m.side1EntryId).toBe(first.entryId);
      expect(m.side2EntryId).toBe(second.entryId);
    }
    const stale = await post(`/draws/${msDrawId}/swap`, { positionA: bye.id, positionB: target.id, expectedVersion: 2 }).expect(409);
    expect(stale.body.error.code).toBe('DRAW_VERSION_CONFLICT');
    const rowsNow = await dbPositions(msDrawId);
    const byes = rowsNow.filter((r) => r.source === 'BYE');
    const pairBye = byes.find((r) => byes.some((o) => o.id !== r.id && Math.ceil(o.position / 2) === Math.ceil(r.position / 2)));
    expect(pairBye).toBeUndefined();
  });

  it('rejects a swap that puts BYE against BYE', async () => {
    const rows = await dbPositions(msDrawId);
    const bye = rows.find((r) => r.source === 'BYE')!;
    const entryWithByePartner = rows.find((r) => r.source === 'ENTRY' && rows.some((o) => o.source === 'BYE' && o.id !== bye.id && Math.ceil(o.position / 2) === Math.ceil(r.position / 2)))!;
    const res = await post(`/draws/${msDrawId}/swap`, { positionA: bye.id, positionB: entryWithByePartner.id, expectedVersion: 3 }).expect(422);
    expect(res.body.error.code).toBe('BYE_VS_BYE');
  });

  it('rejects a duplicate round (drawId, scopeKey, number) in the database', async () => {
    await expect(kit.prisma.round.create({ data: { drawId: msDrawId, scopeKey: 'S1', number: 1, code: 'DUP' } })).rejects.toThrow();
  });

  it('overrides and clears the match format of a round, with optimistic locking', async () => {
    const round = (await bracket(msDrawId)).body.data.rounds[3] as { id: string };
    const format = await kit.prisma.matchFormat.findFirstOrThrow({ where: { isActive: true } });
    const patch = (body: object) => kit.write('patch', `${API}/rounds/${round.id}`, adminCookie, body);
    await patch({ matchFormatId: format.id, expectedVersion: 99 }).expect(409);
    const ok = await patch({ matchFormatId: format.id, expectedVersion: 3 }).expect(200);
    expect(ok.body.data).toMatchObject({ matchFormatId: format.id, drawVersion: 4 });
    const read = (await bracket(msDrawId)).body.data.rounds[3];
    expect(read).toMatchObject({ matchFormatSource: 'ROUND', matchFormat: { id: format.id } });
    await patch({ matchFormatId: null, expectedVersion: 4 }).expect(200);
    expect((await bracket(msDrawId)).body.data.rounds[3].matchFormatSource).toBe('SUB_EVENT');
    expect(await audits(round.id, 'round.matchFormat')).toHaveLength(2);
    await patch({ matchFormatId: '00000000-0000-4000-8000-000000000000', expectedVersion: 5 }).expect(422);
  });

  it('publishes without locking (BYE matches do not count) and then freezes DRAFT-only operations', async () => {
    await post(`/draws/${msDrawId}/publish`, { expectedVersion: 1 }).expect(409);
    const res = await post(`/draws/${msDrawId}/publish`, { expectedVersion: 5 }).expect(200);
    expect(res.body.data).toMatchObject({ status: 'PUBLISHED', locked: false, version: 6 });
    expect(res.body.data.publishedAt).toBeTruthy();
    expect(await audits(msDrawId, 'draw.publish')).toHaveLength(1);

    const rows = await dbPositions(msDrawId);
    const swap = await post(`/draws/${msDrawId}/swap`, { positionA: rows[0]!.id, positionB: rows[2]!.id, expectedVersion: 6 }).expect(409);
    expect(swap.body.error.code).toBe('DRAW_NOT_DRAFT');
    await kit.write('delete', `${API}/draws/${msDrawId}?expectedVersion=6`, adminCookie).expect(409);
    const again = await generate('MS', { kind: 'MAIN' }).expect(409);
    expect(again.body.error.code).toBe('DRAW_ALREADY_PUBLISHED');
    await post(`/draws/${msDrawId}/publish`, { expectedVersion: 6 }).expect(409);
  });

  it('blocks withdrawing an entry that sits in a published draw (entries tab guard)', async () => {
    const res = await kit.write('patch', `${API}/entries/${msEntries[0]}`, adminCookie, { status: 'WITHDRAWN' }).expect(409);
    expect(res.body.error.code).toBe('ENTRY_IN_PUBLISHED_DRAW');
  });

  it('lists draws per sub-event with status and lock for the side menu', async () => {
    const res = await kit.get(`${API}/events/${fx.eventId}/draws`, adminCookie).expect(200);
    const ms = res.body.data.find((s: { subEventId: string }) => s.subEventId === sub('MS'));
    expect(ms.draws).toEqual([{ id: msDrawId, kind: 'MAIN', status: 'PUBLISHED', locked: false, version: 6 }]);
    const ws = res.body.data.find((s: { subEventId: string }) => s.subEventId === sub('WS'));
    expect(ws.draws).toEqual([]);
    await kit.get(`${API}/events/${fx.eventId}/draws`, operatorCookie).expect(200);
  });

  it('locks a DRAFT once a real match is live: swap, redraw and delete are refused', async () => {
    await players.addEntries(sub('MD'), 0, 8);
    const created = await generate('MD', { kind: 'MAIN', seedCount: 0 }).expect(201);
    const drawId = created.body.data.id as string;
    const live = await kit.prisma.match.findFirstOrThrow({ where: { drawId, round: { number: 1 }, resultType: null } });
    await kit.prisma.match.update({ where: { id: live.id }, data: { status: 'LIVE' } });
    const positions = await dbPositions(drawId);

    const swap = await post(`/draws/${drawId}/swap`, { positionA: positions[0]!.id, positionB: positions[7]!.id, expectedVersion: 0 }).expect(409);
    expect(swap.body.error.code).toBe('DRAW_STRUCTURE_LOCKED');
    expect((await generate('MD', { kind: 'MAIN', expectedVersion: 0 }).expect(409)).body.error.code).toBe('DRAW_STRUCTURE_LOCKED');
    await kit.write('delete', `${API}/draws/${drawId}?expectedVersion=0`, adminCookie).expect(409);
    expect((await bracket(drawId)).body.data.locked).toBe(true);
    expect((await post(`/sub-events/${sub('MD')}/draws`, { kind: 'QUALIFYING' }).expect(422)).body.error.code).toBe('KIND_NOT_ALLOWED');

    await kit.prisma.match.update({ where: { id: live.id }, data: { status: 'SCHEDULED' } });
    await kit.write('delete', `${API}/draws/${drawId}?expectedVersion=0`, adminCookie).expect(200);
    expect(await kit.prisma.draw.count({ where: { id: drawId } })).toBe(0);
    expect(await audits(drawId, 'draw.delete')).toHaveLength(1);
  });

  it('generates a group draw with round-robin matches and empty standings', async () => {
    await players.addEntries(sub('WD'), 0, 9);
    const preview = await post(`/sub-events/${sub('WD')}/draws/preview`, { kind: 'GROUP' }).expect(200);
    expect(preview.body.data.params).toMatchObject({ groupCount: 3, groupSize: 4, advancePerGroup: 2 });
    expect((await generate('WD', { kind: 'MAIN' }).expect(422)).body.error.code).toBe('KIND_NOT_ALLOWED');
    expect((await generate('MS', { kind: 'GROUP' }).expect(422)).body.error.code).toBe('KIND_NOT_ALLOWED');

    const res = await generate('WD', { kind: 'GROUP' }).expect(201);
    const drawId = res.body.data.id as string;
    expect(res.body.data).toMatchObject({ kind: 'GROUP', groupCount: 3, advancePerGroup: 2, matchCount: 9 });
    expect(await kit.prisma.groupStanding.count({ where: { group: { drawId } } })).toBe(9);

    const groups = (await kit.get(`${API}/draws/${drawId}/groups`, adminCookie).expect(200)).body.data.groups;
    expect(groups.map((g: { code: string }) => g.code)).toEqual(['A', 'B', 'C']);
    for (const g of groups) {
      expect(g.members).toHaveLength(3);
      expect(g.standings).toHaveLength(3);
      expect(g.rounds.map((r: { code: string }) => r.code)).toEqual(['GR1', 'GR2', 'GR3']);
      expect(g.matches).toHaveLength(3);
      expect(g.matches[0].side1.displayName).toContain('Draw');
    }
    const matchNos = await kit.prisma.match.findMany({ where: { drawId }, select: { matchNo: true } });
    expect(new Set(matchNos.map((m) => m.matchNo)).size).toBe(9);
  });

  describe('qualifying', () => {
    let qualifyingId: string;
    let mainId: string;
    let qualifyingEntries: string[];

    beforeAll(async () => {
      await players.addEntries(sub('WS'), 0, 6);
      qualifyingEntries = await players.addEntries(sub('WS'), 6, 10, { stage: 'QUALIFYING' });
    }, 60_000);

    it('builds the qualifying sections and reserves matching Q slots in the main draw', async () => {
      const q = await generate('WS', { kind: 'QUALIFYING', qualifierCount: 2 }).expect(201);
      qualifyingId = q.body.data.id;
      expect(q.body.data).toMatchObject({ kind: 'QUALIFYING', qualifierCount: 2, byeCount: 6 });
      expect(await kit.prisma.round.count({ where: { drawId: qualifyingId, scopeKey: 'S2' } })).toBe(3);

      const main = await generate('WS', { kind: 'MAIN' }).expect(201);
      mainId = main.body.data.id;
      expect(main.body.data).toMatchObject({ size: 8, qualifierCount: 2, byeCount: 0 });
      expect((await dbPositions(mainId)).filter((p) => p.source === 'QUALIFIER')).toHaveLength(2);
      const mismatch = await generate('WS', { kind: 'QUALIFYING', qualifierCount: 3 }).expect(409);
      expect(mismatch.body.error.code).toBe('QUALIFIER_COUNT_MISMATCH');
    });

    it('refuses to place qualifiers until every section final is official, then fills Q slots with the seeded RNG', async () => {
      const pending = await post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: 0 }).expect(409);
      expect(pending.body.error).toMatchObject({ code: 'QUALIFYING_NOT_FINISHED' });

      const winners = [qualifyingEntries[0]!, qualifyingEntries[7]!];
      for (const [i, winner] of winners.entries()) {
        const final = await kit.prisma.match.findFirstOrThrow({ where: { drawId: qualifyingId, section: i + 1, nextMatchId: null } });
        await kit.prisma.match.update({ where: { id: final.id }, data: { side1EntryId: winner, status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1 } });
      }
      await post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: 9 }).expect(409);

      const before = await dbPositions(mainId);
      const asData: BracketPositionData[] = before.map((p) => ({
        section: p.section,
        position: p.position,
        source: p.source,
        ...(p.entryId && { entryId: p.entryId }),
        ...(p.sourceRef && { sourceRef: p.sourceRef as BracketPositionData['sourceRef'] }),
      }));

      const res = await post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: 0 }).expect(200);
      expect(res.body.data.version).toBe(1);
      // Placement uses its own random seed, kept in the audit row so a dispute can replay it.
      const { placementSeed } = (await audits(mainId, 'draw.placeQualifiers'))[0]!.after as { placementSeed: string };
      const expected = fillQualifierSlots(asData, winners, createRng(placementSeed));
      const after = await dbPositions(mainId);
      expect(after.some((p) => p.source === 'QUALIFIER')).toBe(false);
      expect(after.map((p) => p.entryId)).toEqual(expected.map((p) => p.entryId));
      const r1 = await kit.prisma.match.findMany({ where: { drawId: mainId, round: { number: 1 } } });
      expect(r1.every((m) => m.side1EntryId && m.side2EntryId && !m.side1Source && !m.side2Source)).toBe(true);
      expect((await audits(mainId, 'draw.placeQualifiers'))[0]!.after).toMatchObject({ qualifierEntryIds: winners });
      const again = await post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: 1 }).expect(409);
      expect(again.body.error.code).toBe('NO_QUALIFIER_SLOTS');
    });
  });
});
