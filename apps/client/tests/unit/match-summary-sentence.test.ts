import { describe, expect, it } from 'vitest';
import { getDictionary } from '../../src/i18n/get-dictionary';
import { matchSummarySentence } from '../../src/components/matches/match-summary-sentence';

const base = { winner: 'Nguyen A', wonGames: 3, lostGames: 1, result: null, next: null };

describe('matchSummarySentence', () => {
  it('names the winner and the games in both languages', () => {
    expect(matchSummarySentence({ ...base, t: getDictionary('vi').match })).toBe('Nguyen A thắng 3–1.');
    expect(matchSummarySentence({ ...base, t: getDictionary('en').match })).toBe('Nguyen A won 3–1.');
  });

  it('adds the next round and the opponent when known', () => {
    const next = { round: 'Bán kết', opponent: 'Tran B' };
    expect(matchSummarySentence({ ...base, t: getDictionary('vi').match, next })).toBe('Nguyen A thắng 3–1, vào Bán kết gặp Tran B.');
    expect(matchSummarySentence({ ...base, t: getDictionary('en').match, next: { round: 'Semi-final', opponent: 'Tran B' } })).toBe('Nguyen A won 3–1. Next: Semi-final vs Tran B.');
  });

  it('leaves the opponent out while the other side is open', () => {
    expect(matchSummarySentence({ ...base, t: getDictionary('vi').match, next: { round: 'Bán kết', opponent: null } })).toBe('Nguyen A thắng 3–1, vào Bán kết.');
  });

  it('uses the result label instead of a score for walk-overs', () => {
    expect(matchSummarySentence({ ...base, t: getDictionary('vi').match, result: 'W/O' })).toBe('Nguyen A thắng (W/O).');
  });
});
