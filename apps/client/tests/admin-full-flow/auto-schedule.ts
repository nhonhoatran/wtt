import { expect, type Page, type TestInfo } from '@playwright/test';
import { uiResponse } from './ui';
import type { EventFixture } from './world';

interface Proposal { assignments: { matchNo: number }[]; skipped: { matchNo: number; reason: string }[] }

/** Exercise preview, cancel and confirmed apply through the same controls on desktop and touch viewports. */
export async function autoSchedule(page: Page, event: EventFixture, preserved: number[], info: TestInfo): Promise<void> {
  const open = page.getByRole('button', { name: 'Gợi ý xếp lịch', exact: true });
  await open.click();
  const modal = page.getByRole('dialog', { name: 'Gợi ý xếp lịch', exact: true });
  await expect(modal.getByText('Giữ nguyên các trận đã có lịch', { exact: true })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Áp dụng 0 trận', exact: true })).toBeDisabled();
  const proposal = await uiResponse<Proposal>(page, 'POST', `/admin/events/${event.id}/auto-schedule/preview`, () => modal.getByRole('button', { name: 'Xem gợi ý', exact: true }).click());
  expect(proposal.assignments.length).toBeGreaterThan(0);
  expect(proposal.assignments.every((a) => !preserved.includes(a.matchNo))).toBe(true);
  const bounds = await modal.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: info.outputPath('auto-schedule-preview.png'), fullPage: true });
  await modal.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(modal).not.toBeVisible();
  for (const no of preserved) await expect(page.getByRole('button', { name: `Bỏ xếp trận #${no}`, exact: true })).toBeVisible();
  await open.click();
  await expect(modal.getByRole('button', { name: 'Áp dụng 0 trận', exact: true })).toBeDisabled();
  const fresh = await uiResponse<Proposal>(page, 'POST', `/admin/events/${event.id}/auto-schedule/preview`, () => modal.getByRole('button', { name: 'Xem gợi ý', exact: true }).click());
  expect(fresh).toEqual(proposal);
  const applied = await uiResponse<Proposal>(page, 'POST', `/admin/events/${event.id}/auto-schedule/apply`, () => modal.getByRole('button', { name: `Áp dụng ${fresh.assignments.length} trận`, exact: true }).click());
  expect(applied.assignments).toEqual(fresh.assignments);
  await expect(modal).not.toBeVisible();
  for (const no of [...preserved, fresh.assignments[0]!.matchNo]) await expect(page.getByRole('button', { name: `Bỏ xếp trận #${no}`, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('auto-schedule-applied.png'), fullPage: true });
}
