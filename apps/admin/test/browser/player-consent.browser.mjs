// Actual admin route and PlayerCreate component; HTTP is mocked, no real profile is created.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const { chromium, expect } = createRequire(new URL('../../../client/package.json', import.meta.url))('@playwright/test');
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/player-consent');
let server, browser, origin;

before(async () => {
  // Other test work may rebuild workspace packages; this run uses the source loaded at navigation.
  server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null }, clearScreen: false });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  await mkdir(artifacts, { recursive: true });
});

after(async () => { await browser?.close(); await server?.close(); });

for (const width of [390, 1440]) {
  for (const optIn of [false, true]) {
    test(`PlayerCreate sends ${optIn ? 'explicit public opt-in' : 'private by default'} at ${width}px`, { timeout: 60_000 }, async () => {
      const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
      const errors = [], writes = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/config.json', (route) => route.fulfill({ json: { API_BASE_PATH: '/api/v1' } }));
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        if (endpoint === '/api/v1/auth/me') return route.fulfill({ json: { data: { id: 'admin', name: 'Browser QA', email: 'browser@example.test', role: 'ADMIN', permissions: [], mustChangePassword: false, listDefaultPageSize: 20, siteName: { vi: 'QA', en: 'QA' } } } });
        if (endpoint === '/api/v1/admin/media/config') return route.fulfill({ json: { data: { allowedTypes: ['image/jpeg'], maxBytes: 5242880 } } });
        if (endpoint === '/api/v1/admin/players' && request.method() === 'POST') {
          writes.push(request.postDataJSON());
          return route.fulfill({ status: 201, json: { data: { id: '00000000-0000-4000-8000-000000000001', ...writes.at(-1) } } });
        }
        return route.fulfill({ json: { data: [], total: 0 } });
      });
      try {
        await page.goto(`${origin}/players/create`);
        const publicSwitch = page.getByRole('switch', { name: 'Có trang hồ sơ công khai', exact: true });
        await expect(publicSwitch).toHaveAttribute('aria-checked', 'false');
        const noindex = page.getByRole('switch', { name: 'Chặn Google lập chỉ mục', exact: true });
        await expect(noindex).toHaveAttribute('aria-checked', 'true');
        await page.getByLabel('Họ tên', { exact: true }).fill(`Synthetic ${optIn ? 'public' : 'private'} ${width}`);
        // Ant Design's button-style radio hides the native input; use its visible label.
        await page.getByText('Nam', { exact: true }).click();
        await expect(page.getByRole('radio', { name: 'Nam', exact: true })).toBeChecked();
        if (optIn) await publicSwitch.click();
        await expect(publicSwitch).toHaveAttribute('aria-checked', String(optIn));
        await publicSwitch.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, `${width}-${optIn ? 'opt-in' : 'default-private'}.png`), fullPage: true });
        const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/admin/players' && res.request().method() === 'POST');
        await page.getByRole('button', { name: /(?:^| )Tạo VĐV$/ }).click();
        assert.equal((await response).status(), 201);
        await expect(page).toHaveURL(`${origin}/players`);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].isPublicProfile, optIn);
        assert.equal(writes[0].noindex, true);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
  }
}
