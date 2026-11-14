import { useQuery } from '@tanstack/react-query';
import { Alert, App, Flex, Form, Input, Modal, Radio, Select, Skeleton, Typography, theme } from 'antd';
import { useState } from 'react';
import { DRAW_REASON_MAX_LENGTH, DRAW_REASON_MIN_LENGTH as MIN_REASON_LENGTH } from '@kamito/shared';
import { ApiError, apiFetch } from '../../api/http-client';
import type { CellActionTarget } from './admin-bracket-view';
import { blockedText, impactText } from './draw-impact-text';
import type { BracketData, DryRunResult } from './draw-types';
import { useReplacementEntries } from './use-replacement-entries';
import type { DrawCall } from './use-draw-call';

type Operation = 'replace' | 'withdraw' | 'unpublish';
export type DrawActionTarget = ({ mode: 'cell' } & CellActionTarget) | { mode: 'unpublish' };


const OK_TEXT: Record<Operation, string> = { replace: 'Thay VĐV', withdraw: 'Rút khỏi nhánh', unpublish: 'Bỏ công bố' };
const DONE_TEXT: Record<Operation, string> = { replace: 'Đã thay VĐV', withdraw: 'Đã rút VĐV khỏi nhánh', unpublish: 'Đã bỏ công bố nhánh đấu' };
const ENDPOINT: Record<Operation, string> = { replace: 'replace-entry', withdraw: 'withdraw-entry', unpublish: 'unpublish' };

interface DrawEntryActionModalProps {
  target: DrawActionTarget | null;
  data: BracketData;
  call: DrawCall;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}

export function DrawEntryActionModal({ target, data, call, onClose, onDone }: DrawEntryActionModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [picked, setPicked] = useState<'replace' | 'withdraw'>('replace');
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const operation: Operation = target?.mode === 'cell' ? picked : 'unpublish';
  const cell = target?.mode === 'cell' ? target : null;
  // Group views carry no `positions`; only a bracket cell action needs the taken set.
  const taken = new Set(cell ? data.positions.flatMap((position) => (position.entry ? [position.entry.id] : [])) : []);
  const replacements = useReplacementEntries(data.subEventId, operation === 'replace' && Boolean(cell), taken);
  const ready = operation !== 'replace' || Boolean(newEntryId);
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH;

  const bodyFor = (text: string | undefined, dryRun: boolean) => ({
    ...(operation === 'replace' && { positionId: cell?.positionId, newEntryId }),
    ...(operation === 'withdraw' && { entryId: cell?.entry.id }),
    ...(text && { reason: text }),
    expectedVersion: data.version,
    ...(dryRun && { dryRun: true }),
  });

  const preview = useQuery({
    queryKey: ['admin-draw-impact', data.id, data.version, operation, cell?.positionId, newEntryId],
    enabled: Boolean(target) && ready,
    retry: false,
    gcTime: 0,
    queryFn: async () =>
      (await apiFetch<{ data: DryRunResult }>(`/admin/draws/${data.id}/${ENDPOINT[operation]}`, { method: 'POST', body: bodyFor(undefined, true) })).data,
  });
  const result = preview.data;
  const previewError = preview.error instanceof ApiError ? preview.error.message : preview.error ? 'Không xem trước được' : null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await call(() => apiFetch(`/admin/draws/${data.id}/${ENDPOINT[operation]}`, { method: 'POST', body: bodyFor(reason.trim(), false) }));
      message.success(DONE_TEXT[operation]);
      await onDone();
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Không thực hiện được, thử lại');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPicked('replace');
    setNewEntryId(null);
    setReason('');
    setError(null);
  };

  return (
    <Modal
      open={Boolean(target)}
      title={cell ? `Thao tác với ${cell.entry.displayName}` : 'Bỏ công bố nhánh đấu'}
      okText={OK_TEXT[operation]}
      cancelText="Hủy"
      okButtonProps={{ danger: operation !== 'replace', loading: saving, disabled: !result?.allowed || reason.trim().length < MIN_REASON_LENGTH }}
      onOk={submit}
      onCancel={onClose}
      afterClose={reset}
      width={640}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {error && <Alert type="error" showIcon message={error} />}
        {cell && (
          <Radio.Group
            value={picked}
            onChange={(event) => {
              setPicked(event.target.value);
              setNewEntryId(null);
            }}
            options={[
              { value: 'replace', label: 'Thay VĐV' },
              { value: 'withdraw', label: 'Rút khỏi nhánh' },
            ]}
          />
        )}
        {operation === 'unpublish' && <Typography.Text>Nhánh đấu về trạng thái nháp và không còn công khai.</Typography.Text>}
        {operation === 'replace' && (
          <Form layout="vertical">
            <Form.Item label="VĐV thay thế" required extra="Chỉ hiện đăng ký đang tham gia và chưa có trong nhánh.">
              <Select
                showSearch
                filterOption={false}
                placeholder="Gõ tên để tìm"
                aria-label="VĐV thay thế"
                value={newEntryId}
                options={replacements.options}
                loading={replacements.loading}
                onSearch={replacements.onSearch}
                onChange={setNewEntryId}
                status={replacements.failed ? 'error' : undefined}
              />
            </Form.Item>
          </Form>
        )}
        {ready && preview.isLoading && <Skeleton active paragraph={{ rows: 2 }} />}
        {previewError && <Alert type="error" showIcon message={previewError} />}
        {result && !result.allowed && <Alert type="error" showIcon message={blockedText(result.blockedCode)} />}
        {result?.allowed && (
          <Alert
            type={result.impacts.length > 0 ? 'warning' : 'info'}
            showIcon
            message={result.impacts.length > 0 ? 'Ảnh hưởng' : 'Không có trận nào bị ảnh hưởng.'}
            description={result.impacts.map((impact, index) => (
              <div key={`${impact.type}-${impact.matchId ?? index}`}>{impactText(impact)}</div>
            ))}
          />
        )}
        <Form layout="vertical">
          <Form.Item
            label="Lý do"
            required
            extra="Ghi vào nhật ký thao tác."
            validateStatus={reasonTooShort ? 'error' : undefined}
            help={reasonTooShort ? `Lý do tối thiểu ${MIN_REASON_LENGTH} ký tự` : undefined}
          >
            <Input.TextArea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={DRAW_REASON_MAX_LENGTH} />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}
