import { useCan } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Flex, Result, Skeleton, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { useConfirmAction } from '../../components/confirm-action-button';
import { roundTitle } from '../event-hub/draw-labels';
import { AmendScoresModal } from './amend-scores-modal';
import { GameScoreInputs } from './game-score-inputs';
import { MatchActionBar } from './match-action-bar';
import { MatchAbandonModal } from './match-abandon-modal';
import { MatchOfficialResult } from './match-official-result';
import { MatchProblemAlert } from './match-problem-alert';
import { formatText, matchDetailKey, MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, sideName, type MatchDetail, type MatchWriteResponse } from './match-types';
import { ReopenPreviewModal } from './reopen-preview-modal';
import { analyzeDraft, confirmSummary, draftFromDetail, type GameDraft } from './score-draft';
import { useMatchActions, type ConfirmBody } from './use-match-actions';

const DRAWER_WIDTH = 520;

interface MatchScoreDrawerProps {
  matchId: string | null;
  onClose: () => void;
  onStarted: () => void;
  onConfirmed: (finishedTableId: string | null) => void;
  onReload: () => void;
}

export function MatchScoreDrawer({ matchId, onClose, onStarted, onConfirmed, onReload }: MatchScoreDrawerProps) {
  const detail = useQuery({
    queryKey: matchDetailKey(matchId),
    enabled: matchId !== null,
    queryFn: async () => (await apiFetch<{ data: MatchDetail }>(`/admin/matches/${matchId}`)).data,
  });
  const match = detail.data;
  const reload = async () => {
    onReload();
    return (await detail.refetch()).data;
  };

  return (
    <Drawer open={matchId !== null} onClose={onClose} width={DRAWER_WIDTH} title={match ? `Trận #${match.matchNo}` : 'Nhập tỷ số'} destroyOnHidden>
      {detail.isError && <Result status="error" title="Không tải được trận" extra={<Button onClick={() => void reload()}>Tải lại</Button>} />}
      {detail.isLoading && <Skeleton active />}
      {match && <DrawerBody key={match.id} detail={match} onStarted={onStarted} onConfirmed={onConfirmed} onReload={reload} />}
    </Drawer>
  );
}

interface DrawerBodyProps {
  detail: MatchDetail;
  onStarted: () => void;
  onConfirmed: (finishedTableId: string | null) => void;
  onReload: () => Promise<MatchDetail | undefined>;
}

type Dialog = 'abandon' | 'amend' | 'reopen' | null;

function DrawerBody({ detail, onStarted, onConfirmed, onReload }: DrawerBodyProps) {
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
      title: 'Chốt kết quả?',
      content: confirmSummary(names[outcome.winnerSide], outcome, analysis.entered),
      okText: 'Chốt',
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

  return (
    <Flex vertical gap="middle">
      <Space wrap>
        <Tag color={MATCH_STATUS_COLORS[detail.status]}>{MATCH_STATUS_LABELS[detail.status]}</Tag>
        <Typography.Text type="secondary">
          {detail.subEventName ?? detail.subEventCode} · {roundTitle(detail.roundCode)}
          {detail.groupCode ? ` · Bảng ${detail.groupCode}` : ''}
        </Typography.Text>
      </Space>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {names[1]} <Typography.Text type="secondary">vs</Typography.Text> {names[2]}
      </Typography.Title>
      <Typography.Text>{formatText(detail.format)}</Typography.Text>

      {actions.problem && (dialog === null || dialog === 'abandon') && <MatchProblemAlert problem={actions.problem} onReload={() => void reloadFromProblem()} />}
      {!official && !detail.ready && <Alert type="info" showIcon message="Trận chưa đủ hai bên nên chưa nhập được tỷ số" />}

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
            onEnter={submit}
          />
          <Typography.Text strong aria-live="polite">
            {outcome.valid && outcome.winnerSide ? `Người thắng: ${names[outcome.winnerSide]} (${outcome.games1}–${outcome.games2})` : 'Chưa xác định người thắng'}
          </Typography.Text>
          <MatchActionBar
            detail={detail}
            actions={actions}
            canEnter={canEnter}
            canValid={outcome.valid}
            entered={analysis.entered}
            onSubmit={submit}
            onStarted={onStarted}
            onSaved={() => void onReload()}
            onUnStart={unStart}
            onAbandon={() => openDialog('abandon')}
          />
          {dialog === 'abandon' && (
            <MatchAbandonModal
              open
              detail={detail}
              games={analysis.entered}
              busy={actions.busy}
              onCancel={() => setDialog(null)}
              onSubmit={(body) => void actions.confirm(body).then(afterConfirm)}
            />
          )}
        </>
      )}
      {dialog === 'amend' && (
        <AmendScoresModal
          detail={detail}
          actions={actions}
          onClose={() => setDialog(null)}
          onAmended={afterRewrite}
          onReopen={() => openDialog('reopen')}
          onReload={() => void reloadFromProblem()}
        />
      )}
      {dialog === 'reopen' && (
        <ReopenPreviewModal detail={detail} actions={actions} onClose={() => setDialog(null)} onReopened={afterRewrite} onReload={() => void reloadFromProblem()} />
      )}
    </Flex>
  );
}
