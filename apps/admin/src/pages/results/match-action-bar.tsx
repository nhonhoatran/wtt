import { useCan } from '@refinedev/core';
import { Button, Flex, theme, Typography } from 'antd';
import type { GameScore } from '@kamito/competition-engine';
import type { MatchDetail } from './match-types';
import type { MatchActions } from './use-match-actions';

interface MatchActionBarProps {
  detail: MatchDetail;
  actions: MatchActions;
  canEnter: boolean;
  /** Why confirming is off, or null when it is on. */
  blockReason: string | null;
  entered: GameScore[];
  onSubmit: () => void;
  onStarted: () => void;
  onSaved: () => void;
  onUnStart: () => void;
  onAbandon: () => void;
}

const REASON_ID = 'match-confirm-reason';

/** Sticky drawer footer: what confirming does, the secondary tools, and the primary action with its reason when off. */
export function MatchActionBar({ detail, actions, canEnter, blockReason, entered, onSubmit, onStarted, onSaved, onUnStart, onAbandon }: MatchActionBarProps) {
  const { token } = theme.useToken();
  const canStart = useCan({ resource: 'matches', action: 'update' }).data?.can ?? false;
  const canConfirm = useCan({ resource: 'matches', action: 'confirm' }).data?.can ?? false;
  const live = detail.status === 'LIVE';

  return (
    <Flex
      vertical
      gap="small"
      style={{ position: 'sticky', bottom: 0, zIndex: 1, padding: '12px 24px', background: token.colorBgElevated, borderTop: `1px solid ${token.colorBorderSecondary}` }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Sau khi xác nhận, kết quả hiện trên trang giải và người thắng được đưa vào vòng sau.
      </Typography.Text>
      <Flex wrap gap="small" justify="space-between" align="start">
        <Flex wrap gap="small">
          {canStart && detail.status === 'SCHEDULED' && canEnter && (
            <Button disabled={actions.busy} onClick={() => void actions.start(detail.version).then((response) => response && onStarted())}>
              Bắt đầu
            </Button>
          )}
          {canStart && live && (
            <Button disabled={actions.busy} onClick={onUnStart}>
              Hủy bắt đầu
            </Button>
          )}
          {canConfirm && canEnter && (
            <Button type="text" onClick={onAbandon}>
              Trận không đấu đủ…
            </Button>
          )}
        </Flex>
        <Flex vertical align="flex-end" gap={4}>
          <Flex wrap gap="small" justify="flex-end">
            {canStart && live && (
              <Button disabled={actions.busy || entered.length === 0} onClick={() => void actions.saveProgress(detail.version, entered).then((response) => response && onSaved())}>
                Lưu nháp
              </Button>
            )}
            {canConfirm && (
              <Button type="primary" disabled={!canEnter || blockReason !== null} loading={actions.busy} onClick={onSubmit} aria-describedby={blockReason ? REASON_ID : undefined}>
                Xác nhận kết quả
              </Button>
            )}
          </Flex>
          {canConfirm && blockReason && (
            <Typography.Text id={REASON_ID} type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
              {blockReason}
            </Typography.Text>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
