import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..', 'apps/admin');
const require = createRequire(path.join(root, 'package.json'));
const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
const target = 'http://localhost:3371';
const server = await preview({
  root, configFile: false,
  preview: { host: 'localhost', port: 3372, strictPort: true,
    proxy: { '/api/v1/admin': target, '/api/v1/auth': target, '/api/v1/media': target } },
  plugins: [{ name: 'full-ui-runtime-config', configurePreviewServer(instance) {
    instance.middlewares.use('/config.json', (_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ API_BASE_PATH: '/api/v1', ADMIN_PUBLIC_URL: 'http://localhost:3372', PUBLIC_SITE_URL: 'http://localhost:3373' }));
    });
  } }],
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.httpServer.close(() => process.exit(0)));
