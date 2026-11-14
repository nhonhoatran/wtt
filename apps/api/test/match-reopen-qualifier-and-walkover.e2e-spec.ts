import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { MatchApi, stepUp } from './support/match-flow-helpers.js';

describe('reopen: qualifier slots and walkover markers (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let adminCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let api: MatchApi;

  const sub = (code: string) => fx.subEvents[code]!;
  const dbMatch = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const reopen = async (id: string, body: object = {}) => api.post(`/matches/${id}/reopen`, { expectedVersion: (await dbMatch(id)).version, reason: 'wrong result entered', ...body });
  const previewOf = async (id: string) => (await kit.get(`${API}/matches/${id}/reopen-preview`, adminCookie).expect(200)).body.data;
  const publishedDraw = async (code: string, body: object) => {
    const created = await kit.write('post', `${API}/sub-events/${sub(code)}/draws`, adminCookie, body).expect(201);
    await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
    return created.body.data.id as string;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    api = new MatchApi(kit, adminCookie);
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
    await stepUp(kit, adminCookie, admin.password);
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    await kit.close();
  }, 60_000);

  describe('qualifier slot of the main draw', () => {
    let qualifyingId: string;
    let mainId: string;
    let finalS1: string;

    const positions = () => kit.prisma.bracketPosition.findMany({ where: { drawId: mainId }, orderBy: { position: 'asc' } });

    beforeAll(async () => {
      await players.addEntries(sub('WS'), 0, 6);
      await players.addEntries(sub('WS'), 6, 10, { stage: 'QUALIFYING' });
      qualifyingId = await publishedDraw('WS', { kind: 'QUALIFYING', qualifierCount: 2 });
      mainId = await publishedDraw('WS', { kind: 'MAIN' });
      await api.playAllReady(qualifyingId);
      const draw = await kit.prisma.draw.findUniqueOrThrow({ where: { id: mainId } });
      await api.post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: draw.version }).then((r) => expect(r.status).toBe(200));
      finalS1 = (await kit.prisma.match.findFirstOrThrow({ where: { drawId: qualifyingId, section: 1, nextMatchId: null } })).id;
    }, 120_000);

    it('keeps the Q label on a seated slot, previews it, and reopening the section final frees the same slot', async () => {
      const final = await dbMatch(finalS1);
      const winner = final.winnerSide === 1 ? final.side1EntryId! : final.side2EntryId!;
      const seat = (await positions()).find((p) => p.entryId === winner)!;
      expect(seat.sourceRef).toMatchObject({ type: 'QUALIFIER' });
      const r1 = await kit.prisma.match.findFirstOrThrow({ where: { drawId: mainId, round: { number: 1 }, orderInRound: Math.ceil(seat.position / 2) } });

      const view = await previewOf(finalS1);
      expect(view.blocking).toEqual([]);
      expect(view.affected).toMatchObject([{ matchId: r1.id, entryId: winner, effect: 'CLEAR_SIDE', via: 'SEAT' }]);

      expect((await reopen(finalS1)).status).toBe(200);

      const after = (await positions()).find((p) => p.id === seat.id)!;
      expect(after).toMatchObject({ source: 'QUALIFIER', entryId: null, sourceRef: seat.sourceRef });
      const r1After = await dbMatch(r1.id);
      const sideKey = seat.position % 2 === 1 ? 'side1' : 'side2';
      expect(r1After[`${sideKey}EntryId`]).toBeNull();
      expect(r1After[`${sideKey}Source`]).toEqual(seat.sourceRef);
      expect((await dbMatch(finalS1)).status).toBe('LIVE');
    });

    it('places the new section winner into the freed slot once the final is confirmed again', async () => {
      expect((await api.win(finalS1, 2)).status).toBe(200);
      const draw = await kit.prisma.draw.findUniqueOrThrow({ where: { id: mainId } });
      const res = await api.post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: draw.version });
      expect(res.status).toBe(200);
      const final = await dbMatch(finalS1);
      expect((await positions()).filter((p) => p.source === 'QUALIFIER')).toHaveLength(0);
      expect((await positions()).some((p) => p.entryId === final.side2EntryId)).toBe(true);
    });

    it('answers 409 QUALIFIER_SLOT_MISMATCH when a freed slot cannot be matched to an unseated winner', async () => {
      expect((await reopen(finalS1)).status).toBe(200);
      expect((await api.win(finalS1, 2)).status).toBe(200);
      // A second slot is left open (as if a seat had been vacated by other means), so slots and unseated winners differ.
      const other = (await positions()).find((p) => p.source === 'ENTRY' && !p.sourceRef)!;
      await kit.prisma.bracketPosition.update({ where: { id: other.id }, data: { source: 'QUALIFIER', entryId: null } });
      const draw = await kit.prisma.draw.findUniqueOrThrow({ where: { id: mainId } });
      const res = await api.post(`/draws/${mainId}/place-qualifiers`, { expectedVersion: draw.version });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('QUALIFIER_SLOT_MISMATCH');
    });
  });

  describe('walkover marker of a withdrawn winner', () => {
    let drawId: string;
    let r1a: string;
    let r1b: string;
    let semi: string;
    let withdrawn: string;

    beforeAll(async () => {
      await players.addEntries(sub('MS'), 20, 8);
      drawId = await publishedDraw('MS', { kind: 'MAIN' });
      const r1 = await kit.prisma.match.findMany({ where: { drawId, round: { number: 1 } }, orderBy: { orderInRound: 'asc' } });
      [r1a, r1b, semi] = [r1[0]!.id, r1[1]!.id, r1[0]!.nextMatchId!];
      withdrawn = r1[0]!.side1EntryId!;
      expect((await api.win(r1a, 1)).status).toBe(200);
      const draw = await kit.prisma.draw.findUniqueOrThrow({ where: { id: drawId } });
      await api.post(`/draws/${drawId}/withdraw-entry`, { entryId: withdrawn, reason: 'injury', expectedVersion: draw.version }).then((r) => expect(r.status).toBe(200));
    }, 60_000);

    it('drops the walkover when the withdrawn winner is taken out of the next match', async () => {
      expect(await dbMatch(semi)).toMatchObject({ status: 'SCHEDULED', resultType: 'WALKOVER', winnerSide: 2 });
      expect((await reopen(r1a)).status).toBe(200);
      expect(await dbMatch(semi)).toMatchObject({ status: 'SCHEDULED', resultType: null, winnerSide: null, side1EntryId: null });
    });

    it('lets the other player advance normally with no leftover walkover', async () => {
      expect((await api.win(r1a, 2)).status).toBe(200);
      const row = await dbMatch(r1a);
      expect(await dbMatch(semi)).toMatchObject({ resultType: null, winnerSide: null, side1EntryId: row.side2EntryId });
    });

    it('re-applies the walkover when the withdrawn entry wins again, and settles it once the opponent arrives', async () => {
      expect((await reopen(r1a)).status).toBe(200);
      expect((await api.win(r1a, 1)).status).toBe(200);
      expect(await dbMatch(semi)).toMatchObject({ status: 'SCHEDULED', resultType: 'WALKOVER', winnerSide: 2, side1EntryId: withdrawn });
      expect((await api.win(r1b, 1)).status).toBe(200);
      const settled = await dbMatch(semi);
      expect(settled).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: 2, officialById: null });
      expect((await dbMatch(settled.nextMatchId!))[settled.nextMatchSide === 1 ? 'side1EntryId' : 'side2EntryId']).toBe(settled.side2EntryId);
    });

    it('reopening the match behind a settled walkover reverts it and pulls the opponent out of the final', async () => {
      const settled = await dbMatch(semi);
      const view = await previewOf(r1a);
      expect(view.blocking).toEqual([]);
      expect(view.affected.map((c: { matchId: string; effect: string }) => [c.matchId, c.effect])).toEqual([
        [semi, 'REVERT_AUTO'],
        [settled.nextMatchId, 'CLEAR_SIDE'],
      ]);
      expect((await reopen(r1a)).status).toBe(200);
      expect(await dbMatch(semi)).toMatchObject({ status: 'SCHEDULED', resultType: null, winnerSide: null, side1EntryId: null, side2EntryId: settled.side2EntryId, officialAt: null });
      const final = await dbMatch(settled.nextMatchId!);
      expect(final.side1EntryId ?? final.side2EntryId).toBeNull();
    });
  });
});
