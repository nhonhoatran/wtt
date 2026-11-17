import { App, DatePicker, Form, Modal, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { DATE_ONLY_FORMAT, DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { useCatalogRows } from '../../resources/events/use-catalog-options';
import type { SnapshotJobRef } from './snapshot-jobs-tracker';

interface DraftModalProps {
  open: boolean;
  onClose: () => void;
  onQueued: (jobs: SnapshotJobRef[]) => void;
}

interface FormValues {
  listIds?: string[];
  asOfDate: Dayjs;
}

/** No list picked means every active list. */
export function SnapshotDraftModal({ open, onClose, onQueued }: DraftModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const lists = useCatalogRows('ranking-lists');

  const submit = async (values: FormValues) => {
    setSaving(true);
    try {
      const picked = values.listIds ?? [];
      const response = await apiFetch<{ data: { jobs: SnapshotJobRef[] } }>('/admin/ranking-snapshots/drafts', {
        method: 'POST',
        body: { ...(picked.length > 0 ? { listIds: picked } : { all: true }), asOfDate: values.asOfDate.format(DATE_ONLY_FORMAT) },
      });
      message.success('Đã gửi yêu cầu tạo bản nháp');
      onQueued(response.data.jobs);
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : 'Không gửi được yêu cầu tạo bản nháp');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Tạo bản nháp" okText="Tạo bản nháp" cancelText="Hủy" confirmLoading={saving} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={{ asOfDate: dayjs() }} onFinish={submit}>
        <Form.Item name="listIds" label="Bảng xếp hạng">
          <Select
            mode="multiple"
            allowClear
            placeholder="Tất cả bảng"
            loading={lists.isLoading}
            options={(lists.data ?? []).map((list) => ({ value: list.id, label: list.name }))}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item name="asOfDate" label="Ngày chốt" rules={[{ required: true, message: 'Chọn ngày tính' }]}>
          <DatePicker format={DISPLAY_DATE_FORMAT} allowClear={false} disabledDate={(date) => date.isAfter(dayjs(), 'day')} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
