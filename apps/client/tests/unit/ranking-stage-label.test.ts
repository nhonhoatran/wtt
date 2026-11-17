import { describe, expect, it } from 'vitest';
import { getDictionary } from '../../src/i18n/get-dictionary';
import { rankingStageLabel } from '../../src/i18n/ranking-stage-label';

describe('published ranking stage labels', () => {
  it('distinguishes the winner, final, knockout and ranked group finishes', () => {
    const t = getDictionary('vi');
    expect(rankingStageLabel(t, 'W')).toBe('Vô địch');
    expect(rankingStageLabel(t, 'F')).toBe('Chung kết');
    expect(rankingStageLabel(t, 'R16')).toBe('Vòng 16');
    expect(rankingStageLabel(t, 'GROUP')).toBe('Vòng bảng');
    expect(rankingStageLabel(t, 'GROUP-3')).toBe('Hạng 3 vòng bảng');
  });

  it('keeps the qualifying decider distinct and supports English and custom stages', () => {
    const t = getDictionary('en');
    expect(rankingStageLabel(t, 'QF-1')).toBe(t.bracket.rounds.QUAL_FINAL);
    expect(rankingStageLabel(t, 'QF-3')).toBe('Round 3');
    expect(rankingStageLabel(t, 'W')).toBe('Winner');
    expect(rankingStageLabel(t, 'GROUP-2')).toBe('Group stage, place 2');
    expect(rankingStageLabel(t, 'CUSTOM-FINISH')).toBe('CUSTOM-FINISH');
  });
});
