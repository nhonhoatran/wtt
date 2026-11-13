import { describe, expect, it } from 'vitest';
import { isPlayedMatch, isRealMatch, locksDrawStructure } from './match-predicates.js';

describe('match predicates', () => {
  it('treats BYE as not real and everything else (including no result yet) as real', () => {
    expect(isRealMatch({ resultType: 'BYE' })).toBe(false);
    expect(isRealMatch({ resultType: 'NORMAL' })).toBe(true);
    expect(isRealMatch({ resultType: 'WALKOVER' })).toBe(true);
    expect(isRealMatch({ resultType: null })).toBe(true);
    expect(isRealMatch({})).toBe(true);
  });

  it('counts only official, real, non-voided matches as played', () => {
    expect(isPlayedMatch({ status: 'OFFICIAL', resultType: 'NORMAL' })).toBe(true);
    expect(isPlayedMatch({ status: 'OFFICIAL', resultType: 'WALKOVER', isVoided: false })).toBe(true);
    expect(isPlayedMatch({ status: 'OFFICIAL', resultType: 'BYE' })).toBe(false);
    expect(isPlayedMatch({ status: 'OFFICIAL', resultType: 'NORMAL', isVoided: true })).toBe(false);
    expect(isPlayedMatch({ status: 'LIVE', resultType: null })).toBe(false);
    expect(isPlayedMatch({ status: 'SCHEDULED' })).toBe(false);
  });

  it('locks the draw structure only for started real matches', () => {
    expect(locksDrawStructure({ status: 'LIVE' })).toBe(true);
    expect(locksDrawStructure({ status: 'OFFICIAL', resultType: 'NORMAL' })).toBe(true);
    expect(locksDrawStructure({ status: 'OFFICIAL', resultType: 'BYE' })).toBe(false);
    expect(locksDrawStructure({ status: 'SCHEDULED' })).toBe(false);
  });
});
