import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const requireClient = createRequire(new URL('../../../client/package.json', import.meta.url));
const { chromium } = requireClient('@playwright/test');
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'test-results/discipline-colors');
let server, browser, origin;

before(async () => {
  server = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  await mkdir(artifacts, { recursive: true });
});
after(async () => { await browser?.close(); await server?.close(); });

const singles = { id: 'singles', code: 'MS', name: 'Đơn nam', colorHex: '#123456' };
const doubles = { id: 'doubles', code: 'MD', name: 'Đôi nam theo nhóm tuổi và câu lạc bộ dành cho vận động viên phong trào đã đăng ký thi đấu tại giải', colorHex: null };
const match = (number, discipline, conflicts = []) => ({
  id: `match-${number}`, matchNo: number, eventId: 'fixture-event', subEventId: discipline.id,
  subEventCode: discipline.code, subEventName: discipline.name, discipline, drawKind: 'MAIN', roundCode: 'SF', groupCode: null,
  status: 'SCHEDULED', resultType: null, winnerSide: null, games1: null, games2: null,
  side1: { id: `entry-${number}-a`, displayName: `Nguyễn Văn ${number}`, players: [] },
  side2: { id: `entry-${number}-b`, displayName: `Trần Minh ${number}`, players: [] },
  ready: true, version: 0, scheduleVersion: 0, sessionId: 'fixture-session', tableId: `table-${number}`,
  tableCode: `B${number}`, orderInSession: 1, scheduledAt: '2026-11-27T01:00:00Z', conflicts,
});
const rows = [match(1, singles), match(2, doubles), match(3, singles, [{ kind: 'TABLE_OVERLAP', withMatchId: 'match-1', withMatchNo: 1, tableId: 'table-3' }])];

for (const width of [390, 1440]) {
  test(`schedule keeps discipline text, neutral fallback and conflict feedback at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/v1/admin/events/fixture-event/matches?*', (route) => route.fulfill({ json: { data: rows, total: rows.length } }));
    try {
      await page.goto(`${origin}/test/browser/discipline-colors.html`);
      const legend = page.getByRole('list', { name: 'Màu nội dung trong buổi' });
      await legend.waitFor();
      assert.equal(await legend.getByRole('listitem').count(), 2);
      assert.match(await legend.innerText(), /MS · Đơn nam/);
      assert.match(await legend.innerText(), /MD · Đôi nam/);
      const accent = async (number, code) => page.getByText(`#${number} · ${code}`, { exact: false }).locator('..').evaluate((element) => getComputedStyle(element).borderInlineStartColor);
      assert.equal(await accent(1, 'MS'), 'rgb(18, 52, 86)');
      assert.notEqual(await accent(2, 'MD'), 'rgb(18, 52, 86)');
      const warning = page.getByRole('note', { name: /1 cảnh báo trùng lịch/ });
      await warning.waitFor();
      const warningTextColor = await warning.evaluate((element) => getComputedStyle(element).color);
      const warningFrameColor = await warning.locator('..').evaluate((element) => getComputedStyle(element).borderTopColor);
      assert.equal(warningTextColor, warningFrameColor);
      assert.notEqual(warningFrameColor, await accent(3, 'MS'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await page.screenshot({ path: path.join(artifacts, `${width}-schedule.png`), fullPage: true });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
