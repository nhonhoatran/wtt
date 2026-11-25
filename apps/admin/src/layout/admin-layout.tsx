import { useGetIdentity, useLogout } from '@refinedev/core';
import { tokens } from '@kamito/ui-tokens';
import { Drawer, Grid, Layout, Spin, theme } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import type { CurrentUser } from '../providers/current-user';
import { BreadcrumbProvider } from './admin-breadcrumb';
import { AdminHeader } from './admin-header';
import { AdminSider, SIDER_WIDTH } from './admin-sider';
import { homeKind, SHELL_LABELS, visibleMenuGroups } from './menu-groups';

function AdminShell({ user }: { user: CurrentUser }) {
  const { mutate: logout } = useLogout();
  const { token } = theme.useToken();
  // Below `lg` the menu is an overlay drawer, so opening it never squeezes the page.
  const compact = !Grid.useBreakpoint().lg;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Widening past `lg` unmounts the drawer; close it so narrowing again does not reopen it.
  useEffect(() => {
    if (!compact) setDrawerOpen(false);
  }, [compact]);

  const groups = visibleMenuGroups(user.role);
  const home = homeKind(user.role);
  const homeTitle = home === 'results' ? (groups.flatMap((g) => g.items).find((item) => item.key === 'results')?.label ?? SHELL_LABELS.overview) : SHELL_LABELS.overview;
  const sider = <AdminSider groups={groups} showOverview={home === 'dashboard'} onNavigate={() => setDrawerOpen(false)} />;

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
          styles={{ body: { padding: 0, background: tokens.color.ink } }}
        >
          <Layout.Sider width={SIDER_WIDTH} style={{ minHeight: '100%' }}>{sider}</Layout.Sider>
        </Drawer>
      ) : (
        <Layout.Sider width={SIDER_WIDTH} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>{sider}</Layout.Sider>
      )}
      <Layout style={{ minWidth: 0 }}>
        <AdminHeader user={user} groups={groups} homeTitle={homeTitle} compact={compact} onOpenMenu={() => setDrawerOpen(true)} onLogout={() => logout()} />
        <Layout.Content style={{ padding: compact ? token.paddingSM : token.paddingLG }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export function AdminLayout() {
  const { data: user, isLoading } = useGetIdentity<CurrentUser>();
  if (isLoading || !user) return <Spin fullscreen />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return (
    <BreadcrumbProvider>
      <AdminShell user={user} />
    </BreadcrumbProvider>
  );
}
