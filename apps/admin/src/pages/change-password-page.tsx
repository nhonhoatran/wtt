import { useGetIdentity, useInvalidateAuthStore } from '@refinedev/core';
import { Alert, App, Button, Card, Flex, Form, Input, Typography, theme } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../api/http-client';
import { type CurrentUser, loadCurrentUser } from '../providers/current-user';

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordPage() {
  const { token } = theme.useToken();
  const { data: user } = useGetIdentity<CurrentUser>();
  const [form] = Form.useForm<ChangePasswordValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const invalidateAuth = useInvalidateAuthStore();
  const forced = Boolean(user?.mustChangePassword);

  const submit = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      await loadCurrentUser(true);
      await invalidateAuth();
      message.success('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
      navigate('/', { replace: true });
    } catch (failure) {
      if (failure instanceof ApiError && failure.errors) {
        form.setFields(Object.entries(failure.errors).map(([name, text]) => ({ name: name as keyof ChangePasswordValues, errors: [text] })));
      } else {
        setError(failure instanceof Error ? failure.message : 'Không đổi được mật khẩu');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Typography.Title level={3}>Đổi mật khẩu</Typography.Title>
        {forced && !error && (
          <Alert
            type="warning"
            showIcon
            message="Bạn đang dùng mật khẩu tạm. Đặt mật khẩu mới để tiếp tục."
            style={{ marginBottom: token.margin }}
          />
        )}
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: token.margin }} />}
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="currentPassword"
            label={forced ? 'Mật khẩu tạm' : 'Mật khẩu hiện tại'}
            rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}
          >
            <Input.Password autoComplete="current-password" autoFocus />
          </Form.Item>
          <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Nhập lại mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Hai mật khẩu mới chưa khớp')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Đổi mật khẩu
          </Button>
        </Form>
        {!forced && (
          <Typography.Paragraph type="secondary" style={{ marginTop: token.margin, marginBottom: 0 }}>
            <Link to="/">Quay lại trang chủ</Link>
          </Typography.Paragraph>
        )}
      </Card>
    </Flex>
  );
}
