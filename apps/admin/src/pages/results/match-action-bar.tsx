import { useCan } from '@refinedev/core';
import { Button, Space } from 'antd';
import type { GameScore } from '@kamito/competition-engine';
import type { MatchDetail } from './match-types';
import type { MatchActions } from './use-match-actions';

interface MatchActionBarProps {
  detail: MatchDetail;
  actions: MatchActions;
  canEnter: boolean;
  canValid: boolean;
  entered: GameScore[];
  onSubmit: () => void;
  onStarted: () => void;
  onSaved: () => void;
  onUnStart: () => void;
  onAbandon: () => void;
}

export function MatchActionBar({ detail, actions, canEnter, canValid, entered, onSubmit, onStarted, onSaved, onUnStart, onAbandon }: MatchActionBarProps) {
  const canStart = useCan({ resource: 'matches', action: 'update' }).data?.can ?? false;
  const canConfirm = useCan({ resource: 'matches', action: 'confirm' }).data?.can ?? false;
  const live = detail.status === 'LIVE';

  return (
    <Space wrap>
      {canConfirm && (
        <Button type="primary" disabled={!canEnter || !canValid} loading={actions.busy} onClick={onSubmit}>
          Chốt kết quả
        </Button>
      )}
      {canStart && detail.status === 'SCHEDULED' && canEnter && (
        <Button disabled={actions.busy} onClick={() => void actions.start(detail.version).then((response) => response && onStarted())}>
          Bắt đầu
        </Button>
      )}
      {canStart && live && (
        <Button disabled={actions.busy || entered.length === 0} onClick={() => void actions.saveProgress(detail.version, entered).then((response) => response && onSaved())}>
          Lưu tạm
        </Button>
      )}
      {canStart && live && (
        <Button disabled={actions.busy} onClick={onUnStart}>
          Hủy bắt đầu
        </Button>
      )}
      {canConfirm && canEnter && <Button onClick={onAbandon}>Không đến / Bỏ cuộc</Button>}
    </Space>
  );
}
