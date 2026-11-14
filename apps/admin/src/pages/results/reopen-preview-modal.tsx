import { MATCH_REASON_MAX_LENGTH, MATCH_REASON_MIN_LENGTH } from '@kamito/shared';
import { useCan } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Flex, Form, Input, Modal, Skeleton, theme } from 'antd';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { useConfirmAction } from '../../components/confirm-action-button';
import { MatchProblemAlert } from './match-problem-alert';
import type { MatchDetail, MatchWriteResponse, ReopenCell, ReopenPreview } from './match-types';
import type { MatchActions } from './use-match-actions';

const affectedText = (cell: ReopenCell): string =>
  cell.effect === 'REVERT_AUTO'
    ? `Sẽ gỡ ${cell.entryName} khỏi trận #${cell.matchNo} (tự động xử thắng, sẽ được hoàn lại)`
    : `Sẽ gỡ ${cell.entryName} khỏi trận #${cell.matchNo} (chưa đấu)`;
const blockingText = (cell: ReopenCell): string => `Trận #${cell.matchNo} (${cell.entryName}) đã đấu — sẽ bị xóa kết quả`;

interface ReopenPreviewModalProps {
  detail: MatchDetail;
  actions: MatchActions;
  onClose: () => void;
  onReopened: (response: MatchWriteResponse | null) => void;
  onReload: () => void;
}

export function ReopenPreviewModal({ detail, actions, onClose, onReopened, onReload }: ReopenPreviewModalProps) {
  const { token } = theme.useToken();
  const confirm = useConfirmAction();
  const canReopen = useCan({ resource: 'matches', action: 'reopen' }).data?.can ?? false;
  const [reason, setReason] = useState('');
  const [fresh, setFresh] = useState<ReopenPreview | null>(null);
  const query = useQuery({
    queryKey: ['admin-match-reopen-preview', detail.id, detail.version],
    retry: false,
    gcTime: 0,
    queryFn: async () => (await apiFetch<{ data: ReopenPreview }>(`/admin/matches/${detail.id}/reopen-preview`)).data,
  });
  const { problem } = actions;
  const problemPreview = problem?.kind === 'error' ? problem.preview : undefined;
  useEffect(() => {
    if (problemPreview) setFresh(problemPreview);
  }, [problemPreview]);

  const preview = fresh ?? query.data;
  const blocking = preview?.blocking ?? [];
  const blocked = blocking.length > 0;
  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= MATCH_REASON_MIN_LENGTH;
  const reasonTooShort = reason.length > 0 && !reasonOk;
  const loadError = query.error instanceof ApiError ? query.error.message : query.error ? 'Không xem trước được' : null;

  const submit = async (force: boolean) => {
    const body = { expectedVersion: detail.version, reason: trimmed, ...(force && { force: true, expectedBlockingIds: blocking.map((cell) => cell.matchId) }) };
    onReopened(await actions.reopen(body));
  };

  const forceReopen = () =>
    confirm({
      title: 'Cưỡng chế mở lại?',
      content: `Kết quả của ${blocking.length} trận đã đấu phía sau sẽ bị xóa và không khôi phục được.`,
      okText: 'Cưỡng chế mở lại',
      danger: true,
      onConfirm: () => submit(true),
    });

  return (
    <Modal
      open
      title={`Mở lại trận #${detail.matchNo}`}
      onCancel={onClose}
      width={640}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap="small" wrap>
          <Button onClick={onClose}>Hủy</Button>
          {blocked && canReopen && (
            <Button danger type="primary" disabled={!reasonOk || actions.busy} onClick={forceReopen}>
              Cưỡng chế mở lại
            </Button>
          )}
          {!blocked && (
            <Button type="primary" loading={actions.busy} disabled={!preview || !reasonOk} onClick={() => void submit(false)}>
              Mở lại
            </Button>
          )}
        </Flex>
      }
    >
      <Flex vertical gap={token.margin}>
        {problem && <MatchProblemAlert problem={problem} onReload={onReload} />}
        {query.isLoading && <Skeleton active paragraph={{ rows: 2 }} />}
        {loadError && <Alert type="error" showIcon message={loadError} />}
        {detail.drawKind === 'GROUP' && (
          <Alert type="warning" showIcon message="Đây là trận vòng bảng: mở lại sẽ gỡ toàn bộ suất của bảng này khỏi nhánh chính." />
        )}
        {preview && blocked && (
          <Alert
            type="error"
            showIcon
            message="Có trận phía sau đã đấu"
            description={
              <>
                {blocking.map((cell) => <div key={`${cell.matchId}-${cell.side}`}>{blockingText(cell)}</div>)}
                <div>{canReopen ? 'Chỉ cưỡng chế mở lại mới xóa được các kết quả này.' : 'Cần quản trị viên cưỡng chế mở lại để xóa các kết quả này.'}</div>
              </>
            }
          />
        )}
        {preview && preview.affected.length > 0 && (
          <Alert type="warning" showIcon message="Sẽ bị ảnh hưởng" description={preview.affected.map((cell) => <div key={`${cell.matchId}-${cell.side}`}>{affectedText(cell)}</div>)} />
        )}
        {preview && !blocked && preview.affected.length === 0 && <Alert type="info" showIcon message="Không có trận nào bị ảnh hưởng." />}
        <Form layout="vertical">
          <Form.Item
            label="Lý do"
            htmlFor="reopen-reason"
            required
            extra="Ghi vào nhật ký thao tác."
            validateStatus={reasonTooShort ? 'error' : undefined}
            help={reasonTooShort ? `Lý do tối thiểu ${MATCH_REASON_MIN_LENGTH} ký tự` : undefined}
          >
            <Input.TextArea id="reopen-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={MATCH_REASON_MAX_LENGTH} />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}
