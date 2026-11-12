import { Refine } from '@refinedev/core';
import { ThemedLayout, useNotificationProvider } from '@refinedev/antd';
import routerProvider, { NavigateToResource } from '@refinedev/react-router';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router';
import { App as AntdApp, ConfigProvider, Select } from 'antd';
import viVN from 'antd/es/locale/vi_VN';
import '@refinedev/antd/dist/reset.css';
import { antdTheme } from '@kamito/ui-tokens/antd-theme';
import { dataProvider } from './data-provider';
import { accessControlProvider, getRole, type Role } from './access-control';
import { PlayerList } from './player-list';
import { PlayerCreate } from './player-create';

function RoleSwitcher() {
  return (
    <Select<Role>
      data-testid="role-select"
      value={getRole()}
      style={{ width: 200, margin: 8 }}
      options={[{ value: 'ADMIN' }, { value: 'RESULTS_OPERATOR' }]}
      onChange={(v) => { localStorage.setItem('role', v); window.location.href = '/players'; }}
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ConfigProvider locale={viVN} theme={antdTheme}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider}
            routerProvider={routerProvider}
            accessControlProvider={accessControlProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              { name: 'players', list: '/players', create: '/players/create', meta: { label: 'Cau thu' } },
              { name: 'users', list: '/users', meta: { label: 'Nguoi dung (ADMIN)' } },
            ]}
            options={{ syncWithLocation: true, disableTelemetry: true }}
          >
            <Routes>
              <Route element={<ThemedLayout Header={RoleSwitcher}><Outlet /></ThemedLayout>}>
                <Route index element={<NavigateToResource resource="players" />} />
                <Route path="/players" element={<PlayerList />} />
                <Route path="/players/create" element={<PlayerCreate />} />
                <Route path="/users" element={<div data-testid="users-page">Users</div>} />
              </Route>
            </Routes>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
