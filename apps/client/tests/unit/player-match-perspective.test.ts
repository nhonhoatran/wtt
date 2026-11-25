import { describe, expect, it } from 'vitest';
import { playerPerspective } from '../../src/lib/player-match-perspective';

const side = (...slugs: Array<string | null>) => ({ seed: null, quota: null, players: slugs.map((slug, i) => ({ slug, name: `P${i}`, nameEn: null, club: null })) });
const games = [{ number: 1, score1: 11, score2: 7 }, { number: 2, score1: 9, score2: 11 }];

describe('playerPerspective', () => {
  it('reads a singles win from side 1', () => {
    const r = playerPerspective({ side1: side('p-a'), side2: side('p-b'), winnerSide: 1, games1: 3, games2: 1, games }, 'p-a');
    expect(r).toMatchObject({ ownSide: 1, outcome: 'win', ownGames: 3, opponentGames: 1 });
    expect(r.opponent?.players[0]?.slug).toBe('p-b');
    expect(r.partner).toBeNull();
    expect(r.games).toEqual([{ number: 1, own: 11, opponent: 7 }, { number: 2, own: 9, opponent: 11 }]);
  });

  it('flips scores and outcome when the player is side 2', () => {
    const r = playerPerspective({ side1: side('p-b'), side2: side('p-a'), winnerSide: 1, games1: 3, games2: 1, games }, 'p-a');
    expect(r).toMatchObject({ ownSide: 2, outcome: 'loss', ownGames: 1, opponentGames: 3 });
    expect(r.games[0]).toEqual({ number: 1, own: 7, opponent: 11 });
  });

  it('finds the player inside a doubles pair', () => {
    const r = playerPerspective({ side1: side('p-x', 'p-y'), side2: side('p-a', null), winnerSide: 2, games1: 0, games2: 3, games: [] }, 'p-a');
    expect(r).toMatchObject({ ownSide: 2, outcome: 'win' });
    expect(r.opponent?.players).toHaveLength(2);
    expect(r.partner?.players).toEqual([{ slug: null, name: 'P1', nameEn: null, club: null }]);
  });

  it('keeps a walkover win and an undecided match apart', () => {
    expect(playerPerspective({ side1: side('p-a'), side2: side('p-b'), winnerSide: 1, games1: null, games2: null, games: [] }, 'p-a').outcome).toBe('win');
    expect(playerPerspective({ side1: side('p-a'), side2: side('p-b'), winnerSide: null, games1: null, games2: null, games: [] }, 'p-a').outcome).toBeNull();
  });

  it('returns no side when the player is not in the match', () => {
    expect(playerPerspective({ side1: side('p-b'), side2: null, winnerSide: null, games1: null, games2: null, games: [] }, 'p-a')).toMatchObject({ ownSide: null, opponent: null, outcome: null });
  });
});
