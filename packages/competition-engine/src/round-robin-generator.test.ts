import { describe, expect, it } from 'vitest';
import { generateRoundRobin } from './round-robin-generator.js';
import { DrawParamsError } from './types.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const pairKey = (a?: string, b?: string) => [a, b].sort().join('-');

describe.each([3, 4, 5, 6])('round robin of %i', (n) => {
  const schedule = generateRoundRobin('A', ids(n));

  it('plays every pair exactly once', () => {
    const keys = schedule.matches.map((m) => pairKey(m.side1EntryId, m.side2EntryId));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength((n * (n - 1)) / 2);
  });

  it('never double-books a member within a round', () => {
    for (const round of schedule.rounds) {
      const players = schedule.matches
        .filter((m) => m.roundNumber === round.number)
        .flatMap((m) => [m.side1EntryId, m.side2EntryId]);
      expect(new Set(players).size).toBe(players.length);
    }
  });

  it('has rest rounds only for odd groups, one per member', () => {
    if (n % 2 === 0) {
      expect(schedule.rests).toHaveLength(0);
      expect(schedule.rounds).toHaveLength(n - 1);
    } else {
      expect(new Set(schedule.rests.map((r) => r.entryId)).size).toBe(n);
      expect(schedule.rounds).toHaveLength(n);
    }
  });
});

describe('round robin details', () => {
  it('orders a group of 4 as 1-4 2-3 / 1-3 2-4 / 1-2 3-4', () => {
    const plan = generateRoundRobin('B', ids(4)).matches.map((m) => `${m.roundNumber}:${m.side1EntryId}-${m.side2EntryId}`);
    expect(plan).toEqual(['1:P1-P4', '1:P2-P3', '2:P1-P3', '2:P2-P4', '3:P1-P2', '3:P3-P4']);
  });

  it('labels rounds GR1.. and scopes them to the group', () => {
    const { rounds, matches } = generateRoundRobin('C', ids(3));
    expect(rounds.map((r) => r.code)).toEqual(['GR1', 'GR2', 'GR3']);
    expect(rounds[0]?.scopeKey).toBe('G-C');
    expect(matches[0]).toMatchObject({ scopeKey: 'G-C', groupCode: 'C', status: 'SCHEDULED', side1Source: null, orderInRound: 1 });
  });

  it('handles a pair and rejects degenerate input', () => {
    expect(generateRoundRobin('D', ids(2)).matches).toHaveLength(1);
    expect(() => generateRoundRobin('D', ['only'])).toThrow(DrawParamsError);
    expect(() => generateRoundRobin('D', ['a', 'a'])).toThrow(DrawParamsError);
  });
});
