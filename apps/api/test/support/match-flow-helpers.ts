import type { Response } from 'supertest';
import type { AuthTestKit } from './auth-test-kit.js';
import { API } from './entries-fixtures.js';

export interface ScoreFormat {
  bestOf: number;
  pointsPerGame: number;
  winBy: number;
}

/** A straight win for `side` in the given format. */
export const straightWin = (f: ScoreFormat, side: 1 | 2) =>
  Array.from({ length: Math.ceil(f.bestOf / 2) }, () => (side === 1 ? { score1: f.pointsPerGame, score2: 0 } : { score1: 0, score2: f.pointsPerGame }));

/** Same winner as `straightWin`, but the loser takes the first game, so the score differs. */
export const winWithOneGameLost = (f: ScoreFormat, side: 1 | 2) => {
  const lost = side === 1 ? { score1: 5, score2: f.pointsPerGame } : { score1: f.pointsPerGame, score2: 5 };
  return [lost, ...straightWin(f, side)];
};

/** Thin wrapper over the admin match endpoints used by the result lifecycle specs. */
export class MatchApi {
  constructor(
    private readonly kit: AuthTestKit,
    private readonly cookie: string,
  ) {}

  post(path: string, body: object = {}, cookie = this.cookie) {
    return this.kit.write('post', `${API}${path}`, cookie, body);
  }

  async detail(id: string) {
    return (await this.kit.get(`${API}/matches/${id}`, this.cookie).expect(200)).body.data;
  }

  /** Confirms with a straight win for `side` at the current version. */
  async win(id: string, side: 1 | 2 = 1): Promise<Response> {
    const m = await this.detail(id);
    return this.post(`/matches/${id}/confirm`, { expectedVersion: m.version, resultType: 'NORMAL', games: straightWin(m.format, side) });
  }

  /** Confirms, with side 1 winning, every match of the draw whose two sides are known, until none is left. */
  async playAllReady(drawId: string, only?: (m: { id: string; section: number }) => boolean) {
    for (;;) {
      const ready = (
        await this.kit.prisma.match.findMany({
          where: { drawId, status: 'SCHEDULED', side1EntryId: { not: null }, side2EntryId: { not: null }, resultType: null },
          orderBy: [{ round: { number: 'asc' } }, { orderInRound: 'asc' }],
        })
      ).filter((m) => !only || only(m));
      if (!ready.length) return;
      for (const m of ready) await this.win(m.id, 1).then((r) => r.status === 200 || Promise.reject(new Error(JSON.stringify(r.body))));
    }
  }
}

export const stepUp = async (kit: AuthTestKit, cookie: string, password: string) => {
  await kit.write('post', '/api/v1/auth/step-up', cookie, { password }).expect(200);
};
