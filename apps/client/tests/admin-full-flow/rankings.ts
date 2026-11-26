import { expect, type Page, type Response } from '@playwright/test';
import { dateInput, pickOption, uiResponse } from './ui';
import { saveEvidence, type EventFixture, type FullUiWorld, type ListFixture, type RunEvidence } from './world';

interface SnapshotRow {
  playerId: string; rank: number; points: number;
  player: { id: string; fullName: string };
  breakdown: { eventId: string; eventName: string; stageCode: string; points: number }[];
}

interface SnapshotJob {
  state: string;
  failedReason: string | null;
  result: { snapshotId?: string } | null;
}

export async function snapshot(page: Page, world: FullUiWorld, list: ListFixture, asOf: string, evidence: RunEvidence): Promise<{ id: string; rows: SnapshotRow[] }> {
  await page.goto(`${world.adminOrigin}/ranking-snapshots`);
  const [filtered] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && url.pathname === '/api/v1/admin/ranking-snapshots'
        && url.searchParams.get('filter[listId]') === list.id && response.ok();
    }),
    pickOption(page, page.getByRole('combobox').first(), list.name, false, true, 'keyboard'),
  ]);
  expect(filtered.status(), 'The snapshot list must be filtered by the private list through its real UI').toBe(200);
  await page.getByRole('button', { name: /Tạo bản nháp$/ }).click();
  const modal = page.getByRole('dialog', { name: 'Tạo bản nháp', exact: true });
  await pickOption(page, modal.getByLabel('Bảng xếp hạng', { exact: true }), list.name, true, true, 'keyboard');
  await page.keyboard.press('Escape');
  await dateInput(modal.getByLabel('Ngày chốt', { exact: true }), asOf);
  const observed = new Map<string, SnapshotJob>();
  const receiveJob = async (response: Response) => {
    const path = new URL(response.url()).pathname;
    const prefix = '/api/v1/admin/ranking/jobs/';
    if (response.request().method() === 'GET' && path.startsWith(prefix) && response.ok()) {
      observed.set(decodeURIComponent(path.slice(prefix.length)), ((await response.json()) as { data: SnapshotJob }).data);
    }
  };
  // The first UI poll can already report completion before the draft POST's promise resumes.
  page.on('response', receiveJob);
  let id: string;
  try {
    const jobs = await uiResponse<{ jobs: { listId: string; jobId: string }[] }>(page, 'POST', '/admin/ranking-snapshots/drafts', () => modal.getByRole('button', { name: 'Tạo bản nháp', exact: true }).click());
    expect(jobs.jobs).toHaveLength(1);
    expect(jobs.jobs[0]!.listId).toBe(list.id);
    const jobId = jobs.jobs[0]!.jobId;
    await expect.poll(() => observed.get(jobId)?.state, { timeout: 90_000 }).toMatch(/^(completed|failed)$/);
    const job = observed.get(jobId)!;
    expect(job.state, job.failedReason ?? 'Snapshot job observed through the UI must complete').toBe('completed');
    expect(job.result?.snapshotId).toBeTruthy();
    id = job.result!.snapshotId!;
  } finally { page.off('response', receiveJob); }
  expect(id).toBeTruthy();
  evidence.snapshots.push(id);
  await saveEvidence(evidence);
  let rows: SnapshotRow[] | undefined;
  let total = 0;
  const receive = async (response: Response) => {
    if (response.request().method() === 'GET' && new URL(response.url()).pathname === `/api/v1/admin/ranking-snapshots/${id}/rows` && response.ok()) {
      const body = (await response.json()) as { data: SnapshotRow[]; total: number };
      rows = body.data;
      total = body.total;
    }
  };
  page.on('response', receive);
  try {
    const link = page.locator(`a[href="/ranking-snapshots/${id}"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/ranking-snapshots/${id}(?:\\?|$)`));
    await expect.poll(() => rows).toBeDefined();
  } finally { page.off('response', receive); }
  const allRows = [...rows!];
  for (let guard = 0; allRows.length < total && guard < 20; guard++) {
    const next = page.waitForResponse((response) => response.request().method() === 'GET'
      && new URL(response.url()).pathname === `/api/v1/admin/ranking-snapshots/${id}/rows` && response.ok());
    await page.locator('.ant-table-wrapper .ant-pagination-next').click();
    allRows.push(...((await (await next).json()) as { data: SnapshotRow[] }).data);
  }
  expect(allRows).toHaveLength(total);
  expect(allRows.length).toBeGreaterThan(0);
  expect(new Set(allRows.map((row) => row.playerId)).size).toBe(total);
  let rank = 0;
  const expectedRanks = allRows.map((row, index) => {
    if (index === 0 || row.points !== allRows[index - 1]!.points) rank = index + 1;
    return rank;
  });
  expect(allRows.map((row) => row.rank)).toEqual(expectedRanks);
  expect(allRows.map((row) => row.points)).toEqual(allRows.map((row) => row.points).toSorted((a, b) => b - a));
  return { id, rows: allRows };
}

