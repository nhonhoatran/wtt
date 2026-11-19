import { Create, Edit, useForm } from '@refinedev/antd';
import { App, Button, Flex, Form, Input, InputNumber, Result, Select, Skeleton } from 'antd';
import { useNavigate, useSearchParams } from 'react-router';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { MediaUploadField } from '../../components/media-upload-field';
import { useContentEventOptions } from '../content/use-content-event-options';
import type { SponsorRecord } from '../content/content-labels';

function SponsorEditor({ edit = false }: { edit?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();
  const { formProps, form, saveButtonProps, query } = useForm<SponsorRecord>({ resource: 'sponsors', action: edit ? 'edit' : 'create', redirect: false, onMutationSuccess: (response) => { showWarnings(message, warningsOf(response)); navigate('/sponsors'); } });
  const record = query?.data?.data;
  const selectedEvent = Form.useWatch('eventId', form) as string | undefined;
  const eventId = selectedEvent ?? record?.eventId ?? searchParams.get('eventId');
  const events = useContentEventOptions(eventId ? [eventId] : []);
  if (edit && query?.isLoading) return <Skeleton active />;
  if (edit && (query?.isError || !record)) return <Result status="error" title="Không tải được nhà tài trợ" extra={<Button onClick={() => void query?.refetch()}>Thử lại</Button>} />;
  const formContent = <Form {...formProps} form={form} layout="vertical" initialValues={{ eventId: searchParams.get('eventId') ?? undefined, order: 0, isActive: true, ...formProps.initialValues }}><Flex vertical gap="middle" style={{ maxWidth: 680 }}>
    <Form.Item name="name" label="Tên nhà tài trợ" rules={[{ required: true, whitespace: true }]}><Input autoFocus maxLength={160} /></Form.Item>
    <Form.Item name="logoMediaId" label="Logo nền sáng"><MediaUploadField purpose="sponsor-logo" /></Form.Item>
    <Form.Item name="logoDarkMediaId" label="Logo nền tối"><MediaUploadField purpose="sponsor-logo-dark" /></Form.Item>
    <Form.Item name="url" label="Website" rules={[{ type: 'url', message: 'Nhập URL hợp lệ' }]} extra="Nếu có, URL phải bắt đầu bằng HTTPS."><Input placeholder="https://" /></Form.Item>
    <Form.Item name="roleLabel" label="Nhãn vai trò"><Input maxLength={120} /></Form.Item>
    <Form.Item name="roleLabelEn" label="Role label"><Input maxLength={120} /></Form.Item>
    <Form.Item name="eventId" label="Giải áp dụng"><Select allowClear {...events} placeholder="Để trống để áp dụng toàn site" /></Form.Item>
    <Form.Item name="order" label="Thứ tự hiển thị"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
    <Form.Item name="isActive" label="Hiển thị"><Select options={[{ value: true, label: 'Đang hiện' }, { value: false, label: 'Đã ẩn' }]} /></Form.Item>
  </Flex></Form>;
  return edit ? <Edit title="Sửa nhà tài trợ" saveButtonProps={{ ...saveButtonProps, children: 'Lưu nhà tài trợ' }} deleteButtonProps={{ hidden: true }}>{formContent}</Edit> : <Create title="Thêm nhà tài trợ" saveButtonProps={{ ...saveButtonProps, children: 'Thêm nhà tài trợ' }}>{formContent}</Create>;
}

export const SponsorCreate = () => <SponsorEditor />;
export const SponsorEdit = () => <SponsorEditor edit />;
