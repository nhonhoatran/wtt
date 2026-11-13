import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule } from './support/group-test-helpers.js';

interface Format {
  bestOf: number;
  pointsPerGame: number;
  winBy: number;
}

/** A straight win for `side` in the given format. */
const straightWin = (f: Format, side: 1 | 2) =>
  Array.from({ length: Math.ceil(f.bestOf / 2) }, () => (side === 1 ? { score1: f.pointsPerGame, score2: 0 } : { score1: 0, score2: f.pointsPerGame }));

describe('match result entry: start, confirm, advance (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let ruleId: string;

  const sub = (code: string) => fx.subEvents[code]!;
  const post = (path: string, body: object, cookie = operatorCookie) => kit.write('post', `${API}${path}`, cookie, body);
  const detail = async (id: string) => (await kit.get(`${API}/matches/${id}`, operatorCookie).expect(200)).body.data;
  const publishedDraw = async (code: string, body: object) => {
    const created = await kit.write('post', `${API}/sub-events/${sub(code)}/draws`, adminCookie, body).expect(201);
    await kit.write('post', `${API}/draws/${created.body.data.id}/publish`, adminCookie, { expectedVersion: created.body.data.version }).expect(200);
    return created.body.data.id as string;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    const operator = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    operatorCookie = await kit.signIn(operator);
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'MD']);
    players = new DrawFixtureKit(kit, adminCookie, fx);
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
    await kit.close();
  }, 60_000);

  describe('knockout with BYEs', () => {
    let drawId: string;

    beforeAll(async () => {
      await players.addEntries(sub('MS'), 0, 6, { seeds: 2 });
      drawId = await publishedDraw('MS', { kind: 'MAIN', seedCount: 2 });
    });

    const roundOne = async () =>
      kit.prisma.match.findMany({ where: { drawId, round: { number: 1 }, resultType: null }, orderBy: { orderInRound: 'asc' } });

    it('lists real matches only, with readiness', async () => {
      const res = await kit.get(`${API}/events/${fx.eventId}/matches?filter[subEventId]=${sub('MS')}&pageSize=50`, operatorCookie).expect(200);
      const items = res.body.data as { resultType: string | null; ready: boolean; roundCode: string }[];
      expect(items.some((m) => m.resultType === 'BYE')).toBe(false);
      expect(items.filter((m) => m.ready).length).toBeGreaterThanOrEqual(2);
      const open = await kit.get(`${API}/events/${fx.eventId}/matches?filter[status]=OPEN&filter[subEventId]=${sub('MS')}`, operatorCookie).expect(200);
      expect(open.body.total).toBe(res.body.total);
    });

    it('searches by match number', async () => {
      const [first] = await roundOne();
      const res = await kit.get(`${API}/events/${fx.eventId}/matches?q=%23${first!.matchNo}`, operatorCookie).expect(200);
      expect(res.body.data.map((m: { id: string }) => m.id)).toEqual([first!.id]);
    });

    it('starts a match with the expected version only', async () => {
      const [first] = await roundOne();
      await post(`/matches/${first!.id}/start`, { expectedVersion: first!.version + 1 }).expect(409);
      const res = await post(`/matches/${first!.id}/start`, { expectedVersion: first!.version }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'LIVE', version: first!.version + 1 });
      await post(`/matches/${first!.id}/start`, { expectedVersion: first!.version + 1 }).expect(409);
      expect(await kit.prisma.auditLog.count({ where: { entityId: first!.id, action: 'match.start' } })).toBe(1);
    });

    it('rejects an invalid score with the issues', async () => {
      const [first] = await roundOne();
      const res = await post(`/matches/${first!.id}/confirm`, { expectedVersion: first!.version, resultType: 'NORMAL', games: [{ score1: 11, score2: 10 }] }).expect(422);
      expect(res.body.error.code).toBe('SCORE_INVALID');
      expect(res.body.error.issues.map((i: { code: string }) => i.code)).toContain('GAME_MARGIN');
    });

    it('confirms R1, advances the winner into the right R2 slot and records the official', async () => {
      const [first] = await roundOne();
      const m = await detail(first!.id);
      const res = await post(`/matches/${m.id}/confirm`, { expectedVersion: m.version, resultType: 'NORMAL', games: straightWin(m.format, 2) }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'OFFICIAL', winnerSide: 2, games1: 0, games2: Math.ceil(m.format.bestOf / 2) });
      expect(res.body.data.games).toHaveLength(Math.ceil(m.format.bestOf / 2));

      const row = await kit.prisma.match.findUniqueOrThrow({ where: { id: m.id } });
      expect(row.officialById).not.toBeNull();
      const next = await kit.prisma.match.findUniqueOrThrow({ where: { id: row.nextMatchId! } });
      expect(row.nextMatchSide === 1 ? next.side1EntryId : next.side2EntryId).toBe(row.side2EntryId);
      expect(await kit.prisma.auditLog.count({ where: { entityId: m.id, action: 'match.confirm' } })).toBe(1);

      await post(`/matches/${m.id}/confirm`, { expectedVersion: row.version, resultType: 'NORMAL', games: straightWin(m.format, 1) }).expect(409);
    });

    it('a match fed by a BYE winner and an R1 winner becomes ready', async () => {
      const [first] = await kit.prisma.match.findMany({ where: { drawId, round: { number: 1 }, status: 'OFFICIAL', resultType: 'NORMAL' } });
      const next = await detail(first!.nextMatchId!);
      expect(next.side1).not.toBeNull();
      expect(next.side2).not.toBeNull();
      expect(next.ready).toBe(true);
    });

    it('lets exactly one of two concurrent confirms with the same version win', async () => {
      const [second] = await roundOne();
      const m = await detail(second!.id);
      const body = { expectedVersion: m.version, resultType: 'NORMAL', games: straightWin(m.format, 1) };
      const results = await Promise.all([post(`/matches/${m.id}/confirm`, body), post(`/matches/${m.id}/confirm`, body)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await kit.prisma.game.count({ where: { matchId: m.id } })).toBe(Math.ceil(m.format.bestOf / 2));
    });

    it('confirms a walkover without games and refuses a match whose side is still empty', async () => {
      const final = await kit.prisma.match.findFirstOrThrow({ where: { drawId, nextMatchId: null } });
      await post(`/matches/${final.id}/confirm`, { expectedVersion: final.version, resultType: 'WALKOVER', winnerSide: 1, games: [] }).expect(409);

      const semi = (await kit.prisma.match.findMany({ where: { drawId, nextMatchId: final.id }, orderBy: { orderInRound: 'asc' } })).find((s) => s.side1EntryId && s.side2EntryId)!;
      const res = await post(`/matches/${semi.id}/confirm`, { expectedVersion: semi.version, resultType: 'WALKOVER', winnerSide: 1, games: [] }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: 1, games1: 0, games2: 0 });
    });
  });

  describe('group match', () => {
    it('recomputes the group standings in the same transaction', async () => {
      await kit.prisma.subEvent.update({ where: { id: sub('MD') }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId, hasQualifying: false } });
      await players.addEntries(sub('MD'), 10, 3);
      const drawId = await publishedDraw('MD', { kind: 'GROUP' });
      const group = await kit.prisma.group.findFirstOrThrow({ where: { drawId } });
      const match = await kit.prisma.match.findFirstOrThrow({ where: { groupId: group.id } });
      const m = await detail(match.id);
      expect(m.groupCode).toBe(group.code);

      await post(`/matches/${m.id}/confirm`, { expectedVersion: m.version, resultType: 'NORMAL', games: straightWin(m.format, 1) }).expect(200);
      const winner = await kit.prisma.groupStanding.findFirstOrThrow({ where: { groupId: group.id, entryId: match.side1EntryId! } });
      expect(winner).toMatchObject({ played: 1, won: 1 });

      const other = await kit.prisma.match.findFirstOrThrow({ where: { groupId: group.id, status: 'SCHEDULED' } });
      await kit.prisma.match.update({ where: { id: other.id }, data: { isVoided: true } });
      const refused = await post(`/matches/${other.id}/confirm`, { expectedVersion: other.version, resultType: 'NORMAL', games: straightWin(m.format, 1) }).expect(409);
      expect(refused.body.error.code).toBe('MATCH_STATE_INVALID');
      const listed = await kit.get(`${API}/events/${fx.eventId}/matches?filter[subEventId]=${sub('MD')}`, operatorCookie).expect(200);
      expect(listed.body.data.map((x: { id: string }) => x.id)).not.toContain(other.id);
    });
  });

  it('rejects an unauthenticated list request', async () => {
    const res = await kit.get(`${API}/events/${fx.eventId}/matches`).expect(401);
    expect(res.status).toBe(401);
  });
});
