import { SLUG_PATTERN } from '@kamito/shared';
import { Card, DatePicker, Flex, Form, Input, Select, Switch, theme, type FormInstance } from 'antd';
import type { Dayjs } from 'dayjs';
import { useMemo } from 'react';
import { MediaUploadField } from '../../components/media-upload-field';
import { SlugInput } from '../../components/slug-input';
import { DATE_ONLY_FORMAT, DISPLAY_DATE_FORMAT, type EventRecord } from './event-labels';
import type { EventFormValues } from './event-form-values';
import { useCatalogSelect } from './use-catalog-options';

interface EventFormSectionsProps {
  form: FormInstance<EventFormValues>;
  /** Set when editing: the slug stays as stored and its availability check ignores this event. */
  event?: EventRecord;
  /** Create mode: end date is suggested as start date plus this many days (setting event.defaultDurationDays). */
  defaultDurationDays?: number;
}

const SLUG_ENDPOINT = '/admin/events/slug-available';

const venueLabel = (row: { name: string; city?: unknown }) => (row.city ? `${row.name} (${String(row.city)})` : row.name);

function timezoneOptions(current?: string) {
  const zones = Intl.supportedValuesOf('timeZone');
  const all = current && !zones.includes(current) ? [current, ...zones] : zones;
  return all.map((zone) => ({ value: zone, label: zone }));
}

export function EventFormSections({ form, event, defaultDurationDays }: EventFormSectionsProps) {
  const { token } = theme.useToken();
  const name = Form.useWatch('name', form);
  const timezone = Form.useWatch('timezone', form);
  const published = event?.publishStatus === 'PUBLISHED';
  const eventTypes = useCatalogSelect('event-types', { selected: Form.useWatch('eventTypeId', form) });
  const venues = useCatalogSelect('venues', { labelOf: venueLabel, selected: Form.useWatch('venueId', form) });
  const zoneOptions = useMemo(() => timezoneOptions(timezone), [timezone]);

  const onStartChange = (start: Dayjs | null) => {
    if (start && defaultDurationDays !== undefined && !form.getFieldValue('endDate')) {
      form.setFieldValue('endDate', start.add(defaultDurationDays, 'day'));
    }
  };

  return (
    <Flex vertical gap={token.margin}>
      <Card title="Thông tin chung">
        <Form.Item name="name" label="Tên giải" rules={[{ required: true, whitespace: true, message: 'Nhập tên giải' }]}>
          <Input autoFocus={!event} maxLength={200} />
        </Form.Item>
        <Form.Item
          name="slug"
          label="Đường dẫn (slug)"
          extra="Tự tạo từ tên giải; sửa tay nếu muốn."
          rules={[{ pattern: SLUG_PATTERN, message: 'Chỉ gồm chữ thường không dấu, số và dấu gạch ngang' }]}
        >
          <SlugInput
            source={name}
            excludeId={event?.id}
            endpoint={SLUG_ENDPOINT}
            disabled={published}
            disabledHint="Bỏ công bố trước khi đổi đường dẫn"
          />
        </Form.Item>
        <Form.Item name="eventTypeId" label="Hạng giải" rules={[{ required: true, message: 'Chọn hạng giải' }]}>
          <Select {...eventTypes.selectProps} placeholder="Chọn hạng giải" />
        </Form.Item>
      </Card>

      <Card title="Thời gian & địa điểm">
        <Flex wrap gap={token.margin}>
          <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}>
            <DatePicker format={DISPLAY_DATE_FORMAT} onChange={onStartChange} />
          </Form.Item>
          <Form.Item
            name="endDate"
            label="Ngày kết thúc"
            dependencies={['startDate']}
            extra={defaultDurationDays === undefined ? undefined : `Tự gợi ý bắt đầu + ${defaultDurationDays} ngày.`}
            rules={[
              { required: true, message: 'Chọn ngày kết thúc' },
              ({ getFieldValue }) => ({
                validator: (_, end: Dayjs | undefined) => {
                  const start = getFieldValue('startDate') as Dayjs | undefined;
                  return !start || !end || !end.isBefore(start, 'day')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Ngày kết thúc phải từ ngày bắt đầu trở đi'));
                },
              }),
            ]}
          >
            <DatePicker
              format={DISPLAY_DATE_FORMAT}
              disabledDate={(day) => {
                const start = form.getFieldValue('startDate') as Dayjs | undefined;
                return Boolean(start && day.format(DATE_ONLY_FORMAT) < start.format(DATE_ONLY_FORMAT));
              }}
            />
          </Form.Item>
        </Flex>
        <Form.Item name="timezone" label="Múi giờ" rules={[{ required: true, message: 'Chọn múi giờ' }]}>
          <Select showSearch optionFilterProp="label" options={zoneOptions} />
        </Form.Item>
        <Form.Item name="venueId" label="Địa điểm" extra="Không bắt buộc.">
          <Select {...venues.selectProps} allowClear placeholder="Chọn địa điểm" />
        </Form.Item>
      </Card>

      <Card title="Hiển thị">
        <Form.Item name="bannerMediaId" label="Ảnh bìa">
          <MediaUploadField purpose="event-banner" hint="Ảnh ngang, hiển thị ở đầu trang giải." />
        </Form.Item>
        <Form.Item name="isFeatured" label="Giải nổi bật" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="ticketUrl" label="Link bán vé" extra="Chỉ nhận liên kết bắt đầu bằng https://">
          <Input inputMode="url" placeholder="https://" />
        </Form.Item>
        <Form.Item name="showTicket" label="Hiện nút mua vé" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Card>
    </Flex>
  );
}
