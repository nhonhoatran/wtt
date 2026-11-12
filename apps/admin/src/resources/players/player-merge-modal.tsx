import { useQuery } from '@tanstack/react-query';
import { Alert, App, Descriptions, Flex, Form, Input, Modal, Skeleton, Typography, theme } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { PlayerLookupSelect } from '../../components/player-lookup-select';
import { useStepUp } from '../../components/step-up-modal';
import { playerCodeName, playerSummary, type PlayerLookupItem, type PlayerRecord } from './player-labels';

interface MergePreview {
  target: PlayerRecord;
  source: PlayerRecord;
  counts: { entries: number; pairs: number; matches: number };
  conflicts: { code: string; message: string }[];
  canMerge: boolean;
}

interface PlayerMergeModalProps {
  /** The profile that is kept; the duplicate picked here is merged into it. */
  target: PlayerRecord | null;
  onClose: () => void;
  onMerged: () => void;
}

export function PlayerMergeModal({ target, onClose, onMerged }: PlayerMergeModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const runWithStepUp = useStepUp();
  const [source, setSource] = useState<PlayerLookupItem | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ['player-merge-preview', target?.id, source?.id],
    enabled: Boolean(target && source),
    retry: false,
    queryFn: async () =>
      (await apiFetch<{ data: MergePreview }>(`/admin/players/merge/preview?targetId=${target!.id}&sourceId=${source!.id}`)).data,
  });
  const data = preview.data;

  const reset = () => {
    setSource(null);
    setReason('');
    setError(null);
  };

  const submit = async () => {
    if (!target || !source) return;
    setSaving(true);
    setError(null);
    try {
      await runWithStepUp(() =>
        apiFetch('/admin/players/merge', { method: 'POST', body: { targetId: target.id, sourceId: source.id, reason: reason.trim() } }),
      );
      message.success(`Đã gộp ${playerCodeName(source)} vào ${playerCodeName(target)}`);
      onMerged();
      onClose();
    } catch (failure) {
      const conflicts = failure instanceof ApiError && failure.code === 'MERGE_CONFLICT' ? failure.issues : undefined;
      if (conflicts?.length) setError(`${failure instanceof Error ? failure.message : 'Không gộp được'}: ${conflicts.map((issue) => issue.message).join('; ')}`);
      else setError(failure instanceof Error ? failure.message : 'Không gộp được');
    } finally {
      setSaving(false);
    }
  };

  const previewError = preview.error instanceof ApiError ? preview.error.message : preview.error ? 'Không xem trước được' : null;

  return (
    <Modal
      open={Boolean(target)}
      title={target ? `Gộp hồ sơ trùng vào ${playerCodeName(target)}` : 'Gộp VĐV'}
      okText="Gộp VĐV"
      cancelText="Hủy"
      okButtonProps={{ danger: true, loading: saving, disabled: !data?.canMerge || !reason.trim() }}
      onOk={submit}
      onCancel={onClose}
      afterClose={reset}
      width={640}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Text>
          Giữ lại <Typography.Text strong>{target && playerSummary(target)}</Typography.Text>. Chọn hồ sơ bị trùng: mọi đăng ký và cặp đôi của hồ sơ đó chuyển sang hồ sơ được giữ.
        </Typography.Text>
        <Form layout="vertical">
          <Form.Item label="Hồ sơ trùng cần gộp" required>
            <PlayerLookupSelect
              autoFocus
              value={source}
              onChange={setSource}
              gender={target?.gender}
              excludeIds={target ? [target.id] : undefined}
              placeholder="Gõ tên hoặc mã VĐV bị trùng"
              aria-label="Hồ sơ trùng cần gộp"
            />
          </Form.Item>
        </Form>
        {source && preview.isLoading && <Skeleton active paragraph={{ rows: 2 }} />}
        {previewError && <Alert type="error" showIcon message={previewError} />}
        {data && (
          <>
            <Descriptions size="small" column={3} bordered title="Sẽ chuyển sang hồ sơ được giữ">
              <Descriptions.Item label="Đăng ký">{data.counts.entries}</Descriptions.Item>
              <Descriptions.Item label="Cặp đôi">{data.counts.pairs}</Descriptions.Item>
              <Descriptions.Item label="Trận đấu">{data.counts.matches}</Descriptions.Item>
            </Descriptions>
            {data.conflicts.length > 0 && (
              <Alert
                type="error"
                showIcon
                message="Không gộp được vì:"
                description={data.conflicts.map((conflict) => <div key={conflict.code + conflict.message}>{conflict.message}</div>)}
              />
            )}
            {data.canMerge && (
              <>
                <Alert type="warning" showIcon message="Không hoàn tác được. Hồ sơ trùng sẽ bị ẩn và chuyển hướng sang hồ sơ được giữ." />
                <Form layout="vertical">
                  <Form.Item label="Lý do gộp" required extra="Ghi vào nhật ký thao tác.">
                    <Input.TextArea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
                  </Form.Item>
                </Form>
              </>
            )}
          </>
        )}
      </Flex>
    </Modal>
  );
}
