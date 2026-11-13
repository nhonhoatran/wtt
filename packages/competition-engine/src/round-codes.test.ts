import { describe, expect, it } from 'vitest';
import { groupRoundCode, knockoutRoundCode, qualifyingRoundCode, roundCode } from './round-codes.js';

describe('round codes', () => {
  it('names knockout rounds from the number of participants', () => {
    expect([2, 4, 8, 16, 32, 64, 128].map(knockoutRoundCode)).toEqual(['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128']);
  });

  it('counts qualifying rounds back from the section final', () => {
    expect(qualifyingRoundCode(1)).toBe('QF-1');
    expect(qualifyingRoundCode(3)).toBe('QF-3');
  });

  it('numbers group rounds', () => {
    expect(groupRoundCode(1)).toBe('GR1');
  });

  it('picks the code by style', () => {
    expect(roundCode('MAIN', 4, 2)).toBe('SF');
    expect(roundCode('QUALIFYING', 4, 2)).toBe('QF-2');
  });
});
