import { DownOutlined } from '@ant-design/icons';
import { Button, DatePicker, Dropdown, Form, Input, Modal, Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { CONTENT_STATUS_COLORS, CONTENT_STATUS_LABELS, type ContentStatus } from './content-labels';
import { Tag } from 'antd';

interface Props {
  form: FormInstance;
  busy: boolean;
  validate: () => Promise<boolean>;
  save: (status: ContentStatus, publishAt?: string | null) => Promise<boolean>;
}

export function ArticlePublishActions({ form, busy, validate, save }: Props) {
  const status = Form.useWatch('status', form) as ContentStatus | undefined;
  const publishAt = Form.useWatch('publishAt', form) as string | undefined;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState<Dayjs | null>(null);
  const [error, setError] = useState<string>();

  const openSchedule = async () => {
    if (!await validate()) return;
    setSchedule(publishAt ? dayjs(publishAt) : null);
    setError(undefined);
    setScheduleOpen(true);
  };
  const scheduleArticle = async () => {
    if (!schedule?.isValid() || !schedule.isAfter(dayjs())) {
      setError('Chọn thời điểm đăng ở tương lai');
      return;
    }
    if (await save('SCHEDULED', schedule.toISOString())) setScheduleOpen(false);
  };

  return <>
    <Form.Item name="status" hidden><Input /></Form.Item>
    <Form.Item name="publishAt" hidden><Input /></Form.Item>
    <Space wrap>
      {status && <Tag color={CONTENT_STATUS_COLORS[status]}>{CONTENT_STATUS_LABELS[status]}</Tag>}
      {status === 'SCHEDULED' && publishAt && <Typography.Text type="secondary">{dayjs(publishAt).format('DD/MM/YYYY HH:mm')}</Typography.Text>}
      {status === 'PUBLISHED' || status === 'SCHEDULED' ? <Button disabled={busy} onClick={() => void save(status, publishAt)}>Lưu thay đổi</Button> : null}
      <Button disabled={busy} onClick={() => void save('DRAFT', null)}>{status === 'PUBLISHED' ? 'Chuyển về nháp' : 'Lưu nháp'}</Button>
      <Space.Compact>
        <ConfirmActionButton label="Đăng ngay" title="Đăng bài viết ngay?" content="Bài viết sẽ hiển thị trên site công khai." okText="Đăng ngay" buttonProps={{ type: 'primary', disabled: busy }} onConfirm={async () => { await save('PUBLISHED', null); }} />
        <Dropdown menu={{ items: [{ key: 'schedule', label: 'Hẹn giờ đăng', onClick: () => void openSchedule() }, { key: 'archive', label: 'Lưu trữ', onClick: () => void save('ARCHIVED', null) }] }} trigger={['click']} disabled={busy}>
          <Button type="primary" icon={<DownOutlined />} aria-label="Tùy chọn đăng bài" disabled={busy} />
        </Dropdown>
      </Space.Compact>
    </Space>
    <Modal title="Hẹn giờ đăng bài" open={scheduleOpen} onCancel={() => setScheduleOpen(false)} onOk={() => void scheduleArticle()} confirmLoading={busy} okText="Hẹn giờ đăng" cancelText="Hủy">
      <Form.Item label="Thời điểm đăng" validateStatus={error ? 'error' : undefined} help={error}>
        <DatePicker showTime format="DD/MM/YYYY HH:mm" value={schedule} onChange={(value) => { setSchedule(value); setError(undefined); }} style={{ width: '100%' }} />
      </Form.Item>
      <Typography.Text type="secondary">Múi giờ: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Typography.Text>
    </Modal>
  </>;
}
