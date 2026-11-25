import { describe, expect, it } from 'vitest';
import type { PublicBracketMatch, PublicBracketRound } from '@kamito/shared';
import { championSide, defaultRound, finalMatch, followUpMatch, locateMatch, nextMatchByNo, parseRoundParam, pathToMatch, pickRound, roundDay, roundParamKey, roundProgress } from '../../src/lib/bracket-derivations';

const side = (name: string) => ({ seed: null, quota: null, players: [{ name, nameEn: null, club: null, slug: null }] });

function match(matchNo: number, orderInRound: number, extra: Partial<PublicBracketMatch> = {}): PublicBracketMatch {
  return {
    matchNo, orderInRound, status: 'SCHEDULED', resultType: null, winnerSide: null, games1: null, games2: null,
    scheduledAt: null, table: null, side1: null, side2: null, side1Source: null, side2Source: null, games: [], ...extra,
  };
}

/** Knockout of `size` slots with WINNER_OF links, like the published draws. */
function knockout(size: number, overrides: Record<number, Partial<PublicBracketMatch>> = {}): PublicBracketRound[] {
  const rounds: PublicBracketRound[] = [];
  let matchNo = 0;
  let previous: PublicBracketMatch[] = [];
  for (let slots = size; slots >= 2; slots /= 2) {
    const current = Array.from({ length: slots / 2 }, (_, i) => {
      const no = ++matchNo;
      const feeders = slots === size ? null : [previous[i * 2]!, previous[i * 2 + 1]!];
      return match(no, i + 1, {
        side1: feeders ? null : side(`A${no}`), side2: feeders ? null : side(`B${no}`),
        side1Source: feeders ? { type: 'WINNER_OF', matchNo: feeders[0]!.matchNo } : null,
        side2Source: feeders ? { type: 'WINNER_OF', matchNo: feeders[1]!.matchNo } : null,
        ...overrides[no],
      });
    });
    rounds.push({ code: slots === 2 ? 'F' : slots === 4 ? 'SF' : slots === 8 ? 'QF' : `R${slots}`, number: rounds.length + 1, matches: current });
    previous = current;
  }
  return rounds;
}

describe('nextMatchByNo', () => {
  it('points every non-final match at the match its winner plays', () => {
    const rounds = knockout(8);
    const next = nextMatchByNo(rounds);
    expect(next.get(1)?.matchNo).toBe(5);
    expect(next.get(2)?.matchNo).toBe(5);
    expect(next.get(3)?.matchNo).toBe(6);
    expect(next.get(5)?.matchNo).toBe(7);
    expect(next.get(5)?.round.code).toBe('F');
    expect(next.has(7)).toBe(false);
  });

  it('falls back to position when the sources are already replaced by the players', () => {
    const rounds = knockout(8).map((round) => ({ ...round, matches: round.matches.map((m) => ({ ...m, side1Source: null, side2Source: null })) }));
    const next = nextMatchByNo(rounds);
    expect(next.get(1)?.matchNo).toBe(5);
    expect(next.get(4)?.matchNo).toBe(6);
    expect(next.get(6)?.matchNo).toBe(7);
    expect(next.has(7)).toBe(false);
  });

  it('does not guess positions in an irregular round layout', () => {
    const irregular = [{ code: 'R16', number: 1, matches: [match(1, 1), match(2, 2), match(3, 3)] }, { code: 'QF', number: 2, matches: [match(4, 1), match(5, 2)] }];
    expect(nextMatchByNo(irregular).size).toBe(0);
  });

  it('handles a 64-slot draw and ignores qualifier / group sources', () => {
    const rounds = knockout(64);
    expect(nextMatchByNo(rounds).size).toBe(62);
    const other = [{ code: 'QF-1', number: 1, matches: [match(1, 1, { side1Source: { type: 'QUALIFIER', index: 1 }, side2Source: { type: 'GROUP_PLACE', group: 'A', place: 1 } })] }];
    expect(nextMatchByNo(other).size).toBe(0);
  });
});

describe('roundDay', () => {
  it('uses the earliest match day in the event time zone', () => {
    const [round] = knockout(4, { 1: { scheduledAt: '2027-03-14T18:30:00Z' }, 2: { scheduledAt: '2027-03-14T02:00:00Z' } });
    // 18:30Z is already the 15th in Ho Chi Minh City; 02:00Z is the 14th (09:00 local).
    expect(roundDay(round!, 'Asia/Ho_Chi_Minh')).toBe('2027-03-14');
    expect(roundDay(round!, 'UTC')).toBe('2027-03-14');
    expect(roundDay({ ...round!, matches: [round!.matches[0]!] }, 'Asia/Ho_Chi_Minh')).toBe('2027-03-15');
  });

  it('is null while no match has a time', () => {
    expect(roundDay(knockout(4)[0]!, 'Asia/Ho_Chi_Minh')).toBeNull();
  });
});

