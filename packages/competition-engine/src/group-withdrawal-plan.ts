import { DrawParamsError } from './types.js';

export type WithdrawalPolicy = 'KEEP_PLAYED_RESULTS' | 'VOID_ALL_RESULTS';

export interface WithdrawalMatch {
  id: string;
  side1EntryId: string;
  side2EntryId: string;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  isVoided?: boolean;
}

export interface WithdrawalPlan {
  /** Unfinished matches become a walkover won by the opponent. */
  walkovers: { matchId: string; winnerSide: 1 | 2 }[];
  /** Matches excluded from the table. */
  voidedMatchIds: string[];
}

/** A missing policy blocks the withdrawal: the organiser has not decided how results are treated. */
export function planGroupWithdrawal(
  entryId: string,
  matches: readonly WithdrawalMatch[],
  policy: WithdrawalPolicy | null | undefined,
): WithdrawalPlan {
  if (!policy) {
    throw new DrawParamsError('WITHDRAWAL_POLICY_MISSING', 'Group withdrawal policy has not been chosen');
  }
  const own = matches.filter((m) => !m.isVoided && (m.side1EntryId === entryId || m.side2EntryId === entryId));
  if (policy === 'VOID_ALL_RESULTS') {
    return { walkovers: [], voidedMatchIds: own.map((m) => m.id) };
  }
  return {
    walkovers: own
      .filter((m) => m.status !== 'OFFICIAL')
      .map((m) => ({ matchId: m.id, winnerSide: m.side1EntryId === entryId ? 2 : 1 })),
    voidedMatchIds: [],
  };
}
