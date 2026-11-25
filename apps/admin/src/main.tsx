import '@ant-design/v5-patch-for-react-19';
import '@refinedev/antd/dist/reset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setApiBase } from './api/http-client';
import { setApiUrlBase } from './api/api-url';
import { setPublicSiteUrl } from './api/public-site-url';
import { App } from './app';
import { loadRuntimeConfig } from './runtime-config';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

void loadRuntimeConfig().then((config) => {
  setApiBase(config.API_BASE_PATH);
  setApiUrlBase(config.API_BASE_PATH);
  setPublicSiteUrl(config.PUBLIC_SITE_URL);
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
