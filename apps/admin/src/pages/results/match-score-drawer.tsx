import { useCan } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Drawer, Flex, Result, Skeleton, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { roundTitle } from '../event-hub/draw-labels';
import { GameScoreInputs } from './game-score-inputs';
import { MatchAbandonModal } from './match-abandon-modal';
import {
  formatText, matchDetailKey, MATCH_STATUS_COLORS, MATCH_STATUS_LABELS, PUBLIC_REFRESH_DELAYED, RESULT_TYPE_LABELS, sideName,
  type MatchDetail, type MatchWriteResponse,
} from './match-types';
import { analyzeDraft, confirmSummary, draftFromDetail, type GameDraft } from './score-draft';
import { useMatchActions, type ConfirmBody } from './use-match-actions';

const DRAWER_WIDTH = 520;

interface MatchScoreDrawerProps {
  matchId: string | null;
  onClose: () => void;
  onStarted: () => void;
  onConfirmed: () => void;
  onReload: () => void;
}

export function MatchScoreDrawer({ matchId, onClose, onStarted, onConfirmed, onReload }: MatchScoreDrawerProps) {
  const detail = useQuery({
    queryKey: matchDetailKey(matchId),
    enabled: matchId !== null,
    queryFn: async () => (await apiFetch<{ data: MatchDetail }>(`/admin/matches/${matchId}`)).data,
  });
  const match = detail.data;
  const reload = () => {
    void detail.refetch();
    onReload();
  };

  return (
    <Drawer open={matchId !== null} onClose={onClose} width={DRAWER_WIDTH} title={match ? `Trận #${match.matchNo}` : 'Nhập tỷ số'} destroyOnHidden>
      {detail.isError && <Result status="error" title="Không tải được trận" extra={<Button onClick={reload}>Tải lại</Button>} />}
      {detail.isLoading && <Skeleton active />}
      {match && <DrawerBody key={match.id} detail={match} onStarted={onStarted} onConfirmed={onConfirmed} onReload={reload} />}
    </Drawer>
  );
}

interface DrawerBodyProps {
  detail: MatchDetail;
  onStarted: () => void;
  onConfirmed: () => void;
  onReload: () => void;
}

function DrawerBody({ detail, onStarted, onConfirmed, onReload }: DrawerBodyProps) {
  const { modal, message } = App.useApp();
  const canStart = useCan({ resource: 'matches', action: 'update' }).data?.can ?? false;
  const canConfirm = useCan({ resource: 'matches', action: 'confirm' }).data?.can ?? false;
  const [draft, setDraft] = useState<GameDraft[]>(() => draftFromDetail(detail));
  const [abandonOpen, setAbandonOpen] = useState(false);
  const actions = useMatchActions(detail.id);
  const analysis = useMemo(() => analyzeDraft(draft, detail.format), [draft, detail.format]);
  const { outcome } = analysis;
  const official = detail.status === 'OFFICIAL';
  const canEnter = !official && detail.ready;
  const names = { 1: sideName(detail.side1), 2: sideName(detail.side2) };

  const afterConfirm = (response: MatchWriteResponse | null) => {
    if (!response) return;
    setAbandonOpen(false);
    if (response.warnings?.includes(PUBLIC_REFRESH_DELAYED)) void message.warning('Đã chốt. Trang công khai sẽ cập nhật chậm hơn');
    else void message.success('Đã chốt kết quả');
    onConfirmed();
  };

  const submit = () => {
    if (!canConfirm || !canEnter || !outcome.valid || !outcome.winnerSide) return;
    const body: ConfirmBody = { expectedVersion: detail.version, resultType: 'NORMAL', games: analysis.entered };
    modal.confirm({
      title: 'Chốt kết quả?',
      content: confirmSummary(names[outcome.winnerSide], outcome, analysis.entered),
      okText: 'Chốt',
      cancelText: 'Hủy',
      onOk: async () => afterConfirm(await actions.confirm(body)),
    });
  };

  const startMatch = async () => {
    if (await actions.start(detail.version)) onStarted();
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

      {actions.problem && <ProblemAlert problem={actions.problem} onReload={onReload} />}
      {!official && !detail.ready && <Alert type="info" showIcon message="Trận chưa đủ hai bên nên chưa nhập được tỷ số" />}

      {official ? (
        <OfficialResult detail={detail} names={names} />
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
          <Space wrap>
            {canConfirm && (
              <Button type="primary" disabled={!canEnter || !outcome.valid} loading={actions.busy} onClick={submit}>
                Chốt kết quả
              </Button>
            )}
            {canStart && detail.status === 'SCHEDULED' && canEnter && (
              <Button disabled={actions.busy} onClick={() => void startMatch()}>
                Bắt đầu
              </Button>
            )}
            {canConfirm && canEnter && <Button onClick={() => setAbandonOpen(true)}>Không đến / Bỏ cuộc</Button>}
          </Space>
          {abandonOpen && (
            <MatchAbandonModal
              open
              detail={detail}
              games={analysis.entered}
              busy={actions.busy}
              onCancel={() => setAbandonOpen(false)}
              onSubmit={(body) => {
                setAbandonOpen(false);
                void actions.confirm(body).then(afterConfirm);
              }}
            />
          )}
        </>
      )}
    </Flex>
  );
}

function ProblemAlert({ problem, onReload }: { problem: NonNullable<ReturnType<typeof useMatchActions>['problem']>; onReload: () => void }) {
  return (
    <Alert
      type="error"
      showIcon
      message={problem.text}
      description={problem.kind === 'issues' ? problem.issues.map((issue) => <div key={issue}>{issue}</div>) : undefined}
      action={problem.kind === 'conflict' ? <Button onClick={onReload}>Tải lại</Button> : undefined}
    />
  );
}

function OfficialResult({ detail, names }: { detail: MatchDetail; names: Record<1 | 2, string> }) {
  return (
    <Flex vertical gap="small">
      {detail.winnerSide && (
        <Typography.Text strong>
          {`Người thắng: ${names[detail.winnerSide]} (${detail.games1}–${detail.games2})`}
          {detail.resultType && detail.resultType !== 'NORMAL' ? ` · ${RESULT_TYPE_LABELS[detail.resultType]}` : ''}
        </Typography.Text>
      )}
      {detail.games.map((game) => (
        <Typography.Text key={game.number}>{`Ván ${game.number}: ${game.score1}–${game.score2}`}</Typography.Text>
      ))}
    </Flex>
  );
}
