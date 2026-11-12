import { useLogin } from '@refinedev/core';
import { Alert, Button, Card, Flex, Form, Input, Typography, theme } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { takeSignedOutReason } from '../providers/current-user';

const REASON_MESSAGES: Record<string, string> = {
  SESSION_IDLE_TIMEOUT: 'Phiên đã hết hạn do không thao tác. Đăng nhập lại để tiếp tục đúng màn đang dùng.',
  SESSION_EXPIRED: 'Phiên đăng nhập đã hết thời hạn. Vui lòng đăng nhập lại.',
  ACCOUNT_DISABLED: 'Tài khoản đã bị khóa. Liên hệ quản trị nếu cần mở lại.',
};

interface LoginValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { token } = theme.useToken();
  const [params] = useSearchParams();
  const [reason] = useState(() => REASON_MESSAGES[takeSignedOutReason() ?? ''] ?? null);
  const [error, setError] = useState<string | null>(null);
  const { mutate: login, isPending } = useLogin<LoginValues & { to?: string }>();

  const submit = (values: LoginValues) => {
    setError(null);
    login(
      { ...values, to: params.get('to') ?? undefined },
      { onSuccess: (result) => !result.success && setError(result.error?.message ?? 'Không đăng nhập được') },
    );
  };

  return (
    <Flex justify="center" align="center" style={{ minHeight: '100vh' }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Typography.Title level={3}>Đăng nhập quản trị</Typography.Title>
        {reason && !error && <Alert type="info" showIcon message={reason} style={{ marginBottom: token.margin }} />}
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: token.margin }} />}
        <Form<LoginValues> layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={isPending}>
            Đăng nhập
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: token.margin, marginBottom: 0 }}>
          Quên mật khẩu? Liên hệ quản trị để được cấp mật khẩu tạm.
        </Typography.Paragraph>
      </Card>
    </Flex>
  );
}
