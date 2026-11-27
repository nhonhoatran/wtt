// Actual admin routes/forms with a held business-clock response; no ranking data is written.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const { chromium, expect } = createRequire(new URL('../../../client/package.json', import.meta.url))('@playwright/test');
const root = fileURLToPath(new URL('../../', import.meta.url));
let server, browser, origin;

before(async () => {
  server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null }, clearScreen: false });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
});

after(async () => { await browser?.close(); await server?.close(); });

const forms = [
  { path: '/ranking-snapshots', open: 'Tạo bản nháp', submit: 'Tạo bản nháp', title: 'Tạo bản nháp', field: 'Ngày chốt' },
  { path: '/ranking-points', open: 'Thêm điểm thủ công', submit: 'Thêm điểm', title: 'Thêm điểm thủ công', field: 'Ngày đạt điểm' },
];

for (const width of [390, 1440]) {
  for (const form of forms) {
    for (const retry of [false, true]) {
    test(`${form.title} waits for a fresh business day${retry ? ' after error and retry' : ''} when reopened at ${width}px`, { timeout: 75_000 }, async () => {
      const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
      if (retry) await page.clock.install();
      const errors = [], writes = [];
      let today = '2026-11-27', held = false, fail = false, release;
      let heldRequest;
      const requested = new Promise(resolve => { heldRequest = resolve; });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/config.json', route => route.fulfill({ json: { API_BASE_PATH: '/api/v1' } }));
      await page.route('**/api/v1/**', async route => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        if (request.method() !== 'GET') writes.push({ method: request.method(), endpoint });
        if (endpoint === '/api/v1/auth/me') return route.fulfill({ json: { data: { id: 'admin', name: 'Browser QA', email: 'browser@example.test', role: 'ADMIN', permissions: [], mustChangePassword: false, listDefaultPageSize: 20, siteName: { vi: 'QA', en: 'QA' } } } });
        if (endpoint === '/api/v1/admin/ranking/context') {
          if (held) {
            const pending = new Promise(resolve => { release = resolve; });
            heldRequest();
            await pending;
          }
          if (fail) return route.fulfill({ status: 503, json: { error: { code: 'CLOCK_UNAVAILABLE', message: 'Clock unavailable' } } }).catch(() => {});
          return route.fulfill({ json: { data: { today, timeZone: 'Asia/Ho_Chi_Minh' } } }).catch(() => {});
        }
        return route.fulfill({ json: { data: [], total: 0 } });
      });
      try {
        await page.goto(`${origin}${form.path}`);
        const open = page.getByRole('button', { name: new RegExp(`(?:^| )${form.open}$`) });
        await open.click();
        const modal = page.getByRole('dialog', { name: form.title, exact: true });
        await expect(modal.getByLabel(form.field, { exact: true })).toHaveValue('27/11/2026');
        await modal.getByRole('button', { name: 'Hủy', exact: true }).click();
        await expect(modal).not.toBeVisible();

        // Simulate the server's business midnight while this route and modal observer stay mounted.
        today = '2026-11-28';
        held = true;
        await open.click();
        await requested;
        await expect(modal).toBeVisible();
        await expect(modal.getByLabel(form.field, { exact: true })).not.toBeVisible();
        await expect(modal.getByRole('button', { name: form.submit, exact: true })).toBeDisabled();
        held = false;
        fail = retry;
        release();
        const unavailable = modal.getByText('Không tải được ngày nghiệp vụ', { exact: true });
        if (retry) {
          await expect(unavailable).toBeVisible({ timeout: 12_000 });
          await expect(modal.getByLabel(form.field, { exact: true })).not.toBeVisible();
          await expect(modal.getByRole('button', { name: form.submit, exact: true })).toBeDisabled();
          fail = false;
          await modal.getByRole('button', { name: 'Thử lại', exact: true }).click();
        }
        await expect(modal.getByLabel(form.field, { exact: true })).toHaveValue('28/11/2026');
        if (retry) {
          // Once initialized, a routine clock refresh must preserve the operator's edited date.
          const field = modal.getByLabel(form.field, { exact: true });
          await field.fill('26/11/2026');
          await field.press('Tab');
          await expect(field).toHaveValue('26/11/2026');
          fail = true;
          await page.clock.fastForward(60_000);
          await expect(unavailable).toBeVisible({ timeout: 12_000 });
          await expect(field).toHaveValue('26/11/2026');
          fail = false;
          await modal.getByRole('button', { name: 'Thử lại', exact: true }).click();
          await expect(unavailable).not.toBeVisible();
          await expect(field).toHaveValue('26/11/2026');
        }
        assert.deepEqual(writes, []);
        assert.deepEqual(errors, []);
      } finally { release?.(); await page.close(); }
    });
    }
  }
}
