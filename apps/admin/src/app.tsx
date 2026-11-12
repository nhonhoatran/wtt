import { antdTheme } from '@kamito/ui-tokens/antd-theme';
import { useNotificationProvider } from '@refinedev/antd';
import { Authenticated, Refine } from '@refinedev/core';
import routerProvider, { CatchAllNavigate } from '@refinedev/react-router';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/es/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { RequireAccess } from './components/require-access';
import { StepUpProvider } from './components/step-up-modal';
import { i18nProvider } from './i18n/vi';
import { AdminLayout } from './layout/admin-layout';
import { ChangePasswordPage } from './pages/change-password-page';
import { LoginPage } from './pages/login-page';
import { RoleHomePage } from './pages/role-home-page';
import { SettingsPage } from './pages/settings-page';
import { accessControlProvider } from './providers/access-control-provider';
import { authProvider } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';
import { AuditLogList } from './resources/audit-logs/audit-log-list';
import { EventHubPage } from './pages/event-hub/event-hub-page';
import { catalogResources, catalogRoutes } from './resources/catalog-routes';
import { EventCreate } from './resources/events/event-create';
import { EventList } from './resources/events/event-list';
import { UserCreate } from './resources/users/user-create';
import { UserEdit } from './resources/users/user-edit';
import { UserList } from './resources/users/user-list';

dayjs.locale('vi');

const resources = [
  { name: 'users', list: '/users', create: '/users/create', edit: '/users/:id/edit', meta: { label: 'Tài khoản nhân viên' } },
  { name: 'events', list: '/events', create: '/events/create', show: '/events/:id', meta: { label: 'Danh sách giải' } },
  ...catalogResources,
  { name: 'audit-logs', list: '/audit-logs', meta: { label: 'Nhật ký thao tác' } },
];

export function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={antdTheme} locale={viVN}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            i18nProvider={i18nProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={resources}
            options={{ syncWithLocation: true, disableTelemetry: true, warnWhenUnsavedChanges: true }}
          >
            <StepUpProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <Authenticated key="protected" fallback={<CatchAllNavigate to="/login" />}>
                      <Outlet />
                    </Authenticated>
                  }
                >
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                  <Route element={<AdminLayout />}>
                    <Route index element={<RoleHomePage />} />
                    <Route path="/users" element={<RequireAccess resource="users" action="list"><UserList /></RequireAccess>} />
                    <Route path="/users/create" element={<RequireAccess resource="users" action="create"><UserCreate /></RequireAccess>} />
                    <Route path="/users/:id/edit" element={<RequireAccess resource="users" action="edit"><UserEdit /></RequireAccess>} />
                    <Route path="/events" element={<RequireAccess resource="tournaments" action="list"><EventList /></RequireAccess>} />
                    <Route path="/events/create" element={<RequireAccess resource="tournaments" action="create"><EventCreate /></RequireAccess>} />
                    <Route path="/events/:id/:tab?" element={<RequireAccess resource="tournaments" action="read"><EventHubPage /></RequireAccess>} />
                    {catalogRoutes}
                    <Route path="/audit-logs"element={<RequireAccess resource="audit-logs" action="list"><AuditLogList /></RequireAccess>} />
                    <Route path="/settings" element={<RequireAccess resource="settings" action="list"><SettingsPage /></RequireAccess>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </StepUpProvider>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
