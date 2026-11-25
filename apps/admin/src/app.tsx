import { antdTheme } from '@kamito/ui-tokens/antd-theme';
import { useNotificationProvider } from '@refinedev/antd';
import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/es/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { createBrowserRouter, matchPath, Navigate, Route, RouterProvider, Routes } from 'react-router';
import { AuthGate } from './components/auth-gate';
import { RequireAccess } from './components/require-access';
import { StepUpProvider } from './components/step-up-modal';
import { i18nProvider } from './i18n/vi';
import { AdminLayout } from './layout/admin-layout';
import { ChangePasswordPage } from './pages/change-password-page';
import { LoginPage } from './pages/login-page';
import { ResultsEntryPage } from './pages/results/results-entry-page';
import { rankingResources, rankingRoutes } from './pages/ranking/ranking-routes';
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
import { ArticleCreate, ArticleEdit, StaticPageCreate, StaticPageEdit, VideoCreate, VideoEdit } from './resources/content/content-forms';
import { ArticleList, StaticPageList, VideoList } from './resources/content/content-lists';
import { ContactMessageList } from './resources/content/contact-message-list';
import { SponsorCreate, SponsorEdit } from './resources/sponsors/sponsor-form';
import { SponsorList } from './resources/sponsors/sponsor-list';

dayjs.locale('vi');

const resources = [
  { name: 'users', list: '/users', create: '/users/create', edit: '/users/:id/edit', meta: { label: 'Tài khoản nhân viên' } },
  { name: 'events', list: '/events', create: '/events/create', show: '/events/:id', meta: { label: 'Giải đấu' } },
  ...catalogResources,
  { name: 'players', list: '/players', create: '/players/create', edit: '/players/:id/edit', meta: { label: 'Vận động viên' } },
  { name: 'pairs', list: '/pairs', meta: { label: 'Cặp đôi' } },
  { name: 'imports', list: '/imports', show: '/imports/:id', meta: { label: 'Lịch sử import' } },
  ...rankingResources,
  { name: 'articles', list: '/articles', create: '/articles/create', edit: '/articles/:id/edit', meta: { label: 'Tin tức' } },
  { name: 'videos', list: '/videos', create: '/videos/create', edit: '/videos/:id/edit', meta: { label: 'Video' } },
  { name: 'static-pages', list: '/static-pages', create: '/static-pages/create', edit: '/static-pages/:id/edit', meta: { label: 'Trang tĩnh' } },
  { name: 'contact-messages', list: '/contact-messages', meta: { label: 'Hộp thư liên hệ' } },
  { name: 'sponsors', list: '/sponsors', create: '/sponsors/create', edit: '/sponsors/:id/edit', meta: { label: 'Nhà tài trợ' } },
  { name: 'audit-logs', list: '/audit-logs', meta: { label: 'Nhật ký thao tác' } },
];

// Refine's parser otherwise treats the data-router splat as resource params and skips edit-id lookup.
const adminRouterProvider = {
  ...routerProvider,
  parse: () => {
    const parse = routerProvider.parse!();
    return () => {
      const result = parse();
      const route = result.action ? result.resource?.[result.action as 'list' | 'create' | 'edit' | 'show'] : undefined;
      const pathParams = typeof route === 'string' ? matchPath(route, result.pathname ?? '/')?.params : undefined;
      const params = { ...pathParams, ...result.params };
      delete params['*'];
      return { ...result, ...(pathParams?.id ? { id: decodeURIComponent(pathParams.id) } : {}), params };
    };
  },
};

function AdminApplication() {
  return (
      <ConfigProvider theme={antdTheme} locale={viVN}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            i18nProvider={i18nProvider}
            routerProvider={adminRouterProvider}
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
                    {rankingRoutes}
                    <Route path="/players" element={<RequireAccess resource="players" action="list"><PlayerList /></RequireAccess>} />
                    <Route path="/players/create" element={<RequireAccess resource="players" action="create"><PlayerCreate /></RequireAccess>} />
                    <Route path="/players/:id/edit" element={<RequireAccess resource="players" action="read"><PlayerEdit /></RequireAccess>} />
                    <Route path="/pairs" element={<RequireAccess resource="players" action="list"><PairList /></RequireAccess>} />
                    <Route path="/imports" element={<RequireAccess resource="tournaments" action="list"><ImportList /></RequireAccess>} />
                    <Route path="/imports/:id" element={<RequireAccess resource="tournaments" action="read"><ImportDetailPage /></RequireAccess>} />
                    <Route path="/audit-logs"element={<RequireAccess resource="audit-logs" action="list"><AuditLogList /></RequireAccess>} />
                    <Route path="/settings" element={<RequireAccess resource="settings" action="list"><SettingsPage /></RequireAccess>} />
                    <Route path="/articles" element={<RequireAccess resource="content" action="list"><ArticleList /></RequireAccess>} />
                    <Route path="/articles/create" element={<RequireAccess resource="content" action="create"><ArticleCreate /></RequireAccess>} />
                    <Route path="/articles/:id/edit" element={<RequireAccess resource="content" action="update"><ArticleEdit /></RequireAccess>} />
                    <Route path="/videos" element={<RequireAccess resource="content" action="list"><VideoList /></RequireAccess>} />
                    <Route path="/videos/create" element={<RequireAccess resource="content" action="create"><VideoCreate /></RequireAccess>} />
                    <Route path="/videos/:id/edit" element={<RequireAccess resource="content" action="update"><VideoEdit /></RequireAccess>} />
                    <Route path="/static-pages" element={<RequireAccess resource="content" action="list"><StaticPageList /></RequireAccess>} />
                    <Route path="/static-pages/create" element={<RequireAccess resource="content" action="create"><StaticPageCreate /></RequireAccess>} />
                    <Route path="/static-pages/:id/edit" element={<RequireAccess resource="content" action="update"><StaticPageEdit /></RequireAccess>} />
                    <Route path="/contact-messages" element={<RequireAccess resource="content" action="list"><ContactMessageList /></RequireAccess>} />
                    <Route path="/sponsors" element={<RequireAccess resource="sponsors" action="list"><SponsorList /></RequireAccess>} />
                    <Route path="/sponsors/create" element={<RequireAccess resource="sponsors" action="create"><SponsorCreate /></RequireAccess>} />
                    <Route path="/sponsors/:id/edit" element={<RequireAccess resource="sponsors" action="update"><SponsorEdit /></RequireAccess>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </StepUpProvider>
          </Refine>
        </AntdApp>
      </ConfigProvider>
  );
}

const adminRouter = createBrowserRouter([{ path: '*', element: <AdminApplication /> }]);

export function App() {
  return <RouterProvider router={adminRouter} />;
}
