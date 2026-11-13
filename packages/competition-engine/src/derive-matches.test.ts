import { describe, expect, it } from 'vitest';
import { advancementTarget, deriveMatches, swapPositions } from './derive-matches.js';
import { DrawParamsError, type BracketPositionData } from './types.js';

const entry = (position: number, id = `E${position}`): BracketPositionData => ({
  section: 1,
  position,
  source: 'ENTRY',
  entryId: id,
});
const bye = (position: number): BracketPositionData => ({ section: 1, position, source: 'BYE' });
const base = { scopeKey: 'S1', section: 1 };

describe('advancementTarget', () => {
  it('maps odd/even orders to side 1/2 of the next match', () => {
    expect(advancementTarget(1, 1, 3)).toEqual({ roundNumber: 2, orderInRound: 1, side: 1 });
    expect(advancementTarget(1, 2, 3)).toEqual({ roundNumber: 2, orderInRound: 1, side: 2 });
    expect(advancementTarget(1, 3, 3)).toEqual({ roundNumber: 2, orderInRound: 2, side: 1 });
    expect(advancementTarget(2, 2, 3)).toEqual({ roundNumber: 3, orderInRound: 1, side: 2 });
  });

  it('returns null for the final', () => {
    expect(advancementTarget(3, 1, 3)).toBeNull();
  });
});

describe('deriveMatches', () => {
  it('builds rounds, codes and links for a full 8 bracket', () => {
    const { rounds, matches } = deriveMatches({ ...base, size: 8, positions: [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(p)) });
    expect(rounds.map((r) => r.code)).toEqual(['QF', 'SF', 'F']);
    expect(matches).toHaveLength(7);
    const first = matches.find((m) => m.roundNumber === 1 && m.orderInRound === 1);
    expect(first).toMatchObject({ side1EntryId: 'E1', side2EntryId: 'E2', side1Source: null, status: 'SCHEDULED' });
    expect(first?.next).toEqual({ roundNumber: 2, orderInRound: 1, side: 1 });
    const semi = matches.find((m) => m.roundNumber === 2 && m.orderInRound === 2);
    expect(semi?.side1Source).toEqual({ type: 'WINNER_OF', scopeKey: 'S1', roundNumber: 1, orderInRound: 3 });
    expect(semi?.side2Source).toEqual({ type: 'WINNER_OF', scopeKey: 'S1', roundNumber: 1, orderInRound: 4 });
    expect(matches.at(-1)?.next).toBeUndefined();
  });

  it('completes BYE matches and advances the winner into the next match', () => {
    const positions = [entry(1), bye(2), bye(3), entry(4), entry(5), entry(6), entry(7), entry(8)];
    const { matches } = deriveMatches({ ...base, size: 8, positions });
    const m1 = matches.find((m) => m.roundNumber === 1 && m.orderInRound === 1);
    const m2 = matches.find((m) => m.roundNumber === 1 && m.orderInRound === 2);
    expect(m1).toMatchObject({ bye: { winnerSide: 1 }, status: 'OFFICIAL' });
    expect(m2).toMatchObject({ bye: { winnerSide: 2 }, status: 'OFFICIAL' });
    const semi = matches.find((m) => m.roundNumber === 2 && m.orderInRound === 1);
    expect(semi).toMatchObject({ side1EntryId: 'E1', side2EntryId: 'E4', side1Source: null, side2Source: null });
  });

  it('keeps waiting-slot labels for qualifiers and group places, and propagates them through a BYE', () => {
    const positions: BracketPositionData[] = [
      { section: 1, position: 1, source: 'GROUP_PLACE', sourceRef: { type: 'GROUP_PLACE', group: 'A', place: 1 } },
      bye(2),
      { section: 1, position: 3, source: 'QUALIFIER', sourceRef: { type: 'QUALIFIER', index: 1 } },
      entry(4),
    ];
    const { matches } = deriveMatches({ ...base, size: 4, positions });
    expect(matches[0]).toMatchObject({ side1Source: { type: 'GROUP_PLACE', group: 'A', place: 1 }, bye: { winnerSide: 1 } });
    expect(matches[1]).toMatchObject({ side1Source: { type: 'QUALIFIER', index: 1 }, side2EntryId: 'E4' });
    expect(matches[2]?.side1Source).toEqual({ type: 'GROUP_PLACE', group: 'A', place: 1 });
    expect(matches[2]?.side1EntryId).toBeUndefined();
  });

  it('counts qualifying round codes back from the section final', () => {
    const positions = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(p));
    const { rounds } = deriveMatches({ scopeKey: 'S2', section: 2, size: 8, positions: positions.map((p) => ({ ...p, section: 2 })), roundStyle: 'QUALIFYING' });
    expect(rounds).toEqual([
      { scopeKey: 'S2', section: 2, number: 1, code: 'QF-3' },
      { scopeKey: 'S2', section: 2, number: 2, code: 'QF-2' },
      { scopeKey: 'S2', section: 2, number: 3, code: 'QF-1' },
    ]);
  });

  it('supports a 2-slot bracket', () => {
    const { rounds, matches } = deriveMatches({ ...base, size: 2, positions: [entry(1), bye(2)] });
    expect(rounds.map((r) => r.code)).toEqual(['F']);
    expect(matches[0]).toMatchObject({ bye: { winnerSide: 1 }, status: 'OFFICIAL' });
  });

  it('rejects BYE vs BYE, incomplete positions and malformed slots', () => {
    expect(() => deriveMatches({ ...base, size: 4, positions: [bye(1), bye(2), entry(3), entry(4)] })).toThrow(DrawParamsError);
    expect(() => deriveMatches({ ...base, size: 4, positions: [entry(1), entry(2), entry(3)] })).toThrow(DrawParamsError);
    expect(() => deriveMatches({ ...base, size: 4, positions: [entry(1), entry(2), entry(3), entry(3)] })).toThrow(DrawParamsError);
    expect(() => deriveMatches({ ...base, size: 4, positions: [entry(1), entry(2), entry(3), { section: 1, position: 4, source: 'ENTRY' }] })).toThrow(DrawParamsError);
    expect(() => deriveMatches({ ...base, size: 4, positions: [entry(1), entry(2), entry(3), { section: 1, position: 4, source: 'QUALIFIER' }] })).toThrow(DrawParamsError);
  });
});

