import { App, Form, Input, InputNumber, Modal, type FormInstance } from 'antd';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';

export interface VenueTableRecord {
  id: string;
  code: string;
  displayName: string | null;
  order: number;
  isActive: boolean;
}

interface BaseModalProps {
  venueId: string;
  onClose: () => void;
  onDone: () => void;
}

interface TableFormValues {
  code: string;
  displayName?: string;
  order?: number;
}

interface BulkFormValues {
  count: number;
  prefix?: string;
  startAt?: number;
}

function useSubmit<V>(form: FormInstance, run: (values: V) => Promise<void>, onDone: () => void) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const submit = async (values: V) => {
    setSaving(true);
    try {
      await run(values);
      onDone();
    } catch (error) {
      const fields = error instanceof ApiError ? error.errors : undefined;
      if (fields) form.setFields(Object.entries(fields).map(([name, text]) => ({ name, errors: [text] })));
      else message.error(error instanceof Error ? error.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };
  return { saving, submit };
}

/** Create (table undefined) or edit one table of a venue. */
export function TableFormModal({ venueId, table, onClose, onDone }: BaseModalProps & { table: VenueTableRecord | null }) {
  const [form] = Form.useForm<TableFormValues>();
  const { message } = App.useApp();
  const { saving, submit } = useSubmit<TableFormValues>(
    form,
    async (values) => {
      const body = { ...values, displayName: values.displayName ?? '' };
      if (table) await apiFetch(`/admin/venues/${venueId}/tables/${table.id}`, { method: 'PATCH', body });
      else await apiFetch(`/admin/venues/${venueId}/tables`, { method: 'POST', body });
      message.success(table ? 'Đã lưu bàn' : 'Đã thêm bàn');
    },
    onDone,
  );
  useEffect(() => form.setFieldsValue({ code: table?.code, displayName: table?.displayName ?? undefined, order: table?.order }), [form, table]);

  return (
    <Modal open title={table ? `Sửa bàn ${table.code}` : 'Thêm bàn'} okText="Lưu" cancelText="Hủy" onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="code" label="Mã bàn" rules={[{ required: true, message: 'Nhập mã bàn' }]} extra="Ví dụ: T01. Chữ in hoa, số, gạch ngang.">
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="displayName" label="Tên hiển thị" extra="Bỏ trống để hiện theo mã bàn.">
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item name="order" label="Thứ tự" extra="Bỏ trống để xếp cuối.">
          <InputNumber min={0} precision={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Bulk creation: an empty prefix lets the API use the table-prefix setting. */
export function BulkTablesModal({ venueId, onClose, onDone }: BaseModalProps) {
  const [form] = Form.useForm<BulkFormValues>();
  const { message } = App.useApp();
  const { saving, submit } = useSubmit<BulkFormValues>(
    form,
    async (values) => {
      const res = await apiFetch<{ data: unknown[] }>(`/admin/venues/${venueId}/tables/bulk`, {
        method: 'POST',
        body: { count: values.count, prefix: values.prefix?.trim() || undefined, startAt: values.startAt ?? undefined },
      });
      const skipped = values.count - res.data.length;
      message.success(skipped > 0 ? `Đã tạo ${res.data.length} bàn, bỏ qua ${skipped} mã đã có` : `Đã tạo ${res.data.length} bàn`);
    },
    onDone,
  );

  return (
    <Modal open title="Tạo nhanh nhiều bàn" okText="Tạo bàn" cancelText="Hủy" onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="count" label="Số bàn" rules={[{ required: true, message: 'Nhập số bàn từ 1 đến 100' }]}>
          <InputNumber autoFocus min={1} max={100} precision={0} />
        </Form.Item>
        <Form.Item name="prefix" label="Tiền tố mã bàn" extra="Mã bàn sẽ dạng tiền tố + số thứ tự.">
          <Input maxLength={8} placeholder="Mặc định theo cài đặt" />
        </Form.Item>
        <Form.Item name="startAt" label="Bắt đầu từ số" extra="Bỏ trống để nối tiếp số lớn nhất đang có.">
          <InputNumber min={1} max={9999} precision={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
