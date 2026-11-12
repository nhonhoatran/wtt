import { MoreOutlined } from '@ant-design/icons';
import { EditButton } from '@refinedev/antd';
import { useInvalidate } from '@refinedev/core';
import { App, Button, Dropdown, Space } from 'antd';
import { ApiError, apiFetch } from '../../api/http-client';
import type { TempPasswordInfo } from '../../components/temp-password-modal';
import type { UserRecord } from './user-labels';

interface UserRowActionsProps {
  user: UserRecord;
  isSelf: boolean;
  onTempPassword: (info: TempPasswordInfo) => void;
}

export function UserRowActions({ user, isSelf, onTempPassword }: UserRowActionsProps) {
  const { modal, message } = App.useApp();
  const invalidate = useInvalidate();

  const run = (title: string, content: string, okText: string, action: () => Promise<void>, danger = false) =>
    modal.confirm({
      title,
      content,
      okText,
      cancelText: 'Hủy',
      okButtonProps: { danger },
      onOk: async () => {
        try {
          await action();
          await invalidate({ resource: 'users', invalidates: ['list', 'detail'], id: user.id });
        } catch (error) {
          message.error(error instanceof ApiError ? error.message : 'Không thực hiện được');
        }
      },
    });

  const items = [
    user.isActive
      ? {
          key: 'lock',
          danger: true,
          disabled: isSelf,
          label: 'Khóa tài khoản',
          onClick: () =>
            run(`Khóa tài khoản ${user.name}?`, 'Người này bị đăng xuất ngay và không đăng nhập được nữa.', 'Khóa', async () => {
              await apiFetch(`/admin/users/${user.id}`, { method: 'PATCH', body: { isActive: false } });
              message.success(`Đã khóa ${user.name}`);
            }, true),
        }
      : {
          key: 'unlock',
          label: 'Mở khóa',
          onClick: () =>
            run(`Mở khóa ${user.name}?`, 'Người này đăng nhập lại được bằng mật khẩu hiện có.', 'Mở khóa', async () => {
              await apiFetch(`/admin/users/${user.id}`, { method: 'PATCH', body: { isActive: true } });
              message.success(`Đã mở khóa ${user.name}`);
            }),
        },
    {
      key: 'reset',
      disabled: isSelf,
      label: 'Cấp lại mật khẩu tạm',
      onClick: () =>
        run(`Cấp mật khẩu tạm cho ${user.name}?`, 'Mật khẩu cũ hết dùng được và người này bị đăng xuất ngay.', 'Cấp mật khẩu', async () => {
          const res = await apiFetch<{ data: Omit<TempPasswordInfo, 'email'> }>(`/admin/users/${user.id}/reset-password`, {
            method: 'POST',
            body: {},
          });
          onTempPassword({ email: user.email, ...res.data });
        }),
    },
    {
      key: 'revoke',
      label: 'Đăng xuất mọi thiết bị',
      onClick: () =>
        run(`Đăng xuất ${user.name} khỏi mọi thiết bị?`, 'Người này phải đăng nhập lại trên mọi máy.', 'Đăng xuất', async () => {
          const res = await apiFetch<{ data: { revoked: number } }>(`/admin/users/${user.id}/revoke-sessions`, {
            method: 'POST',
            body: {},
          });
          message.success(`Đã đăng xuất ${res.data.revoked} phiên`);
        }),
    },
  ];

  return (
    <Space size="small">
      <EditButton hideText size="small" recordItemId={user.id} />
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button size="small" icon={<MoreOutlined />} aria-label="Thao tác khác" />
      </Dropdown>
    </Space>
  );
}
