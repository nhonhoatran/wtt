import { describe, expect, it } from 'vitest';
import { checkGame, gamesToWin, validateMatchScore, validateProgressGames, type GameScore, type ScoreFormat } from './match-score-validator.js';

const bo5: ScoreFormat = { bestOf: 5, pointsPerGame: 11, winBy: 2 };
const g = (score1: number, score2: number): GameScore => ({ score1, score2 });
const codes = (games: GameScore[], extra: Partial<Parameters<typeof validateMatchScore>[0]> = {}) =>
  validateMatchScore({ games, format: bo5, resultType: 'NORMAL', ...extra }).issues.map((i) => i.code);

describe('checkGame', () => {
  it.each([
    [11, 0],
    [11, 9],
    [9, 11],
    [12, 10],
    [15, 13],
  ])('accepts %i-%i', (a, b) => expect(checkGame(g(a, b), bo5, 1)).toBeNull());

  it.each([
    [10, 8, 'GAME_NOT_FINISHED'],
    [11, 10, 'GAME_MARGIN'],
    [12, 11, 'GAME_MARGIN'],
    [13, 10, 'GAME_OVERRUN'],
    [12, 9, 'GAME_OVERRUN'],
    [-1, 11, 'GAME_SCORE_INVALID'],
    [11.5, 3, 'GAME_SCORE_INVALID'],
  ])('rejects %d-%d as %s', (a, b, code) => expect(checkGame(g(a, b), bo5, 3)?.code).toBe(code));

  it('names the game and the margin in the message', () => {
    expect(checkGame(g(11, 10), bo5, 3)?.message).toBe('Ván 3: 11–10 chưa đủ cách 2 điểm');
  });

  it('honours a win-by-1 format', () => {
    expect(checkGame(g(21, 20), { bestOf: 3, pointsPerGame: 21, winBy: 1 }, 1)).toBeNull();
    expect(checkGame(g(22, 21), { bestOf: 3, pointsPerGame: 21, winBy: 1 }, 1)?.code).toBe('GAME_OVERRUN');
  });
});

describe('validateMatchScore', () => {
  it('derives the winner and game counts of a normal match', () => {
    const out = validateMatchScore({ games: [g(11, 7), g(9, 11), g(11, 5), g(11, 8)], format: bo5, resultType: 'NORMAL' });
    expect(out).toMatchObject({ valid: true, winnerSide: 1, games1: 3, games2: 1, issues: [] });
  });

  it('accepts deuce games and a side-2 win', () => {
    const out = validateMatchScore({ games: [g(10, 12), g(14, 16), g(11, 9), g(9, 11)], format: bo5, resultType: 'NORMAL' });
    expect(out).toMatchObject({ valid: true, winnerSide: 2, games1: 1, games2: 3 });
  });

  it('requires a decided match', () => {
    expect(codes([g(11, 7), g(11, 5)])).toEqual(['MATCH_NOT_DECIDED']);
    expect(codes([])).toEqual(['MATCH_NOT_DECIDED']);
  });

  it('rejects a game played after the match was decided', () => {
    expect(codes([g(11, 1), g(11, 2), g(11, 3), g(3, 11)])).toEqual(['GAME_AFTER_DECIDED']);
  });

  it('rejects more games than the format allows', () => {
    expect(codes([g(11, 1), g(1, 11), g(11, 1), g(1, 11), g(11, 1), g(11, 1)])).toContain('TOO_MANY_GAMES');
  });

  it('reports an invalid game and does not count it', () => {
    const out = validateMatchScore({ games: [g(11, 7), g(11, 10), g(11, 5), g(11, 8)], format: bo5, resultType: 'NORMAL' });
    expect(out.issues.map((i) => i.game)).toEqual([2]);
    expect(out.games1).toBe(3);
  });

  it('flags a winner that contradicts the games', () => {
    expect(codes([g(11, 1), g(11, 2), g(11, 3)], { winnerSide: 2 })).toEqual(['WINNER_MISMATCH']);
  });

  it('gamesToWin rounds up', () => {
    expect(gamesToWin({ bestOf: 5 })).toBe(3);
    expect(gamesToWin({ bestOf: 4 })).toBe(2);
  });

  describe('walkover', () => {
    it('needs a winner and no games', () => {
      expect(validateMatchScore({ games: [], format: bo5, resultType: 'WALKOVER', winnerSide: 2 })).toMatchObject({ valid: true, winnerSide: 2, games1: 0, games2: 0 });
      expect(codes([], { resultType: 'WALKOVER' })).toEqual(['WINNER_REQUIRED']);
      expect(codes([g(11, 1)], { resultType: 'WALKOVER', winnerSide: 1 })).toEqual(['WALKOVER_HAS_GAMES']);
    });
  });

  describe('retired / disqualified', () => {
    it('lets the winner have fewer games than needed and the last game be partial', () => {
      const out = validateMatchScore({ games: [g(11, 7), g(5, 11), g(6, 3)], format: bo5, resultType: 'RETIRED', winnerSide: 1 });
      expect(out).toMatchObject({ valid: true, winnerSide: 1, games1: 1, games2: 1 });
    });

    it('allows the side behind on games to win', () => {
      expect(validateMatchScore({ games: [g(3, 11), g(3, 11)], format: bo5, resultType: 'DISQUALIFIED', winnerSide: 1 }).valid).toBe(true);
    });

    it('only the last game may be partial', () => {
      expect(codes([g(6, 3), g(11, 5)], { resultType: 'RETIRED', winnerSide: 1 })).toEqual(['GAME_NOT_FINISHED']);
    });

    it('rejects an impossible partial score', () => {
      expect(codes([g(11, 7), g(14, 3)], { resultType: 'RETIRED', winnerSide: 1 })).toEqual(['GAME_OVERRUN']);
    });

    it('needs an explicit winner', () => {
      expect(codes([g(11, 7)], { resultType: 'RETIRED' })).toEqual(['WINNER_REQUIRED']);
    });

    it('rejects a retirement after the match was already decided', () => {
      expect(codes([g(11, 1), g(11, 2), g(11, 3)], { resultType: 'RETIRED', winnerSide: 1 })).toEqual(['MATCH_ALREADY_DECIDED']);
    });
  });
});

describe('validateProgressGames', () => {
  it('accepts finished games followed by a game still in play', () => {
    expect(validateProgressGames([g(11, 7), g(5, 3)], bo5)).toEqual([]);
    expect(validateProgressGames([], bo5)).toEqual([]);
  });

  it('rejects an illegal finished game before the last one', () => {
    expect(validateProgressGames([g(11, 10), g(3, 1)], bo5).map((i) => i.code)).toEqual(['GAME_MARGIN']);
  });

  it('rejects negative or overrun scores even in the last game', () => {
    expect(validateProgressGames([g(-1, 3)], bo5).map((i) => i.code)).toEqual(['GAME_SCORE_INVALID']);
    expect(validateProgressGames([g(14, 9)], bo5).map((i) => i.code)).toEqual(['GAME_OVERRUN']);
  });

  it('rejects games after the match is decided and more games than the format has', () => {
    expect(validateProgressGames([g(11, 0), g(11, 0), g(11, 0), g(2, 1)], bo5).map((i) => i.code)).toEqual(['GAME_AFTER_DECIDED']);
    expect(validateProgressGames(Array.from({ length: 6 }, () => g(1, 0)), bo5).map((i) => i.code)).toContain('TOO_MANY_GAMES');
  });
});