describe('swapPositions + deriveMatches (draft swap)', () => {
  const positions = [entry(1), bye(2), entry(3), entry(4), entry(5), entry(6), entry(7), entry(8)];

  it('recomputes the BYE advancement and slot labels after swapping a BYE slot', () => {
    const before = deriveMatches({ ...base, size: 8, positions });
    expect(before.matches.find((m) => m.roundNumber === 2 && m.orderInRound === 1)).toMatchObject({ side1EntryId: 'E1' });

    const swapped = swapPositions(positions, 2, 5);
    expect(swapped.find((p) => p.position === 5)?.source).toBe('BYE');
    const after = deriveMatches({ ...base, size: 8, positions: swapped });
    expect(after.matches.find((m) => m.roundNumber === 1 && m.orderInRound === 1)).toMatchObject({ side1EntryId: 'E1', side2EntryId: 'E5', status: 'SCHEDULED' });
    expect(after.matches.find((m) => m.roundNumber === 1 && m.orderInRound === 1)?.bye).toBeUndefined();
    const m3 = after.matches.find((m) => m.roundNumber === 1 && m.orderInRound === 3);
    expect(m3).toMatchObject({ bye: { winnerSide: 2 }, side2EntryId: 'E6' });
    const semi = after.matches.find((m) => m.roundNumber === 2 && m.orderInRound === 1);
    expect(semi?.side1EntryId).toBeUndefined();
    expect(semi?.side1Source).toEqual({ type: 'WINNER_OF', scopeKey: 'S1', roundNumber: 1, orderInRound: 1 });
    const semi2 = after.matches.find((m) => m.roundNumber === 2 && m.orderInRound === 2);
    expect(semi2).toMatchObject({ side1EntryId: 'E6', side1Source: null });
    expect(semi2).toMatchObject({ side2Source: { type: 'WINNER_OF', roundNumber: 1, orderInRound: 4 } });
  });

  it('does not mutate the input and carries placeholder refs across the swap', () => {
    const withQualifier: BracketPositionData[] = [
      ...positions.slice(0, 2),
      { section: 1, position: 3, source: 'QUALIFIER', sourceRef: { type: 'QUALIFIER', index: 1 } },
      ...positions.slice(3),
    ];
    const swapped = swapPositions(withQualifier, 3, 8);
    expect(swapped.find((p) => p.position === 8)).toMatchObject({ source: 'QUALIFIER', sourceRef: { type: 'QUALIFIER', index: 1 } });
    expect(swapped.find((p) => p.position === 3)).toMatchObject({ source: 'ENTRY', entryId: 'E8' });
    expect(withQualifier.find((p) => p.position === 3)?.source).toBe('QUALIFIER');
  });

  it('refuses swaps that create BYE vs BYE or a qualifier against a BYE', () => {
    const twoByes = [entry(1), bye(2), bye(3), entry(4), entry(5), entry(6), entry(7), entry(8)];
    expect(() => swapPositions(twoByes, 4, 1)).not.toThrow();
    expect(() => swapPositions(twoByes, 1, 3)).toThrow(DrawParamsError);

    const withQ: BracketPositionData[] = [
      entry(1),
      bye(2),
      { section: 1, position: 3, source: 'QUALIFIER', sourceRef: { type: 'QUALIFIER', index: 1 } },
      entry(4),
    ];
    expect(() => swapPositions(withQ, 1, 3)).toThrow(DrawParamsError);
  });

  it('rejects unknown positions', () => {
    expect(() => swapPositions(positions, 1, 99)).toThrow(DrawParamsError);
  });
});
