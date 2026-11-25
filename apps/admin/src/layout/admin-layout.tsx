import { LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import { Button, Drawer, Dropdown, Flex, Grid, Layout, Menu, Spin, Tag, theme, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import type { CurrentUser } from '../providers/current-user';
import { ROLE_LABELS, visibleMenuGroups } from './menu-groups';

const SIDER_WIDTH = 240;

export function AdminLayout() {
  const { data: user, isLoading } = useGetIdentity<CurrentUser>();
  const { mutate: logout } = useLogout();
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  // Below `lg` the menu is an overlay drawer, so opening it never squeezes the page.
  const compact = !Grid.useBreakpoint().lg;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Widening past `lg` unmounts the drawer; close it so narrowing again does not reopen it.
  useEffect(() => {
    if (!compact) setDrawerOpen(false);
  }, [compact]);

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

  const brand = (
    <Typography.Title level={5} style={{ color: token.colorTextLightSolid, padding: token.padding, margin: 0 }}>
      Kamito · Quản trị
    </Typography.Title>
  );
  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      items={items}
      selectedKeys={[selected]}
      onClick={({ key }) => {
        if (key.startsWith('external:')) window.open(key.slice('external:'.length), '_blank', 'noopener');
        else navigate(key);
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {compact ? (
        <Drawer
          placement="left"
          aria-label="Menu quản trị"
          width={SIDER_WIDTH}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          closable={false}
          destroyOnHidden
          styles={{ body: { padding: 0 } }}
        >
          <Layout.Sider width={SIDER_WIDTH} style={{ minHeight: '100%' }}>
            {brand}
            {menu}
          </Layout.Sider>
        </Drawer>
      ) : (
        <Layout.Sider width={SIDER_WIDTH} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
          {brand}
          {menu}
        </Layout.Sider>
      )}
      <Layout>
        <Layout.Header style={compact ? { paddingInline: token.paddingSM } : undefined}>
          <Flex justify={compact ? 'space-between' : 'end'} align="center" style={{ height: '100%' }}>
            {compact && (
              <Button type="text" aria-label="Mở menu" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} style={{ color: token.colorTextLightSolid }} />
            )}
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
