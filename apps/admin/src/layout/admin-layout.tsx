import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import { Button, Dropdown, Flex, Layout, Menu, Spin, Tag, theme, Typography } from 'antd';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import type { CurrentUser } from '../providers/current-user';
import { ROLE_LABELS, visibleMenuGroups } from './menu-groups';

export function AdminLayout() {
  const { data: user, isLoading } = useGetIdentity<CurrentUser>();
  const { mutate: logout } = useLogout();
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading || !user) return <Spin fullscreen />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

  const groups = visibleMenuGroups(user.role);
  const items = [
    { key: '/', label: 'Trang chủ' },
    ...groups.map((group) => ({
      key: group.key,
      type: 'group' as const,
      label: group.label,
      children: group.items.map((item) => ({ key: item.external ? `external:${item.path}` : item.path, label: item.label })),
    })),
  ];
  const selected = groups.flatMap((g) => g.items).find((item) => location.pathname.startsWith(item.path))?.path ?? '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider breakpoint="lg" collapsedWidth={0} width={240}>
        <Typography.Title level={5} style={{ color: token.colorTextLightSolid, padding: token.padding, margin: 0 }}>
          Kamito · Quản trị
        </Typography.Title>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={[selected]}
          onClick={({ key }) => {
            if (key.startsWith('external:')) window.open(key.slice('external:'.length), '_blank', 'noopener');
            else navigate(key);
          }}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header>
          <Flex justify="end" align="center" style={{ height: '100%' }}>
            <Dropdown
              menu={{
                items: [
                  { key: 'password', label: 'Đổi mật khẩu', onClick: () => navigate('/change-password') },
                  { key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, onClick: () => logout() },
                ],
              }}
            >
              <Button type="text" icon={<UserOutlined />} style={{ color: token.colorTextLightSolid }}>
                {user.name} <Tag style={{ marginInlineStart: token.marginXS }}>{ROLE_LABELS[user.role]}</Tag>
              </Button>
            </Dropdown>
          </Flex>
        </Layout.Header>
        <Layout.Content style={{ padding: token.paddingLG }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
