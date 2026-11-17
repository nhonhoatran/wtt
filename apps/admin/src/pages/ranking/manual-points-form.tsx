import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { PlayerLookupSelect } from '../../components/player-lookup-select';
import { useStepUp } from '../../components/step-up-modal';
import { RANKING_REASON_MAX_LENGTH, RANKING_REASON_MIN_LENGTH } from '@kamito/shared';
import { DATE_ONLY_FORMAT, DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { useCatalogSelect } from '../../resources/events/use-catalog-options';
import type { PlayerLookupItem } from '../../resources/players/player-labels';

interface FormValues {
  rankingListId?: string;
  player?: PlayerLookupItem | null;
  points?: number | null;
  earnedAt?: Dayjs | null;
  expiresAt?: Dayjs | null;
  reason?: string;
}

const FIELD_NAMES: Record<string, keyof FormValues> = { rankingListId: 'rankingListId', playerId: 'player' };
function PlayerField({ value, onChange }: { value?: PlayerLookupItem | null; onChange?: (player: PlayerLookupItem | null) => void }) {
  return <PlayerLookupSelect value={value} onChange={(player) => onChange?.(player)} placeholder="Gõ tên hoặc mã VĐV" aria-label="Vận động viên" />;
}

const iso = (value: Dayjs) => value.format(DATE_ONLY_FORMAT);

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-selected list, e.g. the one the ledger is filtered to. */
  defaultListId?: string;
}

export function ManualPointsForm({ open, onClose, onCreated, defaultListId }: Props) {
  const { message } = App.useApp();
  const runWithStepUp = useStepUp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const lists = useCatalogSelect('ranking-lists', { labelOf: (row) => `${String(row.code)} – ${row.name}` });
  const values = Form.useWatch([], form);
  const ready = Boolean(values?.rankingListId && values.player && values.points && values.earnedAt && values.reason?.trim());

  const submit = async (input: FormValues) => {
    setSaving(true);
    try {
      const response = await runWithStepUp(() =>
        apiFetch('/admin/ranking-points', {
          method: 'POST',
          body: {
            rankingListId: input.rankingListId,
            playerId: input.player?.id,
            points: input.points,
            earnedAt: input.earnedAt ? iso(input.earnedAt) : undefined,
            expiresAt: input.expiresAt ? iso(input.expiresAt) : undefined,
            reason: input.reason?.trim(),
          },
        }),
      );
      message.success('Đã thêm điểm thủ công');
      showWarnings(message, warningsOf(response));
      onCreated();
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.errors) {
        form.setFields(Object.entries(failure.errors).map(([name, error]) => ({ name: (FIELD_NAMES[name] ?? name) as keyof FormValues, errors: [error] })));
      } else {
        message.error(failure instanceof Error ? failure.message : 'Không thêm được điểm');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      width={640}
      title="Thêm điểm thủ công"
      okText="Thêm điểm"
      cancelText="Hủy"
      okButtonProps={{ loading: saving, disabled: !ready }}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={{ earnedAt: dayjs(), rankingListId: defaultListId }} onFinish={submit} preserve={false}>
        <Form.Item name="rankingListId" label="Bảng xếp hạng" rules={[{ required: true, message: 'Chọn bảng xếp hạng' }]}>
          <Select {...lists.selectProps} placeholder="Chọn bảng xếp hạng" />
        </Form.Item>
        <Form.Item name="player" label="Vận động viên" rules={[{ required: true, message: 'Chọn vận động viên' }]}>
          <PlayerField />
        </Form.Item>
        <Form.Item
          name="points"
          label="Điểm"
          rules={[
            { required: true, message: 'Nhập số điểm' },
            { validator: (_, value: number | null) => (value === 0 ? Promise.reject(new Error('Điểm phải khác 0')) : Promise.resolve()) },
          ]}
          extra="Nhập số âm để trừ điểm."
        >
          <InputNumber precision={0} />
        </Form.Item>
        <Form.Item name="earnedAt" label="Ngày đạt điểm" rules={[{ required: true, message: 'Chọn ngày đạt điểm' }]}>
          <DatePicker format={DISPLAY_DATE_FORMAT} allowClear={false} disabledDate={(date) => date.isAfter(dayjs(), 'day')} />
        </Form.Item>
        <Form.Item
          name="expiresAt"
          label="Hết hạn"
          extra="Bỏ trống để tính theo ngày đạt điểm cộng thời hạn của bảng xếp hạng."
          dependencies={['earnedAt']}
          rules={[
            ({ getFieldValue }) => ({
              validator: (_, value: Dayjs | null) => {
                const earned = getFieldValue('earnedAt') as Dayjs | null;
                return value && earned && !value.isAfter(earned, 'day')
                  ? Promise.reject(new Error('Ngày hết hạn phải sau ngày đạt điểm'))
                  : Promise.resolve();
              },
            }),
          ]}
        >
          <DatePicker format={DISPLAY_DATE_FORMAT} />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Lý do"
          rules={[{ required: true, whitespace: true, min: RANKING_REASON_MIN_LENGTH, message: `Lý do tối thiểu ${RANKING_REASON_MIN_LENGTH} ký tự` }]}
          extra="Ghi vào nhật ký thao tác."
        >
          <Input.TextArea rows={2} maxLength={RANKING_REASON_MAX_LENGTH} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
