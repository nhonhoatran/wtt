import { App, DatePicker, Form, Input, Modal, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings } from '../../api/write-warnings';
import { SortableListField } from '../../components/sortable-list-field';
import { DISPLAY_DATE_FORMAT, TIME_FORMAT, type EventRecord } from '../../resources/events/event-labels';
import { useCatalogSelect } from '../../resources/events/use-catalog-options';
import { tableLabel, type SessionRecord } from './schedule-types';
import { useVenueTables } from './use-venue-tables';

const API_DATE_FORMAT = 'YYYY-MM-DD';
const NAME_MAX_LENGTH = 200;

interface SessionFormValues {
  date: Dayjs;
  code: string;
  name?: string;
  startTime: Dayjs;
  endTime?: Dayjs | null;
  venueId?: string;
  tableIds: string[];
}

interface SessionFormModalProps {
  event: EventRecord;
  /** Null creates a session. */
  session: SessionRecord | null;
  defaultDate: string | undefined;
  onClose: () => void;
  onSaved: (session: SessionRecord) => void;
}

type SessionWrite = { data: SessionRecord; warnings?: string[] };

const toTime = (value: string | null) => (value ? dayjs(value, TIME_FORMAT) : null);

export function SessionFormModal({ event, session, defaultDate, onClose, onSaved }: SessionFormModalProps) {
  const [form] = Form.useForm<SessionFormValues>();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const venueId = Form.useWatch('venueId', form);
  const venues = useCatalogSelect('venues', { selected: venueId });
  const tables = useVenueTables(venueId);
  const tableOptions = (tables.data ?? []).map((table) => ({ value: table.id, label: tableLabel(table) }));
  const savedVenueId = session ? (session.venueId ?? event.venueId ?? undefined) : undefined;
  const [seededVenue, setSeededVenue] = useState<string | undefined>(savedVenueId);

  useEffect(() => {
    form.setFieldsValue({
      date: dayjs(session?.date ?? defaultDate ?? event.startDate),
      code: session?.code,
      name: session?.name ?? undefined,
      startTime: toTime(session?.startTime ?? null) ?? undefined,
      endTime: toTime(session?.endTime ?? null),
      venueId: savedVenueId ?? event.venueId ?? undefined,
      tableIds: session?.tables.map((table) => table.tableId) ?? [],
    });
  }, [form, session, defaultDate, event, savedVenueId]);

  // A new session starts with every active table of the venue; picking another venue restarts the list.
  useEffect(() => {
    if (!tables.data || !venueId || venueId === seededVenue) return;
    setSeededVenue(venueId);
    form.setFieldValue('tableIds', tables.data.map((table) => table.id));
  }, [tables.data, venueId, seededVenue, form]);

  const submit = async (values: SessionFormValues) => {
    setSaving(true);
    try {
      const body = {
        date: values.date.format(API_DATE_FORMAT),
        code: values.code.trim(),
        name: values.name?.trim() || null,
        startTime: values.startTime.format(TIME_FORMAT),
        endTime: values.endTime ? values.endTime.format(TIME_FORMAT) : null,
        venueId: values.venueId,
        tableIds: values.tableIds,
      };
      const res = session
        ? await apiFetch<SessionWrite>(`/admin/events/${event.id}/sessions/${session.id}`, { method: 'PATCH', body })
        : await apiFetch<SessionWrite>(`/admin/events/${event.id}/sessions`, { method: 'POST', body });
      message.success(session ? 'Đã lưu session' : 'Đã thêm session');
      showWarnings(message, res.warnings);
      onSaved(res.data);
    } catch (error) {
      const fields = error instanceof ApiError ? error.errors : undefined;
      if (fields) form.setFields(Object.entries(fields).map(([name, text]) => ({ name: name as keyof SessionFormValues, errors: [text] })));
      else message.error(error instanceof ApiError ? error.message : 'Không lưu được session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={session ? `Sửa session ${session.code}` : 'Thêm session'}
      okText="Lưu"
      cancelText="Hủy"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="date" label="Ngày" rules={[{ required: true, message: 'Chọn ngày thi đấu' }]}>
          <DatePicker format={DISPLAY_DATE_FORMAT} disabledDate={(day) => day.isBefore(dayjs(event.startDate), 'day') || day.isAfter(dayjs(event.endDate), 'day')} />
        </Form.Item>
        <Form.Item name="code" label="Mã session" rules={[{ required: true, message: 'Nhập mã session' }]} extra="Ví dụ: S01.">
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="name" label="Tên session" extra="Bỏ trống để hiện theo mã.">
          <Input maxLength={NAME_MAX_LENGTH} />
        </Form.Item>
        <Form.Item name="startTime" label="Giờ bắt đầu" rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]}>
          <TimePicker format={TIME_FORMAT} needConfirm={false} />
        </Form.Item>
        <Form.Item
          name="endTime"
          label="Giờ kết thúc"
          dependencies={['startTime']}
          extra="Bỏ trống nếu chưa biết giờ kết thúc."
          rules={[
            ({ getFieldValue }) => ({
              validator: (_, value: Dayjs | null | undefined) => {
                const start = getFieldValue('startTime') as Dayjs | undefined;
                if (!value || !start || value.isAfter(start, 'minute')) return Promise.resolve();
                return Promise.reject(new Error('Giờ kết thúc phải sau giờ bắt đầu'));
              },
            }),
          ]}
        >
          <TimePicker format={TIME_FORMAT} needConfirm={false} />
        </Form.Item>
        <Form.Item name="venueId" label="Địa điểm" rules={[{ required: true, message: 'Chọn địa điểm' }]}>
          <Select {...venues.selectProps} placeholder="Chọn địa điểm" />
        </Form.Item>
        <Form.Item
          name="tableIds"
          label="Bàn dùng trong session"
          extra="Thứ tự ở đây là thứ tự các cột trên lưới xếp lịch."
          rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một bàn' }]}
        >
          <SortableListField options={tableOptions} noun="bàn" addPlaceholder={tables.isLoading ? 'Đang tải bàn...' : 'Thêm bàn'} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
