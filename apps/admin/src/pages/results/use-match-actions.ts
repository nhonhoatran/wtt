import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCallback, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings } from '../../api/write-warnings';
import { useStepUp } from '../../components/step-up-modal';
import { matchDetailKey, MATCH_CONFLICT_TEXT, type MatchResultType, type MatchWriteResponse, type ReopenPreview } from './match-types';

export type MatchProblem =
  | { kind: 'conflict'; text: string; code?: string }
  | { kind: 'issues'; text: string; issues: string[] }
  | { kind: 'error'; text: string; code?: string; preview?: ReopenPreview };

type MatchAction = 'start' | 'un-start' | 'save-progress' | 'confirm' | 'amend-scores' | 'reopen';
type GamesBody = { score1: number; score2: number }[];

export interface ConfirmBody {
  expectedVersion: number;
  resultType: MatchResultType;
  winnerSide?: 1 | 2;
  games: GamesBody;
}

export interface ReopenBody {
  expectedVersion: number;
  reason: string;
  force?: boolean;
  expectedBlockingIds?: string[];
}

const RETRY_TEXT = 'Hệ thống đang bận, thử lại sau giây lát';

const problemOf = (error: unknown): MatchProblem => {
  if (!(error instanceof ApiError)) return { kind: 'error', text: error instanceof Error ? error.message : 'Không thực hiện được' };
  if (error.code === 'CONCURRENT_UPDATE_RETRY') return { kind: 'error', text: error.message || RETRY_TEXT, code: error.code };
  if (error.code === 'REOPEN_BLOCKED' || error.code === 'REOPEN_IMPACT_CHANGED') {
    return { kind: 'error', text: error.message, code: error.code, preview: error.preview as ReopenPreview | undefined };
  }
  if (error.statusCode === 409) return { kind: 'conflict', code: error.code, text: error.code === 'MATCH_VERSION_CONFLICT' ? MATCH_CONFLICT_TEXT : error.message || MATCH_CONFLICT_TEXT };
  if (error.statusCode === 422) return { kind: 'issues', text: error.message, issues: (error.issues ?? []).map((issue) => issue.message) };
  return { kind: 'error', text: error.message, code: error.code };
};

/** Result-lifecycle calls for one match; failures land in `problem` for the drawer or modal to show, never thrown. */
export function useMatchActions(matchId: string) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const runWithStepUp = useStepUp();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MatchProblem | null>(null);

  const run = useCallback(
    async (action: MatchAction, body: unknown, successText: string, stepUp = false): Promise<MatchWriteResponse | null> => {
      setBusy(true);
      setProblem(null);
      const call = () => apiFetch<MatchWriteResponse>(`/admin/matches/${matchId}/${action}`, { method: 'POST', body });
      try {
        const response = await (stepUp ? runWithStepUp(call) : call());
        queryClient.setQueryData(matchDetailKey(matchId), response.data);
        if (response.warnings?.length) showWarnings(message, response.warnings);
        else void message.success(successText);
        return response;
      } catch (error) {
        setProblem(problemOf(error));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [matchId, queryClient, message, runWithStepUp],
  );

  return {
    busy,
    problem,
    clearProblem: () => setProblem(null),
    start: (expectedVersion: number) => run('start', { expectedVersion }, 'Đã bắt đầu trận'),
    unStart: (expectedVersion: number) => run('un-start', { expectedVersion }, 'Đã hủy bắt đầu trận'),
    saveProgress: (expectedVersion: number, games: GamesBody) => run('save-progress', { expectedVersion, games }, 'Đã lưu tạm'),
    confirm: (body: ConfirmBody) => run('confirm', body, 'Đã chốt kết quả'),
    amend: (expectedVersion: number, games: GamesBody, reason: string) => run('amend-scores', { expectedVersion, games, reason }, 'Đã sửa tỷ số'),
    reopen: (body: ReopenBody) => run('reopen', body, 'Đã mở lại trận', true),
  };
}

export type MatchActions = ReturnType<typeof useMatchActions>;
