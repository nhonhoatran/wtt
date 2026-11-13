import { describe, expect, it } from 'vitest';
import { planGroupWithdrawal, type WithdrawalMatch } from './group-withdrawal-plan.js';
import { DrawParamsError } from './types.js';

const matches: WithdrawalMatch[] = [
  { id: 'm1', side1EntryId: 'A', side2EntryId: 'B', status: 'OFFICIAL' },
  { id: 'm2', side1EntryId: 'C', side2EntryId: 'A', status: 'SCHEDULED' },
  { id: 'm3', side1EntryId: 'A', side2EntryId: 'D', status: 'LIVE' },
  { id: 'm4', side1EntryId: 'B', side2EntryId: 'C', status: 'SCHEDULED' },
  { id: 'm5', side1EntryId: 'A', side2EntryId: 'E', status: 'SCHEDULED', isVoided: true },
];

describe('planGroupWithdrawal', () => {
  it('KEEP_PLAYED_RESULTS: unfinished matches become walkovers for the opponent', () => {
    expect(planGroupWithdrawal('A', matches, 'KEEP_PLAYED_RESULTS')).toEqual({
      walkovers: [
        { matchId: 'm2', winnerSide: 1 },
        { matchId: 'm3', winnerSide: 2 },
      ],
      voidedMatchIds: [],
    });
  });

  it('VOID_ALL_RESULTS: every match of the entry leaves the table', () => {
    expect(planGroupWithdrawal('A', matches, 'VOID_ALL_RESULTS')).toEqual({ walkovers: [], voidedMatchIds: ['m1', 'm2', 'm3'] });
  });

  it('blocks the withdrawal when no policy is chosen', () => {
    for (const missing of [null, undefined]) {
      expect(() => planGroupWithdrawal('A', matches, missing)).toThrow(DrawParamsError);
    }
  });
});