export async function publishSnapshot(page: Page, world: FullUiWorld, id: string): Promise<void> {
  await page.getByRole('button', { name: 'Công bố', exact: true }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Công bố BXH' });
  const success = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/admin/ranking-snapshots/${id}/publish` && response.ok());
  await modal.getByRole('button', { name: 'Công bố', exact: true }).click();
  const password = page.getByRole('dialog', { name: 'Nhập lại mật khẩu để tiếp tục', exact: true });
  // A recent explicit step-up may still authorize this publish; require the UI if challenged.
  await Promise.race([success, password.waitFor({ state: 'visible' })]);
  if (await password.isVisible()) {
    await password.getByLabel('Mật khẩu của bạn', { exact: true }).fill(world.users.admin.password);
    await password.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  }
  expect((await success).status()).toBe(200);
}

export async function publicRanking(page: Page, world: FullUiWorld, list: ListFixture, expected: SnapshotRow[], event: EventFixture, points: number): Promise<void> {
  // The public ranking is an <ol> of <details> rows; each summary holds exactly two <strong>: rank, then points.
  const rows = page.getByRole('list', { name: list.name, exact: true }).locator(':scope > li');
  await expect.poll(async () => {
    await page.goto(`${world.siteOrigin}/vi/rankings/${list.code}`);
    const first = rows.first();
    return await first.count() ? first.locator('summary strong').last().textContent() : null;
  }, { timeout: 15_000 }).toBe(expected[0]!.points.toLocaleString('vi'));
  const count = await rows.count();
  expect(count).toBeLessThanOrEqual(expected.length);
  for (let index = 0; index < count; index++) {
    const summary = rows.nth(index).locator('summary');
    const source = expected[index]!;
    await expect(summary).toContainText(source.player.fullName);
    await expect(summary.locator('strong').first()).toHaveText(String(source.rank));
    await expect(summary.locator('strong').last()).toHaveText(source.points.toLocaleString('vi'));
  }
  const top = rows.first();
  await expect(top.locator('summary')).toContainText(expected[0]!.player.fullName);
  await top.locator('summary').click();
  await expect(top.locator('details')).toHaveAttribute('open', '');
  const breakdown = top.locator('details tbody tr').filter({ hasText: event.name });
  await expect(breakdown.locator('td').nth(2)).toHaveText(String(points));
}

export async function editWinnerRule(page: Page, world: FullUiWorld): Promise<void> {
  await page.goto(`${world.adminOrigin}/ranking-rules`);
  const field = page.getByRole('spinbutton', { name: `Vô địch (W) – ${world.catalog.eventTypeName}`, exact: true });
  await expect(field).toHaveValue(String(world.ranking.oldWinnerPoints));
  await field.fill(String(world.ranking.newWinnerPoints));
  await field.press('Tab');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Lưu phiên bản quy tắc', exact: true });
  const date = modal.getByLabel('Áp dụng từ ngày', { exact: true });
  const [year, month, day] = world.today.split('-');
  await expect(date).toHaveValue(`${day}/${month}/${year}`);
  await modal.getByLabel('Ghi chú', { exact: true }).fill('Sample rule effective today for the full UI regression; no acceptance decision.');
  await uiResponse(page, 'PUT', '/admin/ranking-rules/matrix', () => modal.getByRole('button', { name: 'Lưu phiên bản', exact: true }).click());
  await expect(modal).not.toBeVisible();
}
