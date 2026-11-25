import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { closeDrawer, pickOption, uiResponse } from './ui';
import { saveEvidence, type EventFixture, type FullUiWorld, type RunEvidence } from './world';

export interface ResultRow {
  id: string; matchNo: number; subEventId: string; drawKind: 'MAIN' | 'QUALIFYING' | 'GROUP';
  roundCode: string; groupCode: string | null; ready: boolean; status: string; version: number;
  side1: { id: string; displayName: string } | null; side2: { id: string; displayName: string } | null;
}
export interface MatchDetail extends ResultRow {
  winnerSide: 1 | 2 | null; games1: number | null; games2: number | null; resultType: string | null;
  games: { number: number; score1: number; score2: number }[];
  format: { bestOf: number; pointsPerGame: number; winBy: number };
}

export async function resultRows(page: Page, world: FullUiWorld, event: EventFixture, code: 'MS' | 'WD', official = false): Promise<ResultRow[]> {
  const sub = event.subEvents.find((row) => row.code === code)!;
  let rows: ResultRow[] | undefined;
  const receive = async (response: Response) => {
    const url = new URL(response.url());
    if (response.request().method() !== 'GET' || url.pathname !== `/api/v1/admin/events/${event.id}/matches`
      || url.searchParams.get('filter[subEventId]') !== sub.id
      || url.searchParams.get('filter[status]') !== (official ? 'OFFICIAL' : 'OPEN') || !response.ok()) return;
    rows = (await response.json() as { data: ResultRow[] }).data;
  };
  page.on('response', receive);
  try {
    const subEventsLoaded = page.waitForResponse((response) => response.request().method() === 'GET'
      && new URL(response.url()).pathname === `/api/v1/admin/events/${event.id}/sub-events` && response.ok());
    await page.goto(`${world.adminOrigin}/results`);
    await pickOption(page, page.getByRole('combobox', { name: 'Giải đấu', exact: true }), event.name);
    const subEventsResponse = await subEventsLoaded;
    const subEventsBody = await subEventsResponse.json() as { data: { code: string }[] };
    expect(subEventsResponse.status(), 'The normal event picker must load its sub-events before the UI filter opens').toBe(200);
    expect(subEventsBody.data.some((row) => row.code === code), `The UI-loaded event must contain ${code}`).toBe(true);
    await pickOption(page, page.getByRole('combobox', { name: 'Nội dung', exact: true }), code === 'MS' ? world.catalog.msDisciplineName : world.catalog.wdDisciplineName, false);
    await pickOption(page, page.getByRole('combobox', { name: 'Trạng thái', exact: true }), official ? 'Đã chốt' : 'Chưa chốt', false);
    await expect.poll(() => rows, { message: 'Result list must come from the real UI query' }).toBeDefined();
    return rows!;
  } finally { page.off('response', receive); }
}

export async function openResult(page: Page, match: ResultRow): Promise<MatchDetail> {
  await closeDrawer(page);
  return uiResponse<MatchDetail>(page, 'GET', `/admin/matches/${match.id}`, () => page.locator(`tr[data-row-key="${match.id}"]`).click());
}

async function fillWin(scope: Locator, detail: MatchDetail, winner: 1 | 2, loserPoints = 0): Promise<void> {
  const wins = Math.ceil(detail.format.bestOf / 2);
  for (let index = 1; index <= wins; index++) {
    const inputs = scope.getByRole('textbox', { name: new RegExp(`^Ván ${index}: điểm `) });
    await inputs.nth(0).fill(String(winner === 1 ? detail.format.pointsPerGame : loserPoints));
    await inputs.nth(1).fill(String(winner === 2 ? detail.format.pointsPerGame : loserPoints));
  }
}

async function publicScore(page: Page, detail: MatchDetail): Promise<boolean> {
  const table = page.getByRole('table', { name: 'Điểm từng ván', exact: true });
  if (!await table.count()) return false;
  const rows = await table.locator('tbody tr').all();
  if (rows.length !== 2) return false;
  const first = await rows[0]!.locator('td').allTextContents();
  const second = await rows[1]!.locator('td').allTextContents();
  return JSON.stringify(first) === JSON.stringify([...detail.games.map((game) => String(game.score1)), String(detail.games1)])
    && JSON.stringify(second) === JSON.stringify([...detail.games.map((game) => String(game.score2)), String(detail.games2)])
    && await page.getByLabel('Đã kết thúc', { exact: true }).count() > 0;
}

