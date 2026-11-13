import { Alert, App, Flex, Form, Input, InputNumber, Modal, Typography, theme } from 'antd';
import { useState } from 'react';
import { DRAW_REASON_MAX_LENGTH, DRAW_REASON_MIN_LENGTH as MIN_REASON_LENGTH } from '@kamito/shared';
import { ApiError, apiFetch } from '../../api/http-client';
import type { GroupRecord } from './draw-types';
import type { DrawCall } from './use-draw-call';

const RANK_INPUT_WIDTH = 96;

interface ManualTiebreakModalProps {
  group: GroupRecord | null;
  call: DrawCall;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

/** Players still tied after every criterion get a hand-picked rank; the ranks must fill the tied range exactly once. */
export function ManualTiebreakModal({ group, call, onClose, onSaved }: ManualTiebreakModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [edited, setEdited] = useState<Record<string, number | null>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tied = group?.standings.filter((row) => row.needsManualTiebreak) ?? [];
  const names = new Map(group?.members.map((member) => [member.entryId, member.entry.displayName]));
  const firstRank = Math.min(...tied.map((row) => row.rank ?? Number.POSITIVE_INFINITY));
  const low = Number.isFinite(firstRank) ? firstRank : 1;
  const high = low + tied.length - 1;
  const valueOf = (entryId: string, manualRank: number | null) => (entryId in edited ? edited[entryId]! : manualRank);

  const values = tied.map((row) => valueOf(row.entryId, row.manualRank));
  const fieldError = (value: number | null, index: number): string | null => {
    if (value === null) return `Nhập thứ hạng từ ${low} đến ${high}`;
    if (value < low || value > high) return `Thứ hạng phải từ ${low} đến ${high}`;
    return values.findIndex((other) => other === value) !== index ? 'Thứ hạng này đã dùng cho người khác' : null;
  };
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH;
  const invalid = tied.length === 0 || values.some((value, index) => fieldError(value, index) !== null) || reason.trim().length < MIN_REASON_LENGTH;

  const submit = async () => {
    if (!group) return;
    setSaving(true);
    setError(null);
    try {
      const ranks = Object.fromEntries(tied.map((row, index) => [row.entryId, values[index]]));
      await call(() => apiFetch(`/admin/groups/${group.id}/manual-ranks`, { method: 'PATCH', body: { ranks, reason: reason.trim(), expectedVersion: group.version } }));
      message.success(`Đã lưu thứ hạng bảng ${group.code}`);
      await onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Không lưu được thứ hạng, thử lại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(group)}
      title={group ? `Phá hòa bảng ${group.code}` : 'Phá hòa'}
      okText="Lưu thứ hạng"
      cancelText="Hủy"
      okButtonProps={{ loading: saving, disabled: invalid }}
      onOk={submit}
      onCancel={onClose}
      afterClose={() => {
        setEdited({});
        setReason('');
        setError(null);
      }}
      width={640}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Text>Các VĐV dưới đây hòa nhau sau mọi tiêu chí. Xếp thứ hạng từ {low} đến {high}, mỗi người một hạng.</Typography.Text>
        <Form layout="vertical">
          {tied.map((row, index) => {
            const problem = values[index] === null && !(row.entryId in edited) ? null : fieldError(values[index]!, index);
            return (
              <Form.Item
                key={row.entryId}
                label={`${names.get(row.entryId) ?? '—'} (${row.won}-${row.lost}, ván ${row.gamesFor}-${row.gamesAgainst})`}
                validateStatus={problem ? 'error' : undefined}
                help={problem ?? undefined}
              >
                <InputNumber<number>
                  min={low}
                  max={high}
                  precision={0}
                  value={values[index]}
                  onChange={(next) => setEdited((current) => ({ ...current, [row.entryId]: next }))}
                  style={{ width: RANK_INPUT_WIDTH }}
                  aria-label={`Thứ hạng của ${names.get(row.entryId) ?? ''}`}
                />
              </Form.Item>
            );
          })}
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
