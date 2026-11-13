import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupDraws, playOutKnockout } from './support/draw-play-helpers.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';

describe('withdrawn entries across draws (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;

  const sub = (code: string) => fx.subEvents[code]!;
  const post = (path: string, body: object = {}) => kit.write('post', `${API}${path}`, adminCookie, body);
  const generate = (code: string, body: object) => post(`/sub-events/${sub(code)}/draws`, body);
  const matchesOf = (drawId: string) =>
    kit.prisma.match.findMany({ where: { drawId }, include: { round: true }, orderBy: [{ round: { number: 'asc' } }, { orderInRound: 'asc' }] });
  const withdrawAt = (drawId: string, entryId: string, version: number, extra: object = {}) =>
    post(`/draws/${drawId}/withdraw-entry`, { entryId, reason: 'withdrawn', expectedVersion: version, ...extra });
  const version = async (drawId: string) => (await kit.prisma.draw.findUniqueOrThrow({ where: { id: drawId } })).version;
  const matchOf = async (drawId: string, entryId: string) =>
    (await matchesOf(drawId)).find((m) => m.side1EntryId === entryId || m.side2EntryId === entryId)!;

  /** QUALIFYING (4 players, 1 slot) published and played out; MAIN (5 players + 1 slot) published. */
  async function qualifyingAndMain(code: string) {
    await players.addEntries(sub(code), 0, 4, { stage: 'QUALIFYING' });
    await players.addEntries(sub(code), 4, 5);
    const qualifying = (await generate(code, { kind: 'QUALIFYING', qualifierCount: 1 }).expect(201)).body.data.id as string;
    await post(`/draws/${qualifying}/publish`, { expectedVersion: 0 }).expect(200);
    const main = (await generate(code, { kind: 'MAIN', seedCount: 0 }).expect(201)).body.data.id as string;
    await post(`/draws/${main}/publish`, { expectedVersion: 0 }).expect(200);
    await playOutKnockout(kit, qualifying);
    const final = (await matchesOf(qualifying)).find((m) => m.nextMatchId === null)!;
    return { qualifying, main, winner: final.side1EntryId! };
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS', 'MD', 'XD']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
      await cleanupFixtures(kit, fx);
      await kit.close();
    }
  }, 60_000);

  it('H1: a qualifier withdrawn before placement is placed and loses the first MAIN match by walkover', async () => {
    const { qualifying, main, winner } = await qualifyingAndMain('MS');
    const res = await withdrawAt(qualifying, winner, await version(qualifying)).expect(200);
    expect(res.body.data.impacts).toEqual([]);

    await post(`/draws/${main}/place-qualifiers`, { expectedVersion: await version(main) }).expect(200);
    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: main, action: 'draw.placeQualifiers' } });
    expect(audit.after).toHaveProperty('placementSeed');
    expect(audit.after).not.toHaveProperty('randomSeed');
    const match = await matchOf(main, winner);
    const opponent = match.side1EntryId === winner ? match.side2EntryId : match.side1EntryId;
    expect(match).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: match.side1EntryId === winner ? 2 : 1 });
    const next = (await matchesOf(main)).find((m) => m.id === match.nextMatchId)!;
    expect([next.side1EntryId, next.side2EntryId]).toContain(opponent);
  });

  it('H1: withdrawing a placed qualifier at QUALIFYING also settles the MAIN match in one call', async () => {
    const { qualifying, main, winner } = await qualifyingAndMain('WS');
    await post(`/draws/${main}/place-qualifiers`, { expectedVersion: await version(main) }).expect(200);
    const mainVersion = await version(main);

    const res = await withdrawAt(qualifying, winner, await version(qualifying)).expect(200);
    expect(res.body.data.impacts).toMatchObject([{ type: 'WALKOVER', removed: { id: winner } }]);
    const match = await matchOf(main, winner);
    expect(match).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: match.side1EntryId === winner ? 2 : 1 });
    expect(await version(main)).toBe(mainVersion + 1);
    expect(await kit.prisma.entry.findUniqueOrThrow({ where: { id: winner } })).toMatchObject({ status: 'WITHDRAWN' });
  });

  it('H1: an entry already WITHDRAWN but with an unfinished match can still be finished, once', async () => {
    const entries = await players.addEntries(sub('MD'), 0, 6, { seeds: 2 });
    const drawId = (await generate('MD', { kind: 'MAIN', seedCount: 2 }).expect(201)).body.data.id as string;
    await post(`/draws/${drawId}/publish`, { expectedVersion: 0 }).expect(200);
    const leaver = entries[5]!;
    await kit.prisma.entry.update({ where: { id: leaver }, data: { status: 'WITHDRAWN' } });

    const res = await withdrawAt(drawId, leaver, await version(drawId)).expect(200);
    expect(res.body.data.impacts).toMatchObject([{ type: 'WALKOVER', removed: { id: leaver } }]);
    expect(await matchOf(drawId, leaver)).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER' });
    const again = await withdrawAt(drawId, leaver, await version(drawId)).expect(409);
    expect(again.body.error.code).toBe('ENTRY_ALREADY_WITHDRAWN');
  });

  describe('publish gate and unpublish round trip', () => {
    let entries: string[];
    let drawId: string;

    beforeAll(async () => {
      entries = await players.addEntries(sub('XD'), 0, 6, { seeds: 2 });
      drawId = (await generate('XD', { kind: 'MAIN', seedCount: 2 }).expect(201)).body.data.id as string;
    });

    it('H2: refuses to publish a draft that has a withdrawn or missing entry, reporting both lists', async () => {
      await kit.write('patch', `${API}/entries/${entries[5]}`, adminCookie, { status: 'WITHDRAWN' }).expect(200);
      const [added] = await players.addEntries(sub('XD'), 6, 1);
      const res = await post(`/draws/${drawId}/publish`, { expectedVersion: 0 }).expect(409);
      expect(res.body.error).toMatchObject({ code: 'DRAW_STALE_ENTRIES', withdrawnEntryIds: [entries[5]], missingEntryIds: [added] });

      await generate('XD', { kind: 'MAIN', seedCount: 2, expectedVersion: 0 }).expect(201);
      await post(`/draws/${drawId}/publish`, { expectedVersion: 1 }).expect(200);
    });

    it('M5: a pending walkover follows the withdrawn entry after unpublish and swap, not the position', async () => {
      const seed1 = entries[0]!;
      const withdrawn = await withdrawAt(drawId, seed1, 2).expect(200);
      expect(withdrawn.body.data.impacts).toMatchObject([{ type: 'WALKOVER', roundCode: 'SF' }]);
      await post(`/draws/${drawId}/unpublish`, { expectedVersion: 3, reason: 'rebuild the draft' }).expect(200);

      const positions = await kit.prisma.bracketPosition.findMany({ where: { drawId }, orderBy: { position: 'asc' } });
      const seedPosition = positions.find((p) => p.entryId === seed1)!;
      const free = positions.find((p) => p.source === 'ENTRY' && p.entryId && !entries.slice(0, 2).includes(p.entryId) && p.position > 2)!;
      await post(`/draws/${drawId}/swap`, { positionA: seedPosition.id, positionB: free.id, expectedVersion: 4 }).expect(200);

      const draft = await matchesOf(drawId);
      const firstRound = draft.find((m) => m.round.number === 1 && (m.side1EntryId === seed1 || m.side2EntryId === seed1))!;
      expect(firstRound).toMatchObject({ resultType: 'WALKOVER', status: 'SCHEDULED' });
      const semi = draft.find((m) => m.round.number === 2 && (m.side1EntryId === free.entryId || m.side2EntryId === free.entryId))!;
      expect(semi.resultType).toBeNull();

      await post(`/draws/${drawId}/publish`, { expectedVersion: 5 }).expect(200);
      const published = await matchesOf(drawId);
      const opponentSide = firstRound.side1EntryId === seed1 ? 2 : 1;
      expect(published.find((m) => m.id === firstRound.id)).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: opponentSide });
      const opponent = opponentSide === 1 ? firstRound.side1EntryId : firstRound.side2EntryId;
      const after = published.find((m) => m.id === semi.id)!;
      expect(after).toMatchObject({ status: 'SCHEDULED', resultType: null, winnerSide: null });
      expect([after.side1EntryId, after.side2EntryId].sort()).toEqual([free.entryId, opponent].sort());
    });
  });
});
