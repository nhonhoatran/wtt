import { expect, type Page, type TestInfo } from '@playwright/test';
import { openDraw, type DrawFixture } from './draws';
import { dateInput, uiResponse } from './ui';
import { saveEvidence, type EventFixture, type FullUiWorld, type RunEvidence } from './world';

export async function scheduleAndPrint(page: Page, world: FullUiWorld, event: EventFixture, evidence: RunEvidence, info: TestInfo): Promise<void> {
  await page.goto(`${world.adminOrigin}/events/${event.id}/schedule`);
  await page.getByRole('button', { name: /Thêm buổi thi đấu$/ }).click();
  const modal = page.getByRole('dialog', { name: 'Thêm buổi thi đấu', exact: true });
  await dateInput(modal.getByLabel('Ngày', { exact: true }), world.oldStartDate);
  await modal.getByLabel('Mã buổi', { exact: true }).fill(`S-${world.tag.slice(0, 8)}`);
  await modal.getByLabel('Tên buổi', { exact: true }).fill(`Full UI session ${world.tag}`);
  await modal.getByLabel('Giờ bắt đầu', { exact: true }).fill('08:00');
  await modal.getByLabel('Giờ bắt đầu', { exact: true }).press('Enter');
  await modal.getByLabel('Giờ kết thúc', { exact: true }).fill('18:00');
  await modal.getByLabel('Giờ kết thúc', { exact: true }).press('Enter');
  const session = await uiResponse<{ id: string }>(page, 'POST', `/admin/events/${event.id}/sessions`, () => modal.getByRole('button', { name: 'Lưu', exact: true }).click());
  evidence.sessions.push(session.id);
  await saveEvidence(evidence);
  await expect(modal).not.toBeVisible();
  const unscheduled = page.locator('.ant-card').filter({ has: page.getByText('Trận chưa xếp', { exact: true }) });
  const placed: number[] = [];
  for (let index = 0; index < 3; index++) {
    const match = unscheduled.getByRole('button', { pressed: false }).filter({ hasText: /^#/ }).first();
    const number = Number(/^#(\d+)/.exec((await match.innerText()).trim())?.[1]);
    expect(number).toBeGreaterThan(0);
    await match.click();
    await uiResponse(page, 'PATCH', /\/api\/v1\/admin\/matches\/[^/]+\/schedule$/, () => page.getByRole('button', { name: 'Xếp vào đây', exact: true }).first().click());
    placed.push(number);
    await expect(page.getByRole('button', { name: `Bỏ xếp trận #${number}`, exact: true })).toBeVisible();
  }
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: /In phiếu trận$/ }).click();
  const print = await popup;
  await expect(print.getByRole('button', { name: /(?:^|\s)In$/ })).toBeEnabled();
  for (const number of placed) await expect(print.getByRole('heading', { name: new RegExp(`^Trận #${number} ·`) })).toBeVisible();
  await expect(print.locator('section')).toHaveCount(placed.length);
  await print.emulateMedia({ media: 'print' });
  const pdf = await print.pdf({ path: info.outputPath('match-sheets.pdf'), printBackground: true, preferCSSPageSize: true });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  await print.screenshot({ path: info.outputPath('match-sheets-print.png'), fullPage: true });
  await print.close();
}

export async function withdrawGroupEntrant(page: Page, world: FullUiWorld, event: EventFixture, groupDraw: DrawFixture, entrant: string, groupCode: string, matchNo: number): Promise<void> {
  const sub = event.subEvents.find((row) => row.id === groupDraw.subEventId)!;
  await openDraw(page, world, event, sub, 'GROUP');
  const buttons = page.getByRole('button', { name: /^Rút .+ khỏi bảng / });
  await expect(buttons).toHaveCount(12);
  await page.getByRole('button', { name: `Rút ${entrant} khỏi bảng ${groupCode}`, exact: true }).click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Thao tác với' });
  await expect(modal.getByRole('radio')).toHaveCount(0);
  await expect(modal.getByRole('combobox', { name: 'VĐV thay thế', exact: true })).toHaveCount(0);
  await expect(modal.getByText('Ảnh hưởng', { exact: true })).toBeVisible();
  await expect(modal.getByText(new RegExp(`Trận #${matchNo} thành walkover`))).toBeVisible();
  const save = modal.getByRole('button', { name: 'Rút khỏi bảng', exact: true });
  await expect(save).toBeDisabled();
  await modal.locator('textarea').fill('Withdraw one group entrant under the private sample KEEP_PLAYED_RESULTS policy.');
  await expect(save).toBeEnabled();
  const result = await uiResponse<{ allowed?: boolean; impacts?: { type: string }[] }>(page, 'POST', `/admin/draws/${groupDraw.id}/withdraw-entry`, () => save.click());
  expect(result.impacts?.map((impact) => impact.type)).toEqual(expect.arrayContaining(['WALKOVER', 'STANDINGS_RECOMPUTE']));
  expect(result.impacts?.map((impact) => impact.type)).not.toContain('VOID_MATCH');
  await expect(modal).not.toBeVisible();
  await expect(buttons).toHaveCount(11);
}
