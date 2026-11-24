import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';

const api = new URL(process.env.E2E_FULL_UI_API_ORIGIN ?? 'http://localhost:3371');
if (api.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(api.hostname)
  || api.username || api.password || api.pathname !== '/' || api.search || api.hash) {
  throw new Error('E2E_FULL_UI_API_ORIGIN must be a loopback HTTP origin');
}
const proxy = Object.fromEntries(['/api/v1/admin', '/api/v1/auth', '/api/v1/media'].map((route) => [route, api.origin]));

export default mergeConfig(base, defineConfig({
  server: { host: '127.0.0.1', port: 3372, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 3372, strictPort: true, proxy },
}));
