import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@kamito/ui-tokens/antd-theme': fileURLToPath(new URL('../../packages/ui-tokens/src/antd-theme.ts', import.meta.url)) },
  },
  server: { proxy: {
      '/api': 'http://localhost:3100',
      '/s3': { target: 'http://localhost:9010', changeOrigin: true, rewrite: (p) => p.replace(/^\/s3/, '') },
    } },
});
