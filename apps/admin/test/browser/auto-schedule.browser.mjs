// Real React/Ant Design controls, mocked HTTP only; no database or worker writes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const { chromium, expect } = createRequire(new URL('../../../client/package.json', import.meta.url))('@playwright/test');
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/auto-schedule');
let server, browser, origin;

before(async () => {
  server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  await mkdir(artifacts, { recursive: true });
});

after(async () => { await browser?.close(); await server?.close(); });

const session = (id, code, name, endTime = '18:00') => ({
  id, code, name, endTime, eventId: 'fixture-event', date: '2026-11-27', startTime: '08:00',
  venueId: null, nameEn: null, matchCount: 0,
  tables: [{ tableId: 'table-1', code: 'B1', displayName: null, order: 1 }],
});
const sessions = [session('session-am', 'AM', 'Buổi sáng'), session('session-pm', 'PM', 'Buổi chiều'), session('session-open', 'OPEN', 'Chưa có giờ kết thúc', null)];

async function setup(width, staleOnce = false) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
  const state = { previews: [], applies: [], reads: 0, errors: [] };
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.route('**/api/v1/admin/events/fixture-event/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/sessions')) {
      state.reads++;
      return route.fulfill({ json: { data: sessions } });
    }
    const body = route.request().postDataJSON();
    if (endpoint.endsWith('/preview')) {
      state.previews.push(body);
      const selected = sessions.find((item) => item.id === body.sessionIds[0]);
      if (!selected) return route.fulfill({ status: 422, json: { error: { message: 'Select a bounded session first' } } });
      return route.fulfill({ json: { data: {
        assignments: [{ matchId: 'match-1', matchNo: 1, sessionId: selected.id, sessionCode: selected.code, tableId: 'table-1', tableCode: 'B1', orderInSession: 1, scheduledAt: '2026-11-27T01:00:00Z' }],
        skipped: [], fingerprint: String(state.previews.length).repeat(64), timeZone: 'Asia/Ho_Chi_Minh', minRestMinutes: 15,
      } } });
    }
    if (endpoint.endsWith('/apply')) {
      state.applies.push(body);
      if (staleOnce && state.applies.length === 1) return route.fulfill({ status: 409, json: { error: { code: 'AUTO_SCHEDULE_STALE', message: 'Lịch đã thay đổi. Hãy xem gợi ý mới.' } } });
      return route.fulfill({ json: { data: { assignments: [{ matchId: 'match-1' }] } } });
    }
    return route.fulfill({ status: 404, json: { error: { message: 'Unexpected fixture request' } } });
  });
  await page.goto(`${origin}/test/browser/auto-schedule.html`);
  const open = () => page.getByRole('button', { name: 'Gợi ý xếp lịch', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Gợi ý xếp lịch', exact: true });
  const preview = async () => {
    const response = page.waitForResponse((res) => res.url().endsWith('/auto-schedule/preview'));
    await modal.getByRole('button', { name: /(?:^| )Xem gợi ý$/ }).click();
    assert.equal((await response).status(), 200);
    await expect(modal.locator('.ant-btn-loading')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: /(?:^| )Áp dụng 1 trận$/ })).toBeEnabled();
  };
  return { page, state, open, modal, preview };
}

for (const width of [390, 1440]) {
  test(`cancel and changed sessions cannot apply the previous proposal at ${width}px`, { timeout: 60_000 }, async () => {
    const { page, state, open, modal, preview } = await setup(width);
    try {
      await open();
      await preview();
      assert.deepEqual(state.previews, [{ sessionIds: ['session-am'] }]);
      const bounds = await modal.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, JSON.stringify(bounds));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await page.screenshot({ path: path.join(artifacts, `${width}-preview.png`), fullPage: true });
      await modal.getByRole('button', { name: 'Đóng', exact: true }).last().click();
      await expect(modal).not.toBeVisible();
      assert.equal(state.applies.length, 0, 'Preview/cancel must never send apply');

      await open();
      await expect(modal.getByRole('button', { name: /(?:^| )Áp dụng 0 trận$/ })).toBeDisabled();
      await preview();
      await modal.locator('.ant-select-selection-item-remove').click();
      await expect(modal.getByRole('button', { name: /(?:^| )Áp dụng 0 trận$/ })).toBeDisabled();
      await expect(modal.getByRole('button', { name: /(?:^| )Xem gợi ý$/ })).toBeDisabled();
      const select = modal.getByRole('combobox', { name: 'Buổi dùng để gợi ý', exact: true });
      await select.focus();
      await select.press('ArrowDown');
      const dropdown = page.locator('.ant-select-dropdown:visible');
      await dropdown.getByText('PM · 27/11 · Buổi chiều', { exact: true }).click();
      await select.press('Escape');
      await expect(modal.getByRole('button', { name: /(?:^| )Áp dụng 0 trận$/ })).toBeDisabled();
      await preview();
      assert.deepEqual(state.previews.at(-1), { sessionIds: ['session-pm'] });
      await modal.getByRole('button', { name: /(?:^| )Áp dụng 1 trận$/ }).click();
      await expect(modal).not.toBeVisible();
      assert.deepEqual(state.applies, [{ sessionIds: ['session-pm'], expectedFingerprint: '3'.repeat(64) }]);
      assert.deepEqual(state.errors, []);
    } finally { await page.close(); }
  });

  test(`stale 409 discards the old proposal and requires a fresh preview at ${width}px`, { timeout: 60_000 }, async () => {
    const { page, state, open, modal, preview } = await setup(width, true);
    try {
      await open();
      await preview();
      const reads = state.reads;
      await modal.getByRole('button', { name: /(?:^| )Áp dụng 1 trận$/ }).click();
      await expect(modal.getByRole('alert').filter({ hasText: 'Lịch đã thay đổi. Hãy xem gợi ý mới.' })).toBeVisible();
      await expect(modal.locator('.ant-btn-loading')).toHaveCount(0);
      await expect(modal.getByRole('button', { name: /(?:^| )Áp dụng 0 trận$/ })).toBeDisabled();
      await expect.poll(() => state.reads).toBeGreaterThan(reads);
      assert.equal(state.applies.length, 1);
      await page.screenshot({ path: path.join(artifacts, `${width}-stale.png`), fullPage: true });
      await preview();
      await expect(modal.getByText('Lịch đã thay đổi. Hãy xem gợi ý mới.', { exact: true })).toHaveCount(0);
      await modal.getByRole('button', { name: /(?:^| )Áp dụng 1 trận$/ }).click();
      await expect(modal).not.toBeVisible();
      assert.deepEqual(state.applies, [
        { sessionIds: ['session-am'], expectedFingerprint: '1'.repeat(64) },
        { sessionIds: ['session-am'], expectedFingerprint: '2'.repeat(64) },
      ]);
      assert.deepEqual(state.errors, []);
    } finally { await page.close(); }
  });
}
