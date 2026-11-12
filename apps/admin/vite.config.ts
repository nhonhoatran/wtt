import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Mirrors the production nginx allowlist: only admin and auth routes reach the API.
    proxy: {
      '/api/v1/admin': 'http://localhost:3000',
      '/api/v1/auth': 'http://localhost:3000',
    },
  },
});
