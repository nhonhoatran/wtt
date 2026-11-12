import { tokens } from '@kamito/ui-tokens';
import { antdTheme } from '@kamito/ui-tokens/antd-theme';
import { App as AntdApp, ConfigProvider, Layout, Typography } from 'antd';
import viVN from 'antd/locale/vi_VN';
import type { AdminRuntimeConfig } from './runtime-config';

// Empty shell; Refine resources and auth arrive after spike B/C.
export function App({ config }: { config: AdminRuntimeConfig }) {
  return (
    <ConfigProvider theme={antdTheme} locale={viVN}>
      <AntdApp>
        <Layout style={{ minHeight: '100vh' }}>
          <Layout.Header>
            <Typography.Text style={{ color: tokens.color.surface }} strong>
              Quản trị giải đấu
            </Typography.Text>
          </Layout.Header>
          <Layout.Content style={{ padding: 24 }}>
            <Typography.Paragraph type="secondary">API: {config.API_BASE_PATH}</Typography.Paragraph>
          </Layout.Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
}