describe('defaultRound / pickRound', () => {
  const done = { status: 'OFFICIAL' as const };

  it('is the first round with an unplayed match', () => {
    expect(defaultRound(knockout(8, { 1: done, 2: done, 3: done, 4: done, 5: done }))).toBe(2);
    expect(defaultRound(knockout(8))).toBe(1);
  });

  it('treats BYE matches as settled and falls back to the last round when all is done', () => {
    expect(defaultRound(knockout(8, { 1: { resultType: 'BYE' }, 2: done, 3: done, 4: done }))).toBe(2);
    expect(defaultRound(knockout(4, { 1: done, 2: done, 3: done }))).toBe(2);
    expect(defaultRound([])).toBeNull();
  });

  it('accepts only a round that exists', () => {
    const rounds = knockout(8);
    expect(pickRound(3, rounds)).toBe(3);
    expect(pickRound(9, rounds)).toBe(1);
    expect(pickRound(null, rounds)).toBe(1);
  });
});

describe('parseRoundParam', () => {
  it('takes plain positive integers only', () => {
    expect(parseRoundParam('2')).toBe(2);
    expect(parseRoundParam('0')).toBeNull();
    expect(parseRoundParam('02')).toBeNull();
    expect(parseRoundParam('1e3')).toBeNull();
    expect(parseRoundParam('-1')).toBeNull();
    expect(parseRoundParam(['1', '2'])).toBeNull();
    expect(parseRoundParam(undefined)).toBeNull();
  });
});

describe('roundProgress / finalMatch / championSide', () => {
  it('counts played matches without BYE', () => {
    const [round] = knockout(8, { 1: { resultType: 'BYE', status: 'OFFICIAL' }, 2: { status: 'OFFICIAL' } });
    expect(roundProgress(round!)).toEqual({ total: 3, done: 1 });
  });

  it('finds the final only when the last round has one match', () => {
    expect(finalMatch(knockout(8))?.matchNo).toBe(7);
    expect(finalMatch([{ code: 'QF-1', number: 1, matches: [match(1, 1), match(2, 2)] }])).toBeNull();
    expect(finalMatch([])).toBeNull();
  });

  it('names the champion once the final is official', () => {
    const open = finalMatch(knockout(4))!;
    expect(championSide(open)).toBeNull();
    const closed = finalMatch(knockout(4, { 3: { status: 'OFFICIAL', winnerSide: 2, side1: side('X'), side2: side('Y') } }))!;
    expect(championSide(closed)?.players[0]?.name).toBe('Y');
  });
});

describe('pathToMatch', () => {
  const won = (winnerSide: 1 | 2, games1: number, games2: number) => ({ status: 'OFFICIAL' as const, winnerSide, games1, games2 });
  const played = knockout(8, {
    1: won(1, 3, 1),
    2: won(2, 1, 3),
    5: { ...won(1, 3, 2), side1: side('A1'), side2: side('B2') },
  });

  it('has no path for a first-round match', () => {
    expect(pathToMatch(played, 1)).toEqual([[], []]);
    expect(pathToMatch(played, 99)).toEqual([[], []]);
  });

  it('walks back through every earlier match the side won, earliest first', () => {
    const [left, right] = pathToMatch(knockout(8, { 1: won(1, 3, 1), 2: won(2, 1, 3), 5: { ...won(1, 3, 2), side1: side('A1'), side2: side('B2') } }), 7);
    expect(left.map((s) => (s.kind === 'win' ? s.match.matchNo : null))).toEqual([1, 5]);
    expect(left[1]).toMatchObject({ kind: 'win', wonGames: 3, lostGames: 2 });
    expect(right).toEqual([]);
  });

  it('stops where a link is unplayed or unknown', () => {
    const [left, right] = pathToMatch(played, 5);
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
    expect(right[0]).toMatchObject({ kind: 'win', wonGames: 3, lostGames: 1 });
    expect(pathToMatch(knockout(8), 7)).toEqual([[], []]);
  });

  it('follows positions once the WINNER_OF sources are gone', () => {
    const bare = played.map((round) => ({ ...round, matches: round.matches.map((m) => ({ ...m, side1Source: null, side2Source: null })) }));
    expect(pathToMatch(bare, 5)[0]).toHaveLength(1);
  });

  it('adds the group or qualifier source as the first step and skips byes', () => {
    const rounds = knockout(4, { 1: { side1Source: { type: 'GROUP_PLACE', group: 'A', place: 1 } }, 2: { status: 'OFFICIAL', winnerSide: 1, resultType: 'BYE' } });
    expect(pathToMatch(rounds, 1)[0]).toEqual([{ kind: 'source', source: { type: 'GROUP_PLACE', group: 'A', place: 1 } }]);
    expect(pathToMatch(rounds, 3)[1]).toEqual([]);
  });
});

describe('followUpMatch / locateMatch', () => {
  it('finds the next match and the opponent waiting there', () => {
    const rounds = knockout(8, { 6: { side1: side('X') } });
    expect(followUpMatch(rounds, 3)?.next.match.matchNo).toBe(6);
    expect(followUpMatch(rounds, 3)?.opponent).toBeNull();
    expect(followUpMatch(rounds, 4)?.opponent?.players[0]?.name).toBe('X');
    expect(followUpMatch(rounds, 7)).toBeNull();
    expect(locateMatch(rounds, 7)?.round.code).toBe('F');
  });
});

describe('roundParamKey', () => {
  it('keeps plain ?round for one section and gives each section its own key otherwise', () => {
    expect(roundParamKey(1, false)).toBe('round');
    expect(roundParamKey(1, true)).toBe('round1');
    expect(roundParamKey(2, true)).toBe('round2');
  });
});
