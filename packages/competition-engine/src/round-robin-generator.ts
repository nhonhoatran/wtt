import { groupRoundCode } from './round-codes.js';
import { DrawParamsError, type MatchData, type RoundData } from './types.js';

export interface RoundRobinSchedule {
  rounds: RoundData[];
  matches: MatchData[];
  /** Odd groups: who sits out each round. */
  rests: { roundNumber: number; entryId: string }[];
}

/** Circle method; `memberIds` are in slot order (pot 1 first). Four members play 1-4 2-3 / 1-3 2-4 / 1-2 3-4. */
export function generateRoundRobin(groupCode: string, memberIds: readonly string[]): RoundRobinSchedule {
  if (memberIds.length < 2 || new Set(memberIds).size !== memberIds.length) {
    throw new DrawParamsError('INVALID_PARAMS', 'A round-robin group needs at least 2 distinct members');
  }
  const scopeKey = `G-${groupCode}`;
  const slotOf = new Map(memberIds.map((id, i) => [id, i]));
  let ring: (string | null)[] = memberIds.length % 2 === 1 ? [...memberIds, null] : [...memberIds];
  const rounds: RoundData[] = [];
  const matches: MatchData[] = [];
  const rests: RoundRobinSchedule['rests'] = [];

  for (let round = 1; round < ring.length; round++) {
    rounds.push({ scopeKey, section: 1, number: round, code: groupRoundCode(round) });
    let order = 0;
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i] ?? null;
      const b = ring[ring.length - 1 - i] ?? null;
      if (a === null || b === null) {
        rests.push({ roundNumber: round, entryId: (a ?? b) as string });
        continue;
      }
      const [first, second] = (slotOf.get(a) as number) < (slotOf.get(b) as number) ? [a, b] : [b, a];
      matches.push({
        scopeKey,
        roundNumber: round,
        orderInRound: ++order,
        section: 1,
        groupCode,
        side1EntryId: first,
        side2EntryId: second,
        side1Source: null,
        side2Source: null,
        status: 'SCHEDULED',
      });
    }
    ring = [ring[0] ?? null, ring[ring.length - 1] ?? null, ...ring.slice(1, -1)];
  }
  return { rounds, matches, rests };
}
