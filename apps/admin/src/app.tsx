import { antdTheme } from '@kamito/ui-tokens/antd-theme';
import { useNotificationProvider } from '@refinedev/antd';
import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/es/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthGate } from './components/auth-gate';
import { RequireAccess } from './components/require-access';
import { StepUpProvider } from './components/step-up-modal';
import { i18nProvider } from './i18n/vi';
import { AdminLayout } from './layout/admin-layout';
import { ChangePasswordPage } from './pages/change-password-page';
import { LoginPage } from './pages/login-page';
import { ResultsEntryPage } from './pages/results/results-entry-page';
import { RoleHomePage } from './pages/role-home-page';
import { SettingsPage } from './pages/settings-page';
import { accessControlProvider } from './providers/access-control-provider';
import { authProvider } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';
import { AuditLogList } from './resources/audit-logs/audit-log-list';
import { EventHubPage } from './pages/event-hub/event-hub-page';
import { MatchSheetsPrintPage } from './pages/event-hub/match-sheets-print-page';
import { catalogResources, catalogRoutes } from './resources/catalog-routes';
import { EventCreate } from './resources/events/event-create';
import { EventList } from './resources/events/event-list';
import { ImportDetailPage } from './resources/imports/import-detail-page';
import { ImportList } from './resources/imports/import-list';
import { PairList } from './resources/pairs/pair-list';
import { PlayerCreate } from './resources/players/player-create';
import { PlayerEdit } from './resources/players/player-edit';
import { PlayerList } from './resources/players/player-list';
import { UserCreate } from './resources/users/user-create';
import { UserEdit } from './resources/users/user-edit';
import { UserList } from './resources/users/user-list';

dayjs.locale('vi');

const resources = [
  { name: 'users', list: '/users', create: '/users/create', edit: '/users/:id/edit', meta: { label: 'Tài khoản nhân viên' } },
  { name: 'events', list: '/events', create: '/events/create', show: '/events/:id', meta: { label: 'Danh sách giải' } },
  ...catalogResources,
  { name: 'players', list: '/players', create: '/players/create', edit: '/players/:id/edit', meta: { label: 'Danh sách VĐV' } },
  { name: 'pairs', list: '/pairs', meta: { label: 'Cặp đôi' } },
  { name: 'imports', list: '/imports', show: '/imports/:id', meta: { label: 'Lịch sử import' } },
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
                <Route element={<AuthGate />}>
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                  <Route path="/events/:id/print/match-sheets" element={<RequireAccess resource="tournaments" action="read"><MatchSheetsPrintPage /></RequireAccess>} />
                  <Route element={<AdminLayout />}>
                    <Route index element={<RoleHomePage />} />
                    <Route path="/users" element={<RequireAccess resource="users" action="list"><UserList /></RequireAccess>} />
                    <Route path="/users/create" element={<RequireAccess resource="users" action="create"><UserCreate /></RequireAccess>} />
                    <Route path="/users/:id/edit" element={<RequireAccess resource="users" action="edit"><UserEdit /></RequireAccess>} />
                    <Route path="/events" element={<RequireAccess resource="tournaments" action="list"><EventList /></RequireAccess>} />
                    <Route path="/events/create" element={<RequireAccess resource="tournaments" action="create"><EventCreate /></RequireAccess>} />
                    <Route path="/events/:id/:tab?" element={<RequireAccess resource="tournaments" action="read"><EventHubPage /></RequireAccess>} />
                    <Route path="/results" element={<RequireAccess resource="matches" action="list"><ResultsEntryPage /></RequireAccess>} />
                    {catalogRoutes}
                    <Route path="/players" element={<RequireAccess resource="players" action="list"><PlayerList /></RequireAccess>} />
                    <Route path="/players/create" element={<RequireAccess resource="players" action="create"><PlayerCreate /></RequireAccess>} />
                    <Route path="/players/:id/edit" element={<RequireAccess resource="players" action="read"><PlayerEdit /></RequireAccess>} />
                    <Route path="/pairs" element={<RequireAccess resource="players" action="list"><PairList /></RequireAccess>} />
                    <Route path="/imports" element={<RequireAccess resource="tournaments" action="list"><ImportList /></RequireAccess>} />
                    <Route path="/imports/:id" element={<RequireAccess resource="tournaments" action="read"><ImportDetailPage /></RequireAccess>} />
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
