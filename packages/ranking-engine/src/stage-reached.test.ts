import { describe, expect, it } from 'vitest';
import { stageReached } from './stage-reached.js';
import type { EngineGroupStanding, EngineMatch, StageOptions } from './types.js';

const OPTS: StageOptions = { groupStageByRank: false, awardPointsOnWalkoverLoss: false };
const ME = 'me';

function match(over: Partial<EngineMatch>): EngineMatch {
  return {
    drawKind: 'MAIN',
    section: 1,
    roundCode: 'R16',
    roundNumber: 1,
    status: 'OFFICIAL',
    resultType: 'NORMAL',
    winnerSide: 1,
    isVoided: false,
    side1EntryId: ME,
    side2EntryId: 'opp',
    ...over,
  };
}

const win = (roundCode: string, roundNumber: number, over: Partial<EngineMatch> = {}) =>
  match({ roundCode, roundNumber, winnerSide: 1, ...over });
const lose = (roundCode: string, roundNumber: number, over: Partial<EngineMatch> = {}) =>
  match({ roundCode, roundNumber, winnerSide: 2, ...over });

describe('stageReached main draw', () => {
  it('returns W for a final win', () => {
    const matches = [win('SF', 3), win('F', 4)];
    expect(stageReached(ME, matches, null, OPTS)).toEqual({ drawKind: 'MAIN', stageCode: 'W' });
  });

  it.each([
    ['F', 'F', 4],
    ['SF', 'SF', 3],
  ])('returns %s for a loss in that round', (_n, code, num) => {
    const matches = [win('R16', 1), lose(code, num)];
    expect(stageReached(ME, matches, null, OPTS)?.stageCode).toBe(code);
  });

  it('uses the round after a BYE and ignores the BYE itself', () => {
    const bye = match({ roundCode: 'R64', roundNumber: 1, resultType: 'BYE', winnerSide: 1, side2EntryId: null });
    const matches = [bye, lose('R32', 2)];
    expect(stageReached(ME, matches, null, OPTS)).toEqual({ drawKind: 'MAIN', stageCode: 'R32' });
  });

  it('is undetermined while still playing', () => {
    expect(stageReached(ME, [win('R16', 1), win('QF', 2)], null, OPTS)).toBeNull();
    const bye = match({ roundCode: 'R64', roundNumber: 1, resultType: 'BYE', side2EntryId: null });
    expect(stageReached(ME, [bye], null, OPTS)).toBeNull();
    expect(stageReached(ME, [match({ status: 'SCHEDULED', winnerSide: null })], null, OPTS)).toBeNull();
  });

  it('ignores voided matches and matches of other entries', () => {
    const matches = [lose('QF', 2, { isVoided: true }), win('R16', 1), match({ side1EntryId: 'x', side2EntryId: 'y' })];
    expect(stageReached(ME, matches, null, OPTS)).toBeNull();
  });

  it('works when the entry is side 2', () => {
    const m = match({ roundCode: 'SF', roundNumber: 3, side1EntryId: 'opp', side2EntryId: ME, winnerSide: 1 });
    expect(stageReached(ME, [m], null, OPTS)?.stageCode).toBe('SF');
  });

  it('prefers MAIN over the qualifying loss history', () => {
    const q = win('QF-1', 2, { drawKind: 'QUALIFYING' });
    expect(stageReached(ME, [q, lose('R32', 2)], null, OPTS)).toEqual({ drawKind: 'MAIN', stageCode: 'R32' });
    expect(stageReached(ME, [q, match({ status: 'SCHEDULED', winnerSide: null })], null, OPTS)).toBeNull();
  });
});

describe('stageReached qualifying', () => {
  const q = (code: string, num: number, winnerSide: number) =>
    match({ drawKind: 'QUALIFYING', roundCode: code, roundNumber: num, winnerSide });

  it('uses the stored section-relative code for both section sizes', () => {
    const eight = [q('QF-2', 1, 1), q('QF-1', 2, 2)];
    const six = [q('QF-1', 2, 2)];
    expect(stageReached(ME, eight, null, OPTS)).toEqual({ drawKind: 'QUALIFYING', stageCode: 'QF-1' });
    expect(stageReached(ME, six, null, OPTS)).toEqual({ drawKind: 'QUALIFYING', stageCode: 'QF-1' });
    expect(stageReached(ME, [q('QF-2', 1, 2)], null, OPTS)?.stageCode).toBe('QF-2');
  });

  it('is undetermined for a qualifier who advanced', () => {
    expect(stageReached(ME, [q('QF-1', 2, 1)], null, OPTS)).toBeNull();
  });
});

describe('stageReached groups', () => {
  const standing = (over: Partial<EngineGroupStanding>): EngineGroupStanding => ({
    entryId: ME,
    rank: 3,
    qualified: false,
    complete: true,
    ...over,
  });

  it('gives GROUP or GROUP-n depending on the list flag', () => {
    expect(stageReached(ME, [], standing({}), OPTS)).toEqual({ drawKind: 'GROUP', stageCode: 'GROUP' });
    const byRank = stageReached(ME, [], standing({}), { ...OPTS, groupStageByRank: true });
    expect(byRank?.stageCode).toBe('GROUP-3');
    const unranked = stageReached(ME, [], standing({ rank: null }), { ...OPTS, groupStageByRank: true });
    expect(unranked?.stageCode).toBe('GROUP');
  });

  it('is undetermined when incomplete, qualified or without standing', () => {
    expect(stageReached(ME, [], standing({ complete: false }), OPTS)).toBeNull();
    expect(stageReached(ME, [], standing({ qualified: true }), OPTS)).toBeNull();
    expect(stageReached(ME, [], null, OPTS)).toBeNull();
  });
});

describe('stageReached walkover', () => {
  const walkoverLoss = (over: Partial<EngineMatch> = {}) => lose('R32', 2, { resultType: 'WALKOVER', ...over });

  it('awards nothing for a walkover loss in the first real match when the flag is off', () => {
    expect(stageReached(ME, [walkoverLoss()], null, OPTS)).toBeNull();
  });

  it('awards the stage when the flag is on', () => {
    const flagged = { ...OPTS, awardPointsOnWalkoverLoss: true };
    expect(stageReached(ME, [walkoverLoss()], null, flagged)?.stageCode).toBe('R32');
  });

  it('still awards when the walkover loss is not the first real match', () => {
    expect(stageReached(ME, [win('R64', 1), walkoverLoss()], null, OPTS)?.stageCode).toBe('R32');
  });

  it('does not treat a group stage as a walkover no-show', () => {
    const group = match({ drawKind: 'GROUP', resultType: 'WALKOVER', winnerSide: 2 });
    const st = { entryId: ME, rank: 4, qualified: false, complete: true };
    expect(stageReached(ME, [group], st, OPTS)?.stageCode).toBe('GROUP');
  });

  it('keeps points when the entry won its only real match by walkover then lost', () => {
    const matches = [win('R64', 1, { resultType: 'WALKOVER' }), lose('R32', 2)];
    expect(stageReached(ME, matches, null, OPTS)?.stageCode).toBe('R32');
  });
});
