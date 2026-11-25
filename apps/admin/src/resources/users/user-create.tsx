import { useForm } from '@refinedev/antd';
import { Create } from '../../components/crud-page';
import { Form, Input, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TempPasswordModal, type TempPasswordInfo } from '../../components/temp-password-modal';
import { ROLE_OPTIONS, type UserRecord } from './user-labels';

interface CreatedUser {
  user: UserRecord;
  tempPassword: string;
  tempPasswordExpiresAt: string;
}

export function UserCreate() {
  const navigate = useNavigate();
  const [created, setCreated] = useState<TempPasswordInfo | null>(null);
  const { formProps, saveButtonProps } = useForm<CreatedUser>({
    resource: 'users',
    action: 'create',
    redirect: false,
    successNotification: false,
    onMutationSuccess: ({ data }) =>
      setCreated({ email: data.user.email, tempPassword: data.tempPassword, tempPasswordExpiresAt: data.tempPasswordExpiresAt }),
  });

  return (
    <Create title="Thêm người dùng" saveButtonProps={{ ...saveButtonProps, children: 'Tạo tài khoản' }}>
      <Form {...formProps} layout="vertical" initialValues={{ role: 'RESULTS_OPERATOR' }} style={{ maxWidth: 480 }}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="role" label="Vai trò" extra="Nhập kết quả: chỉ nhập, chốt và sửa tỷ số; xem giải và vận động viên.">
          <Select options={ROLE_OPTIONS} />
        </Form.Item>
      </Form>
      <TempPasswordModal
        info={created}
        onClose={() => {
          setCreated(null);
          navigate('/users');
        }}
      />
    </Create>
  );
}
