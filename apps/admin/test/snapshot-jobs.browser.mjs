// Mocked-HTTP browser regression; no database, worker or credentials are used.
// Run: node --test apps/admin/test/snapshot-jobs.browser.mjs
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const { chromium, expect } = createRequire(new URL('../../client/package.json', import.meta.url))('@playwright/test');
const adminRoot = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.resolve(adminRoot, '../../test-results', `snapshot-jobs-${randomUUID()}`);
const listId = '00000000-0000-4000-8000-000000000001';
const oldId = '00000000-0000-4000-8000-000000000002';
const newId = '00000000-0000-4000-8000-000000000003';
let server;
let browser;
let origin;

before(async () => {
  await mkdir(artifacts, { recursive: true });
  // Optional negative control serves committed components without overwriting concurrent edits.
  const baseline = process.env.SNAPSHOT_JOBS_BASELINE === '1' ? new Map(['snapshot-jobs-tracker.tsx', 'ranking-board-actions.tsx', 'snapshot-preview-page.tsx'].map((name) => [`src/pages/ranking/${name}`, execFileSync('git', ['show', `HEAD:apps/admin/src/pages/ranking/${name}`], { cwd: adminRoot, encoding: 'utf8', windowsHide: true })])) : new Map();
  const baselinePlugin = { name: 'snapshot-jobs-baseline', enforce: 'pre', transform: (code, id) => baseline.get(path.relative(adminRoot, id.split('?')[0]).replaceAll(path.sep, '/')) ?? code };
  server = await createServer({ root: adminRoot, plugins: [baselinePlugin], logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: true } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  console.log(`Mock browser evidence: ${artifacts}`);
}, { timeout: 120_000 });

after(async () => {
  await browser?.close();
  await server?.close();
});

async function setup(initialOutcome, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = { outcome: initialOutcome, polls: 0, posts: 0, reads: 0, detailReads: 0, latestId: oldId, rowsId: null };
  const snapshot = (id) => ({ id, rankingListId: listId, rankingList: { id: listId, code: 'MS', name: 'Đơn nam' }, asOfDate: '2026-11-27', status: 'DRAFT', createdAt: '2026-11-27T03:00:00Z', publishedAt: null, publishedBy: null, publishedById: null, _count: { rows: 0 }, dirtySubEvents: 1 });
  await page.route('**/config.json', (route) => route.fulfill({ json: { API_BASE_PATH: '/api/v1' } }));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/api/v1', '');
    if (endpoint === '/auth/me') return route.fulfill({ json: { data: { id: 'admin', name: 'Browser QA', email: 'browser@example.test', role: 'ADMIN', permissions: [], mustChangePassword: false, listDefaultPageSize: 20, siteName: { vi: 'QA', en: 'QA' } } } });
    if (endpoint === '/admin/ranking-lists') return route.fulfill({ json: { data: [{ id: listId, code: 'MS', name: 'Đơn nam', isActive: true }], total: 1 } });
    if (endpoint === '/admin/ranking/context') return route.fulfill({ json: { data: { today: '2026-11-27', timeZone: 'Asia/Ho_Chi_Minh' } } });
    if (endpoint === '/admin/ranking-snapshots/drafts') {
      state.posts++;
      return route.fulfill({ json: { data: { jobs: [{ listId, listCode: 'MS', jobId: 'rank-snap-browser' }] } } });
    }
    if (endpoint.startsWith('/admin/ranking/jobs/')) {
      state.polls++;
      if (state.outcome === 'network') return route.abort('failed');
      if (typeof state.outcome === 'number') return route.fulfill({ status: state.outcome, json: { error: { code: 'LOOKUP_ERROR', message: 'Không kiểm tra được tiến độ' } } });
      if (state.outcome === 'failed') return route.fulfill({ json: { data: { state: 'failed', failedReason: '2 sub-event(s) not recomputed', result: null } } });
      if (state.outcome === 'succeeded') state.latestId = newId;
      return route.fulfill({ json: { data: { state: 'completed', failedReason: null, result: state.outcome === 'succeeded' ? { snapshotId: newId } : null } } });
    }
    if (endpoint === '/admin/ranking-snapshots') {
      state.reads++;
      return route.fulfill({ json: { data: [snapshot(state.latestId)], total: 1 } });
    }
    if (endpoint.endsWith('/summary')) return route.fulfill({ json: { data: { rows: 0, changed: 0, newcomers: 0, expiredPoints: 0, previous: null } } });
    if (endpoint.endsWith('/rows')) {
      state.rowsId = endpoint.split('/')[3];
      return route.fulfill({ json: { data: [], total: 0 } });
    }
    if (endpoint.startsWith('/admin/ranking-snapshots/')) {
      state.detailReads++;
      return route.fulfill({ json: { data: snapshot(endpoint.split('/')[3]) } });
    }
    return route.fulfill({ json: { data: [], total: 0 } });
  });
  return { page, state, errors, close: () => context.close() };
}

