import '@ant-design/v5-patch-for-react-19';
import '@refinedev/antd/dist/reset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setApiBase } from './api/http-client';
import { App } from './app';
import { loadRuntimeConfig } from './runtime-config';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

void loadRuntimeConfig().then((config) => {
  setApiBase(config.API_BASE_PATH);
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
