import { validateMatchScore, type GameScore } from '@kamito/competition-engine';
import { Alert, Modal, Radio, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { sideName, RESULT_TYPE_LABELS, type MatchDetail, type MatchResultType } from './match-types';
import type { ConfirmBody } from './use-match-actions';

type AbandonType = Exclude<MatchResultType, 'NORMAL'>;
const ABANDON_TYPES: AbandonType[] = ['WALKOVER', 'RETIRED', 'DISQUALIFIED'];

interface MatchAbandonModalProps {
  open: boolean;
  detail: MatchDetail;
  /** Games typed in the drawer; sent for RETIRED / DISQUALIFIED only. */
  games: GameScore[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: ConfirmBody) => void;
}

export function MatchAbandonModal({ open, detail, games, busy, onCancel, onSubmit }: MatchAbandonModalProps) {
  const [resultType, setResultType] = useState<AbandonType>('WALKOVER');
  const [winnerSide, setWinnerSide] = useState<1 | 2 | undefined>();
  const sentGames = resultType === 'WALKOVER' ? [] : games;
  const outcome = useMemo(
    () => validateMatchScore({ games: sentGames, format: detail.format, resultType, winnerSide }),
    [sentGames, detail.format, resultType, winnerSide],
  );

  return (
    <Modal
      open={open}
      title="Không đến / Bỏ cuộc"
      okText="Chốt kết quả"
      cancelText="Hủy"
      okButtonProps={{ disabled: !outcome.valid, loading: busy }}
      onCancel={onCancel}
      onOk={() => onSubmit({ expectedVersion: detail.version, resultType, winnerSide, games: sentGames })}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Radio.Group value={resultType} onChange={(event) => setResultType(event.target.value as AbandonType)}>
          <Space direction="vertical">
            {ABANDON_TYPES.map((type) => (
              <Radio key={type} value={type}>
                {RESULT_TYPE_LABELS[type]}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
        <div>
          <Typography.Text strong>Bên thắng</Typography.Text>
          <br />
          <Radio.Group value={winnerSide} onChange={(event) => setWinnerSide(event.target.value as 1 | 2)}>
            <Space direction="vertical">
              <Radio value={1}>{sideName(detail.side1)}</Radio>
              <Radio value={2}>{sideName(detail.side2)}</Radio>
            </Space>
          </Radio.Group>
        </div>
        {resultType !== 'WALKOVER' && <Typography.Text type="secondary">Các ván đã nhập trong khung nhập tỷ số sẽ được gửi kèm.</Typography.Text>}
        {winnerSide !== undefined && outcome.issues.length > 0 && (
          <Alert type="error" showIcon message={outcome.issues.map((issue) => issue.message).join('; ')} />
        )}
      </Space>
    </Modal>
  );
}
