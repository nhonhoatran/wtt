import { Create, useForm } from '@refinedev/antd';
import { Form, Input, Select, Upload, Button, message } from 'antd';
import type { UploadProps } from 'antd';
type UploadRequestOption = Parameters<NonNullable<UploadProps['customRequest']>>[0];

const CITIES = ['Ha Noi', 'Ho Chi Minh', 'Da Nang', 'Can Tho', 'Hai Phong'];
const STATUSES = ['active', 'inactive', 'banned'];

async function uploadToPresignedUrl({ file, onSuccess, onError }: UploadRequestOption, setKey: (k: string) => void) {
  try {
    const f = file as File;
    const intent = await fetch('/api/upload-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: f.name, contentType: f.type }),
    });
    if (!intent.ok) throw new Error(`upload-intent ${intent.status}`);
    const { key, uploadUrl } = await intent.json();
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
    if (!put.ok) throw new Error(`PUT ${put.status}`);
    setKey(key);
    onSuccess?.({ key });
  } catch (e) {
    message.error(`Upload loi: ${(e as Error).message}`);
    onError?.(e as Error);
  }
}

export function PlayerCreate() {
  const { formProps, saveButtonProps } = useForm({ resource: 'players', action: 'create', redirect: 'list' });
  const setKey = (k: string) => formProps.form?.setFieldValue('avatar_key', k);

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" initialValues={{ status: 'active' }}>
        <Form.Item name="full_name" label="Ho ten" rules={[{ required: true, message: 'Nhap ho ten' }, { min: 3, message: 'Toi thieu 3 ky tu' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhap email' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="city" label="Thanh pho" rules={[{ required: true, message: 'Chon thanh pho' }]}>
          <Select options={CITIES.map((v) => ({ value: v }))} />
        </Form.Item>
        <Form.Item name="status" label="Trang thai"><Select options={STATUSES.map((v) => ({ value: v }))} /></Form.Item>
        <Form.Item name="avatar_key" hidden><Input /></Form.Item>
        <Form.Item label="Anh dai dien">
          <Upload maxCount={1} accept="image/*" customRequest={(o) => uploadToPresignedUrl(o, setKey)}>
            <Button>Chon anh</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Create>
  );
}
