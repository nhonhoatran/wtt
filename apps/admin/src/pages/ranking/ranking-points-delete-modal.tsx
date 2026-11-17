import { Alert, App, Flex, Form, Input, Modal, Typography, theme } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { useStepUp } from '../../components/step-up-modal';
import { RANKING_REASON_MAX_LENGTH, RANKING_REASON_MIN_LENGTH } from '@kamito/shared';

export interface DeletablePoints {
  id: string;
  points: number;
  playerLabel: string;
}

interface Props {
  target: DeletablePoints | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function RankingPointsDeleteModal({ target, onClose, onDeleted }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const runWithStepUp = useStepUp();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const tooShort = reason.trim().length < RANKING_REASON_MIN_LENGTH;

  const reset = () => {
    setReason('');
    setError(null);
    setReasonError(undefined);
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    setReasonError(undefined);
    try {
      const response = await runWithStepUp(() =>
        apiFetch(`/admin/ranking-points/${target.id}`, { method: 'DELETE', body: { reason: reason.trim() } }),
      );
      message.success('Đã xóa dòng điểm thủ công');
      showWarnings(message, warningsOf(response));
      onDeleted();
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.errors?.reason) setReasonError(failure.errors.reason);
      else setError(failure instanceof Error ? failure.message : 'Không xóa được dòng điểm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(target)}
      width={640}
      title="Xóa dòng điểm thủ công"
      okText="Xóa điểm"
      cancelText="Hủy"
      okButtonProps={{ danger: true, loading: saving, disabled: tooShort }}
      onOk={submit}
      onCancel={onClose}
      afterClose={reset}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Text>
          Xóa {target?.points} điểm của {target?.playerLabel}? Không hoàn tác được.
        </Typography.Text>
        <Form layout="vertical">
          <Form.Item
            label="Lý do xóa"
            required
            extra="Ghi vào nhật ký thao tác."
            validateStatus={reasonError || (reason && tooShort) ? 'error' : undefined}
            help={reasonError ?? (reason && tooShort ? `Lý do tối thiểu ${RANKING_REASON_MIN_LENGTH} ký tự` : undefined)}
          >
            <Input.TextArea rows={2} autoFocus maxLength={RANKING_REASON_MAX_LENGTH} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}
