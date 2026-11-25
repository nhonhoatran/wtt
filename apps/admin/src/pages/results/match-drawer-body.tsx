import { useCan } from '@refinedev/core';
import { gamesToWin } from '@kamito/competition-engine';
import { Alert, Button, Flex, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useConfirmAction } from '../../components/confirm-action-button';
import { AmendScoresModal } from './amend-scores-modal';
import { GameScoreInputs } from './game-score-inputs';
import { MatchAbandonModal } from './match-abandon-modal';
import { MatchActionBar } from './match-action-bar';
import { MatchDrawerHeader } from './match-drawer-header';
import { MatchOfficialResult } from './match-official-result';
import { MatchProblemAlert } from './match-problem-alert';
import { sideName, type MatchDetail, type MatchWriteResponse } from './match-types';
import { MatchVersusPanel } from './match-versus-panel';
import { MatchWinnerBox } from './match-winner-box';
import { ReopenPreviewModal } from './reopen-preview-modal';
import { analyzeDraft, confirmBlockReason, confirmSummary, draftFromDetail, type GameDraft } from './score-draft';
import { useMatchActions, type ConfirmBody } from './use-match-actions';

export interface MatchDrawerBodyProps {
  detail: MatchDetail;
  timeZone: string;
  onDirtyChange: (dirty: boolean) => void;
  onStarted: () => void;
  onConfirmed: (finishedTableId: string | null) => void;
  onReload: () => Promise<MatchDetail | undefined>;
}

type Dialog = 'abandon' | 'amend' | 'reopen' | null;

const sameDraft = (a: readonly GameDraft[], b: readonly GameDraft[]) => a.every((game, index) => game.a === b[index]?.a && game.b === b[index]?.b);

export function MatchDrawerBody({ detail, timeZone, onDirtyChange, onStarted, onConfirmed, onReload }: MatchDrawerBodyProps) {
  const confirmAction = useConfirmAction();
  const canConfirm = useCan({ resource: 'matches', action: 'confirm' }).data?.can ?? false;
  const canAmend = useCan({ resource: 'matches', action: 'amend' }).data?.can ?? false;
  const canReopen = useCan({ resource: 'matches', action: 'reopen' }).data?.can ?? false;
  const [draft, setDraft] = useState<GameDraft[]>(() => draftFromDetail(detail));
  const [dialog, setDialog] = useState<Dialog>(null);
  const actions = useMatchActions(detail.id);
  const analysis = useMemo(() => analyzeDraft(draft, detail.format), [draft, detail.format]);
  const { outcome } = analysis;
  const official = detail.status === 'OFFICIAL';
  const canEnter = !official && detail.ready;
  const names = { 1: sideName(detail.side1), 2: sideName(detail.side2) };
  const blockReason = canEnter ? confirmBlockReason(draft, analysis) : null;
  const dirty = !official && !sameDraft(draft, draftFromDetail(detail));

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const openDialog = (next: Dialog) => {
    actions.clearProblem();
    setDialog(next);
  };

  const afterConfirm = (response: MatchWriteResponse | null) => {
    if (!response) return;
    setDialog(null);
    onConfirmed(response.data.tableId ?? null);
  };

  // Amend / reopen / un-start change the saved games, so the typed draft is reseeded from the server copy.
  const afterRewrite = (response: MatchWriteResponse | null) => {
    if (!response) return;
    setDraft(draftFromDetail(response.data));
    setDialog(null);
    void onReload();
  };

  const submit = () => {
    if (!canConfirm || !canEnter || !outcome.valid || !outcome.winnerSide) return;
    const body: ConfirmBody = { expectedVersion: detail.version, resultType: 'NORMAL', games: analysis.entered };
    confirmAction({
      title: 'Xác nhận kết quả?',
      content: `${confirmSummary(names[outcome.winnerSide], outcome, analysis.entered)}. Kết quả sẽ hiện trên trang giải và người thắng vào vòng sau.`,
      okText: 'Xác nhận',
      onConfirm: async () => afterConfirm(await actions.confirm(body)),
    });
  };

  const unStart = () =>
    confirmAction({
      title: 'Hủy bắt đầu trận?',
      content: 'Các ván đã lưu tạm sẽ bị xóa.',
      okText: 'Hủy bắt đầu',
      danger: true,
      onConfirm: async () => afterRewrite(await actions.unStart(detail.version)),
    });

  // After a conflict the server copy has moved on: show it instead of the stale typed draft.
  const reloadFromProblem = async () => {
    actions.clearProblem();
    setDialog(null);
    const fresh = await onReload();
    if (fresh) setDraft(draftFromDetail(fresh));
  };

  const scored = official ? detail.games1 !== null : analysis.entered.length > 0;
  const shown = official ? { games1: detail.games1 ?? 0, games2: detail.games2 ?? 0 } : outcome;
  const winnerName = official ? (detail.winnerSide ? names[detail.winnerSide] : null) : outcome.valid && outcome.winnerSide ? names[outcome.winnerSide] : null;

  return (
    <Flex vertical>
      <Flex vertical gap="middle" style={{ padding: 24 }}>
        <MatchDrawerHeader detail={detail} timeZone={timeZone} />
        {actions.problem && (dialog === null || dialog === 'abandon') && <MatchProblemAlert problem={actions.problem} onReload={() => void reloadFromProblem()} />}
        {!official && !detail.ready && <Alert type="info" showIcon message="Trận chưa đủ hai bên nên chưa nhập được tỷ số" />}
        <MatchVersusPanel side1={detail.side1} side2={detail.side2} games1={shown.games1} games2={shown.games2} scored={scored} />
        {official ? (
          <>
            <MatchOfficialResult detail={detail} names={names} />
            <Space wrap>
              {canAmend && <Button onClick={() => openDialog('amend')}>Sửa tỷ số</Button>}
              {canReopen && <Button onClick={() => openDialog('reopen')}>Mở lại</Button>}
            </Space>
          </>
        ) : (
          <>
            <GameScoreInputs
              draft={draft}
              analysis={analysis}
              disabled={!canEnter || !canConfirm || actions.busy}
              side1Name={names[1]}
              side2Name={names[2]}
              onChange={(index, patch) => setDraft((current) => current.map((game, i) => (i === index ? { ...game, ...patch } : game)))}
              onSubmit={submit}
            />
            <MatchWinnerBox winnerName={winnerName} bestOf={detail.format.bestOf} gamesNeeded={gamesToWin(detail.format)} />
          </>
        )}
      </Flex>
      {!official && (
        <MatchActionBar
          detail={detail}
          actions={actions}
          canEnter={canEnter}
          blockReason={blockReason}
          entered={analysis.entered}
          onSubmit={submit}
          onStarted={onStarted}
          onSaved={() => void onReload()}
          onUnStart={unStart}
          onAbandon={() => openDialog('abandon')}
        />
      )}
      {dialog === 'abandon' && (
        <MatchAbandonModal open detail={detail} games={analysis.entered} busy={actions.busy} onCancel={() => setDialog(null)} onSubmit={(body) => void actions.confirm(body).then(afterConfirm)} />
      )}
      {dialog === 'amend' && (
        <AmendScoresModal detail={detail} actions={actions} onClose={() => setDialog(null)} onAmended={afterRewrite} onReopen={() => openDialog('reopen')} onReload={() => void reloadFromProblem()} />
      )}
      {dialog === 'reopen' && (
        <ReopenPreviewModal detail={detail} actions={actions} onClose={() => setDialog(null)} onReopened={afterRewrite} onReload={() => void reloadFromProblem()} />
      )}
    </Flex>
  );
}