for (const outcome of ['failed', 500, 503, 404, 'network', 'missing-result']) {
  test(`board retains ${outcome} job feedback after its snapshot refresh`, { timeout: 120_000 }, async () => {
    const fixture = await setup(outcome, outcome === 404);
    const { page, state, errors } = fixture;
    try {
      await page.goto(`${origin}/rankings?list=${listId}`);
      const rebuild = page.getByRole('button', { name: 'Tính lại ngay', exact: true });
      await expect(rebuild).toBeVisible();
      const reads = state.reads;
      await rebuild.click();
      const feedback = page.getByText(outcome === 'failed' ? 'Không dựng được bản nháp' : 'Chưa xác định được kết quả dựng bản nháp', { exact: true });
      await expect(feedback).toBeVisible();
      await expect.poll(() => state.reads).toBeGreaterThan(reads);
      await expect(feedback).toBeVisible();
      assert.equal(state.posts, 1);
      assert.match(page.url(), /\/rankings\?/);
      if (outcome === 404) {
        await expect(page.getByRole('link', { name: 'Xem lịch sử kỳ chốt' })).toBeVisible();
        assert.ok((await feedback.boundingBox()).width > 195, 'The mobile feedback text must retain readable width beside its actions');
        await page.screenshot({ path: path.join(artifacts, '404-mobile.png'), fullPage: true });
      }
      assert.deepEqual(errors, []);
    } finally { await fixture.close(); }
  });
}

test('checking an unknown job again accepts its exact result without enqueuing a second job', { timeout: 120_000 }, async () => {
  const fixture = await setup(503);
  const { page, state } = fixture;
  try {
    await page.goto(`${origin}/rankings?list=${listId}`);
    await page.getByRole('button', { name: 'Tính lại ngay', exact: true }).click();
    await expect(page.getByText('Chưa xác định được kết quả dựng bản nháp', { exact: true })).toBeVisible();
    state.outcome = 'succeeded';
    await page.getByRole('button', { name: 'Kiểm tra lại', exact: true }).click();
    await expect.poll(() => state.rowsId).toBe(newId);
    await expect(page.getByText('Chưa xác định được kết quả dựng bản nháp', { exact: true })).toHaveCount(0);
    assert.equal(state.posts, 1);
    assert.equal(state.polls, 2);
  } finally { await fixture.close(); }
});

for (const outcome of [404, 'succeeded']) {
  test(`preview ${outcome === 404 ? 'keeps unknown feedback without refetching the old draft' : 'opens the exact returned snapshot'}`, { timeout: 120_000 }, async () => {
    const fixture = await setup(outcome);
    const { page, state } = fixture;
    try {
      await page.goto(`${origin}/ranking-snapshots/${oldId}`);
      await page.getByRole('button', { name: 'Tính lại ngay', exact: true }).click();
      if (outcome === 404) {
        await expect(page.getByText('Chưa xác định được kết quả dựng bản nháp', { exact: true })).toBeVisible();
        assert.equal(state.detailReads, 1);
        assert.equal(new URL(page.url()).pathname, `/ranking-snapshots/${oldId}`);
      } else await expect.poll(() => new URL(page.url()).pathname).toBe(`/ranking-snapshots/${newId}`);
      assert.equal(state.posts, 1);
    } finally { await fixture.close(); }
  });
}
