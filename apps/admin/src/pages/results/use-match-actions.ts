import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { matchDetailKey, MATCH_CONFLICT_TEXT, type MatchResultType, type MatchWriteResponse } from './match-types';

export type MatchProblem =
  | { kind: 'conflict'; text: string }
  | { kind: 'issues'; text: string; issues: string[] }
  | { kind: 'error'; text: string };

export interface ConfirmBody {
  expectedVersion: number;
  resultType: MatchResultType;
  winnerSide?: 1 | 2;
  games: { score1: number; score2: number }[];
}

const problemOf = (error: unknown): MatchProblem => {
  if (!(error instanceof ApiError)) return { kind: 'error', text: 'Không thực hiện được' };
  if (error.statusCode === 409) return { kind: 'conflict', text: error.message || MATCH_CONFLICT_TEXT };
  if (error.statusCode === 422) return { kind: 'issues', text: error.message, issues: (error.issues ?? []).map((issue) => issue.message) };
  return { kind: 'error', text: error.message };
};

/** Start / confirm calls for one match; failures land in `problem` for the drawer to show, never thrown. */
export function useMatchActions(matchId: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MatchProblem | null>(null);

  const run = useCallback(
    async (action: 'start' | 'confirm', body: unknown): Promise<MatchWriteResponse | null> => {
      setBusy(true);
      setProblem(null);
      try {
        const response = await apiFetch<MatchWriteResponse>(`/admin/matches/${matchId}/${action}`, { method: 'POST', body });
        queryClient.setQueryData(matchDetailKey(matchId), response.data);
        return response;
      } catch (error) {
        setProblem(problemOf(error));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [matchId, queryClient],
  );

  const start = useCallback((expectedVersion: number) => run('start', { expectedVersion }), [run]);
  const confirm = useCallback((body: ConfirmBody) => run('confirm', body), [run]);
  return { busy, problem, clearProblem: () => setProblem(null), start, confirm };
}
