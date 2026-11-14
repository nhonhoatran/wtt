import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { MatchApi, stepUp } from './support/match-flow-helpers.js';

describe('reopen a confirmed match (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let api: MatchApi;

  const sub = (code: string) => fx.subEvents[code]!;
  const dbMatch = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const audit = (entityId: string, action: string) => kit.prisma.auditLog.findMany({ where: { entityId, action } });
  const preview = (id: string, cookie = adminCookie) => kit.get(`${API}/matches/${id}/reopen-preview`, cookie);
  const reopen = async (id: string, body: object = {}, cookie = adminCookie) => {
    const m = await dbMatch(id);
    return api.post(`/matches/${id}/reopen`, { expectedVersion: m.version, reason: 'score entered for the wrong match', ...body }, cookie);
  };
  const publishedDraw = async (code: string, body: object) => {
    const created = await kit.write('post', `${API}/sub-events/${sub(code)}/draws`, adminCookie, body).expect(201);
    await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
    return created.body.data.id as string;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie, ['MS']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
    api = new MatchApi(kit, adminCookie);
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    await kit.close();
  }, 60_000);

  describe('knockout', () => {
    let drawId: string;
    let a1: string;
    let a2: string;
    let sf: string;
    let final: string;

    beforeAll(async () => {
      await players.addEntries(sub('MS'), 0, 8);
      drawId = await publishedDraw('MS', { kind: 'MAIN' });
      const r1 = await kit.prisma.match.findMany({ where: { drawId, round: { number: 1 } }, orderBy: { orderInRound: 'asc' } });
      [a1, a2] = [r1[0]!.id, r1[1]!.id];
      sf = r1[0]!.nextMatchId!;
      final = (await dbMatch(sf)).nextMatchId!;
    }, 60_000);

    it('keeps reopen away from the results operator and behind step-up', async () => {
      await api.win(a1, 1).then((r) => expect(r.status).toBe(200));
      await preview(a1, operatorCookie).expect(403);
      expect((await reopen(a1, {}, operatorCookie)).status).toBe(403);
      const noStepUp = await reopen(a1);
      expect(noStepUp.status).toBe(403);
      expect(noStepUp.body.error.code).toBe('STEP_UP_REQUIRED');
      await stepUp(kit, adminCookie, admin.password);
    });

    it('previews and reopens a match whose winner has not played on: the winner leaves the next match', async () => {
      const before = await dbMatch(a1);
      const next = await dbMatch(sf);
      const slot = before.nextMatchSide === 1 ? 'side1EntryId' : 'side2EntryId';
      expect(next[slot]).toBe(before.side1EntryId);

      const view = (await preview(a1).expect(200)).body.data;
      expect(view.blocking).toEqual([]);
      expect(view.affected).toMatchObject([{ matchId: sf, matchNo: next.matchNo, entryId: before.side1EntryId, effect: 'CLEAR_SIDE', via: 'ADVANCE' }]);
      expect(view.affected[0].entryName).toBeTruthy();

      const dirtyBefore = (await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: sub('MS') } })).rankingDirtyAt;
      expect((await reopen(a1, { expectedVersion: before.version + 5 })).status).toBe(409);
      expect((await reopen(a1, { reason: 'x' })).status).toBe(422);
      const res = await reopen(a1);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'LIVE', winnerSide: null, version: before.version + 1 });
      expect(res.body.data.games).toHaveLength(3);

      const after = await dbMatch(sf);
      expect(after[slot]).toBeNull();
      expect(after[before.nextMatchSide === 1 ? 'side1Source' : 'side2Source']).toEqual({ type: 'WINNER_OF', matchNo: before.matchNo });
      expect(after.version).toBe(next.version + 1);
      const [row] = await audit(a1, 'match.reopen');
      expect(row!.reason).toBe('score entered for the wrong match');
      expect(row!.after).toMatchObject({ status: 'LIVE', preview: { blocking: [] } });
      const dirtyAfter = (await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: sub('MS') } })).rankingDirtyAt;
      expect(dirtyAfter!.getTime()).toBeGreaterThan(dirtyBefore?.getTime() ?? 0);
    });

    it('lets the reopened match be confirmed again with the other player winning', async () => {
      expect((await api.win(a1, 2)).status).toBe(200);
      const row = await dbMatch(a1);
      const next = await dbMatch(sf);
      expect(next[row.nextMatchSide === 1 ? 'side1EntryId' : 'side2EntryId']).toBe(row.side2EntryId);
    });

    it('refuses to reopen a match that is not official', async () => {
      const open = await dbMatch(final);
      const res = await reopen(final);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MATCH_STATE_INVALID');
      expect((await dbMatch(final)).version).toBe(open.version);
    });

    it('answers 409 with the preview when a later match was played, and writes nothing', async () => {
      expect((await api.win(a2, 1)).status).toBe(200);
      expect((await api.win(sf, 1)).status).toBe(200);
      const root = await dbMatch(a1);
      const semi = await dbMatch(sf);

      const view = (await preview(a1).expect(200)).body.data;
      expect(view.blocking.map((c: { matchId: string }) => c.matchId)).toEqual([sf]);
      expect(view.affected.map((c: { matchId: string }) => c.matchId)).toEqual([final]);

      const res = await reopen(a1);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REOPEN_BLOCKED');
      expect(res.body.error.preview.blocking[0]).toMatchObject({ matchId: sf, status: 'OFFICIAL', effect: 'RESET_RESULT' });
      expect(await dbMatch(a1)).toMatchObject({ status: 'OFFICIAL', version: root.version });
      expect(await dbMatch(sf)).toMatchObject({ status: 'OFFICIAL', version: semi.version });
    });

    it('requires the previewed blocking list for a forced reopen and rejects a stale one with the fresh preview', async () => {
      const root = await dbMatch(a1);
      const missing = await reopen(a1, { force: true });
      expect(missing.status).toBe(422);
      const stale = await reopen(a1, { force: true, expectedBlockingIds: [] });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('REOPEN_IMPACT_CHANGED');
      expect(stale.body.error.preview.blocking.map((c: { matchId: string }) => c.matchId)).toEqual([sf]);
      expect(await dbMatch(a1)).toMatchObject({ status: 'OFFICIAL', version: root.version });
    });

    it('forces the reopen as ADMIN: the played match goes back to SCHEDULED and the audit keeps its old result', async () => {
      const semi = await dbMatch(sf);
      const oldGames = await kit.prisma.game.findMany({ where: { matchId: sf }, orderBy: { number: 'asc' } });
      expect(oldGames.length).toBeGreaterThan(0);

      const res = await reopen(a1, { force: true, expectedBlockingIds: [sf] });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('LIVE');
      expect(res.body.impact.blocking).toHaveLength(1);

      expect(await dbMatch(sf)).toMatchObject({
        status: 'SCHEDULED',
        resultType: null,
        winnerSide: null,
        games1: null,
        officialAt: null,
        officialById: null,
        version: semi.version + 1,
      });
      expect(await kit.prisma.game.count({ where: { matchId: sf } })).toBe(0);
      const rootRow = await dbMatch(a1);
      expect((await dbMatch(sf))[rootRow.nextMatchSide === 1 ? 'side1EntryId' : 'side2EntryId']).toBeNull();
      const finalRow = await dbMatch(final);
      expect(finalRow.side1EntryId ?? finalRow.side2EntryId).toBeNull();

      const [row] = await audit(a1, 'match.forceReopen');
      const reset = (row!.after as { reset: { matchNo: number; before: { winnerSide: number; games: unknown[] } }[] }).reset;
      expect(reset).toHaveLength(1);
      expect(reset[0]).toMatchObject({ matchNo: semi.matchNo, before: { winnerSide: 1 } });
      expect(reset[0]!.before.games).toHaveLength(oldGames.length);
      const [resetRow] = await audit(sf, 'match.resetByReopen');
      expect(resetRow!.reason).toBe('score entered for the wrong match');
      expect((resetRow!.before as { games: unknown[] }).games).toHaveLength(oldGames.length);
    });
  });
});
