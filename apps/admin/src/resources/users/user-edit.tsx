import { Edit, useForm } from '@refinedev/antd';
import { useGetIdentity } from '@refinedev/core';
import { Form, Input, Select } from 'antd';
import type { CurrentUser } from '../../providers/current-user';
import { ROLE_OPTIONS, type UserRecord } from './user-labels';

/** Name and role only; lock, password and sessions are row actions on the list. */
export function UserEdit() {
  const { data: me } = useGetIdentity<CurrentUser>();
  const { formProps, saveButtonProps, query } = useForm<UserRecord>({ resource: 'users', action: 'edit', redirect: 'list' });
  const record = query?.data?.data;
  const isSelf = record?.id === me?.id;

  return (
    <Edit title={record ? `Sửa: ${record.email}` : 'Sửa người dùng'} saveButtonProps={saveButtonProps} deleteButtonProps={{ hidden: true }}>
      <Form {...formProps} layout="vertical" style={{ maxWidth: 480 }}>
        <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="role"
          label="Vai trò"
          extra={isSelf ? 'Không thể tự đổi vai trò của chính mình.' : 'Đổi vai trò sẽ đăng xuất người này khỏi mọi thiết bị.'}
        >
          <Select options={ROLE_OPTIONS} disabled={isSelf} />
        </Form.Item>
      </Form>
    </Edit>
  );
}
