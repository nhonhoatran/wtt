import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { MatchApi, straightWin, winWithOneGameLost } from './support/match-flow-helpers.js';

describe('un-start, save-progress and amend-scores (real Postgres)', () => {
  let kit: AuthTestKit;
  let operatorCookie: string;
  let fx: Fixtures;
  let api: MatchApi;
  let r1: { id: string; version: number }[];

  const dbMatch = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const audit = (entityId: string, action: string) => kit.prisma.auditLog.findMany({ where: { entityId, action } });
  const op = (path: string, body: object) => api.post(path, body);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    api = new MatchApi(kit, operatorCookie);
    fx = await createEventFixtures(kit, adminCookie, ['MS']);
    await new DrawFixtureKit(kit, adminCookie, fx).addEntries(fx.subEvents.MS!, 0, 8);
    const created = await kit.write('post', `${API}/sub-events/${fx.subEvents.MS}/draws`, adminCookie, { kind: 'MAIN' }).expect(201);
    await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
    r1 = await kit.prisma.match.findMany({ where: { drawId: created.body.data.id, round: { number: 1 } }, orderBy: { orderInRound: 'asc' } });
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    await kit.close();
  }, 60_000);

  describe('save-progress and un-start', () => {
    it('refuses both on a match that is not live', async () => {
      const m = r1[0]!;
      expect((await op(`/matches/${m.id}/save-progress`, { expectedVersion: m.version, games: [] })).status).toBe(409);
      expect((await op(`/matches/${m.id}/un-start`, { expectedVersion: m.version })).status).toBe(409);
    });

    it('stores partial games with a game still in play and bumps the version each time', async () => {
      const m = r1[0]!;
      const started = (await op(`/matches/${m.id}/start`, { expectedVersion: m.version })).body.data;
      const games = [{ score1: 11, score2: 7 }, { score1: 4, score2: 6 }];
      const saved = await op(`/matches/${m.id}/save-progress`, { expectedVersion: started.version, games });
      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject({ status: 'LIVE', version: started.version + 1 });
      expect(saved.body.data.games).toEqual([{ number: 1, ...games[0] }, { number: 2, ...games[1] }]);

      const replaced = await op(`/matches/${m.id}/save-progress`, { expectedVersion: started.version + 1, games: [games[0]] });
      expect(replaced.body.data.games).toHaveLength(1);
      expect(await kit.prisma.game.count({ where: { matchId: m.id } })).toBe(1);
      expect((await audit(m.id, 'match.saveProgress')).length).toBe(2);
    });

    it('rejects an illegal finished game and a stale version', async () => {
      const m = await dbMatch(r1[0]!.id);
      const bad = await op(`/matches/${m.id}/save-progress`, { expectedVersion: m.version, games: [{ score1: 11, score2: 10 }, { score1: 1, score2: 0 }] });
      expect(bad.status).toBe(422);
      expect(bad.body.error.code).toBe('SCORE_INVALID');
      expect(bad.body.error.issues.map((i: { code: string }) => i.code)).toContain('GAME_MARGIN');
      expect((await op(`/matches/${m.id}/save-progress`, { expectedVersion: m.version - 1, games: [] })).status).toBe(409);
      expect(await kit.prisma.game.count({ where: { matchId: m.id } })).toBe(1);
    });

    it('un-start drops the saved games, returns to SCHEDULED and keeps the games in the audit row', async () => {
      const m = await dbMatch(r1[0]!.id);
      const res = await op(`/matches/${m.id}/un-start`, { expectedVersion: m.version });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'SCHEDULED', version: m.version + 1, games: [] });
      expect(await dbMatch(m.id)).toMatchObject({ startedAt: null });
      const [row] = await audit(m.id, 'match.unStart');
      expect((row!.before as { games: unknown[] }).games).toHaveLength(1);
      expect((await op(`/matches/${m.id}/un-start`, { expectedVersion: m.version + 1 })).status).toBe(409);
    });
  });

  describe('amend-scores', () => {
    let match: { id: string };
    let format: { bestOf: number; pointsPerGame: number; winBy: number };

    beforeAll(async () => {
      match = r1[1]!;
      format = (await api.detail(match.id)).format;
      expect((await api.win(match.id, 1)).status).toBe(200);
    });

    const amend = async (body: object) => op(`/matches/${match.id}/amend-scores`, { expectedVersion: (await dbMatch(match.id)).version, reason: 'typo in game scores', ...body });

    it('changes the games but not the winner, keeping the official stamp and recording the reason', async () => {
      const before = await dbMatch(match.id);
      const res = await amend({ games: winWithOneGameLost(format, 1) });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'OFFICIAL', winnerSide: 1, games1: 3, games2: 1, version: before.version + 1 });
      expect(res.body.data.games).toHaveLength(4);
      const after = await dbMatch(match.id);
      expect(after.officialAt).toEqual(before.officialAt);
      expect(after.officialById).toBe(before.officialById);
      const [row] = await audit(match.id, 'match.amend');
      expect(row!.reason).toBe('typo in game scores');
      expect((row!.before as { games: unknown[] }).games).toHaveLength(3);
    });

    it('answers 400 MATCH_WINNER_CHANGED when the new scores make the other side win', async () => {
      const before = await dbMatch(match.id);
      const res = await amend({ games: straightWin(format, 2) });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MATCH_WINNER_CHANGED');
      expect(await dbMatch(match.id)).toMatchObject({ version: before.version, winnerSide: 1 });
    });

    it('validates reason, scores, version and state', async () => {
      expect((await amend({ reason: 'ab', games: straightWin(format, 1) })).status).toBe(422);
      const invalid = await amend({ games: [{ score1: 11, score2: 10 }] });
      expect(invalid.status).toBe(422);
      expect(invalid.body.error.code).toBe('SCORE_INVALID');
      expect((await amend({ expectedVersion: 0, games: straightWin(format, 1) })).status).toBe(409);
      const scheduled = r1[2]!;
      const wrongState = await op(`/matches/${scheduled.id}/amend-scores`, { expectedVersion: scheduled.version, reason: 'typo', games: straightWin(format, 1) });
      expect(wrongState.status).toBe(409);
      expect(wrongState.body.error.code).toBe('MATCH_STATE_INVALID');
    });

    it('does not touch the match that was fed by this winner', async () => {
      const row = await dbMatch(match.id);
      const next = await dbMatch(row.nextMatchId!);
      await amend({ games: winWithOneGameLost(format, 1) }).then((r) => expect(r.status).toBe(200));
      expect((await dbMatch(next.id)).version).toBe(next.version);
    });
  });
});
