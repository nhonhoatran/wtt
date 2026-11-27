import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// The workspace's browser tooling is declared by the client, while Vite belongs to the admin.
const requireClient = createRequire(new URL('../../../client/package.json', import.meta.url));
const { chromium, expect } = requireClient('@playwright/test');
const adminRoot = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(adminRoot, 'test-results/import-row-decision-select');
let server;
let browser;
let origin;

before(async () => {
  server = await createServer({
    root: adminRoot,
    configFile: path.join(adminRoot, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    clearScreen: false,
  });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  });
  await mkdir(artifacts, { recursive: true });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

for (const width of [320, 390, 1440]) {
  test(`candidate popup and trigger fit a ${width}px viewport inside a wide import table`, async (context) => {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    const writes = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/v1/admin/imports/fixture-import/rows/7', async (route) => {
      writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await route.fulfill({ json: { data: {} } });
    });
    try {
      await page.goto(`${origin}/test/browser/import-row-decision-select.html`);
      const combo = page.getByRole('combobox', { name: 'Chọn VĐV 1 cho dòng 7' });
      await combo.waitFor({ state: 'visible' });
      await combo.click();
      const popup = page.locator('.ant-select-dropdown:visible');
      await popup.waitFor({ state: 'visible' });
      const option = page.getByRole('option', { name: /KMT001/ });
      await option.waitFor({ state: 'visible' });
      // rc-trigger positions again when the opening transition finishes.
      await page.waitForFunction(() => !document.querySelector('.ant-slide-up-appear, .ant-slide-up-enter'));
      await page.screenshot({ path: path.join(artifacts, `${width}-popup.png`), fullPage: true });

      const metrics = await page.evaluate(() => {
        const trigger = document.querySelector('.ant-select').getBoundingClientRect();
        const popup = document.querySelector('.ant-select-dropdown').getBoundingClientRect();
        return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, trigger: { left: trigger.left, right: trigger.right, width: trigger.width }, popup: { left: popup.left, right: popup.right, width: popup.width } };
      });
      context.diagnostic(JSON.stringify(metrics));
      assert.equal(metrics.documentWidth, width, JSON.stringify(metrics));
      assert.equal(metrics.viewport, width, JSON.stringify(metrics));
      assert.ok(metrics.trigger.left >= 0 && metrics.trigger.right <= width, JSON.stringify(metrics));
      assert.ok(metrics.popup.left >= 0 && metrics.popup.right <= width, JSON.stringify(metrics));
      assert.match(await option.innerText(), /Nguyễn Trần Hoàng Minh Anh/);
      assert.match(await option.innerText(), /Phường Nguyễn Thái Bình Thành phố Hồ Chí Minh.*1991/);
      const textFits = await option.locator('.ant-select-item-option-content').evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      assert.ok(textFits.scroll <= textFits.client + 1, JSON.stringify(textFits));
      if (width <= 575) assert.ok((await page.getByRole('option', { name: 'Tạo VĐV mới' }).boundingBox()).height >= 44);

      await option.click();
      await page.getByLabel('Số lựa chọn đã lưu').filter({ hasText: '1' }).waitFor();
      assert.deepEqual(writes, [{ method: 'PATCH', body: { slot: 1, choice: 'player-a' } }]);

      // Namesakes retain club/year identity; the same control can choose NEW by keyboard.
      await expect(combo).toHaveAttribute('aria-expanded', 'false');
      await expect(combo).toBeEnabled();
      await combo.focus();
      await combo.press('ArrowDown');
      await expect(combo).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('option', { name: 'Tạo VĐV mới' }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('.ant-slide-up-appear, .ant-slide-up-enter, .ant-slide-up-leave'));
      for (let index = 0; index < 3; index++) {
        if ((await page.locator('.ant-select-item-option-active').innerText()).includes('Tạo VĐV mới')) break;
        await combo.press('ArrowDown');
      }
      assert.match(await page.locator('.ant-select-item-option-active').innerText(), /Tạo VĐV mới/);
      await combo.press('Enter');
      await page.getByLabel('Số lựa chọn đã lưu').filter({ hasText: '2' }).waitFor();
      assert.deepEqual(writes[1], { method: 'PATCH', body: { slot: 1, choice: 'NEW' } });
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}