export async function confirmResult(page: Page, publicPage: Page, world: FullUiWorld, event: EventFixture, detail: MatchDetail, evidence: RunEvidence, winner: 1 | 2 = 1, operation = 'confirm'): Promise<MatchDetail> {
  const route = `${world.siteOrigin}/vi/events/${event.slug}/matches/${detail.matchNo}`;
  // A real browser warms the public page before the UI write; no manual revalidation is performed.
  await publicPage.goto(route);
  await expect.poll(async () => {
    await publicPage.reload({ waitUntil: 'domcontentloaded' });
    return publicPage.getByLabel(detail.status === 'LIVE' ? 'Đang đấu' : 'Chưa đấu', { exact: true }).count();
  }, { message: 'Warmed public state must reflect the unfinished match before confirmation' }).toBe(1);
  const before = await publicPage.locator('main').innerText();
  const drawer = page.locator('.ant-drawer-open');
  await fillWin(drawer, detail, winner);
  await drawer.getByRole('button', { name: 'Xác nhận kết quả', exact: true }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Xác nhận kết quả?' });
  const started = performance.now();
  const confirmed = await uiResponse<MatchDetail>(page, 'POST', `/admin/matches/${detail.id}/confirm`, () => modal.getByRole('button', { name: 'Xác nhận', exact: true }).click());
  let changed = false;
  while (performance.now() - started < 5_000) {
    await publicPage.reload({ waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.floor(5_000 - (performance.now() - started))) });
    changed = await publicScore(publicPage, confirmed);
    if (changed) break;
  }
  const elapsedMs = Math.round(performance.now() - started);
  expect(changed, `Public match #${detail.matchNo} must refresh after the UI confirmation`).toBe(true);
  expect(elapsedMs).toBeLessThanOrEqual(5_000);
  expect(await publicPage.locator('main').innerText()).not.toBe(before);
  evidence.latencies.push({ eventId: event.id, matchNo: detail.matchNo, operation, elapsedMs });
  await saveEvidence(evidence);
  await closeDrawer(page);
  return confirmed;
}

export async function amendResult(page: Page, detail: MatchDetail, publicPage: Page, world: FullUiWorld, event: EventFixture, evidence: RunEvidence): Promise<MatchDetail> {
  await publicPage.goto(`${world.siteOrigin}/vi/events/${event.slug}/matches/${detail.matchNo}`);
  expect(await publicScore(publicPage, detail), 'Public game points must match the original result before the amendment').toBe(true);
  const drawer = page.locator('.ant-drawer-open');
  await expect(drawer.getByRole('button', { name: 'Mở lại', exact: true })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Sửa tỷ số', exact: true }).click();
  const modal = page.getByRole('dialog', { name: `Sửa tỷ số trận #${detail.matchNo}`, exact: true });
  const winner = detail.winnerSide;
  if (winner !== 1 && winner !== 2) throw new Error('An official fixture result must identify its winner before amendment');
  await fillWin(modal, detail, winner, 1);
  await modal.getByLabel('Lý do', { exact: true }).fill('Correct the recorded game points without changing the winner.');
  const started = performance.now();
  const amended = await uiResponse<MatchDetail>(page, 'POST', `/admin/matches/${detail.id}/amend-scores`, () => modal.getByRole('button', { name: 'Lưu tỷ số', exact: true }).click());
  expect(amended.winnerSide).toBe(detail.winnerSide);
  expect(amended.games[0]).toMatchObject(detail.winnerSide === 1 ? { score2: 1 } : { score1: 1 });
  let changed = false;
  while (performance.now() - started < 5_000) {
    await publicPage.reload({ waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.floor(5_000 - (performance.now() - started))) });
    changed = await publicScore(publicPage, amended);
    if (changed) break;
  }
  const elapsedMs = Math.round(performance.now() - started);
  expect(changed, 'The public game points must refresh after a same-winner UI amendment').toBe(true);
  expect(elapsedMs).toBeLessThanOrEqual(5_000);
  evidence.latencies.push({ eventId: event.id, matchNo: detail.matchNo, operation: 'amend', elapsedMs });
  await saveEvidence(evidence);
  return amended;
}

export async function reopenResult(page: Page, world: FullUiWorld, detail: MatchDetail): Promise<MatchDetail> {
  await page.locator('.ant-drawer-open').getByRole('button', { name: 'Mở lại', exact: true }).click();
  const modal = page.getByRole('dialog', { name: `Mở lại trận #${detail.matchNo}`, exact: true });
  await expect(modal.getByText('Sẽ bị ảnh hưởng', { exact: true })).toBeVisible();
  await expect(modal.getByText('Có trận phía sau đã đấu', { exact: true })).toHaveCount(0);
  await modal.getByLabel('Lý do', { exact: true }).fill('Reopen the upstream fixture while its next match remains unplayed.');
  const response = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/v1/admin/matches/${detail.id}/reopen` && r.ok());
  await modal.getByRole('button', { name: 'Mở lại', exact: true }).click();
  const password = page.getByRole('dialog', { name: 'Nhập lại mật khẩu để tiếp tục', exact: true });
  await expect(password).toBeVisible();
  await password.getByLabel('Mật khẩu của bạn', { exact: true }).fill(world.users.admin.password);
  await password.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  const body = await (await response).json() as { data: MatchDetail; impact: { affected: { status: string; effect: string }[] } };
  const reopened = body.data;
  expect(reopened.status).toBe('LIVE');
  expect(reopened).toMatchObject({ resultType: null, winnerSide: null, games1: null, games2: null });
  expect(reopened.games).toEqual(detail.games);
  expect(reopened.version).toBeGreaterThan(detail.version);
  expect(body.impact.affected.some((cell) => cell.status === 'SCHEDULED' && cell.effect === 'CLEAR_SIDE')).toBe(true);
  await expect(modal).not.toBeVisible();
  return reopened;
}
