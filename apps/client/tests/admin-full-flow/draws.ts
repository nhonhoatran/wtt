import { expect, type Page } from '@playwright/test';
import { saveEvidence, type EventFixture, type FullUiWorld, type RunEvidence, type SubFixture } from './world';
import { pickOption, uiResponse } from './ui';

export type Kind = 'MAIN' | 'QUALIFYING' | 'GROUP';
export interface DrawFixture { id: string; kind: Kind; subEventId: string; version: number }
export interface DrawData extends DrawFixture {
  status: string;
  matches: { id: string; matchNo: number; roundCode: string; side1: { id: string; displayName: string } | null; side2: { id: string; displayName: string } | null; status: string; isVoided: boolean }[];
  groups?: { id: string; code: string; members: { entryId: string; entry: { id: string; displayName: string; status: string } }[]; standings: { entryId: string; rank: number; qualified: boolean }[] }[];
}
const labels: Record<Kind, string> = { MAIN: 'Nhánh chính', QUALIFYING: 'Vòng loại', GROUP: 'Bảng đấu' };

export async function openDraw(page: Page, world: FullUiWorld, event: EventFixture, sub: SubFixture, kind: Kind): Promise<void> {
  await page.goto(`${world.adminOrigin}/events/${event.id}/draws?subEvent=${sub.id}`);
  const title = sub.code === 'WD' ? world.catalog.wdDisciplineName : world.catalog.msDisciplineName;
  await expect(page.getByRole('radio', { name: new RegExp(title) })).toBeChecked();
  await expect(drawSection(page, kind)).toBeVisible();
}

const drawSection = (page: Page, kind: Kind) => page.locator(`[data-draw-kind="${kind}"]`);

export async function createDraw(page: Page, world: FullUiWorld, event: EventFixture, evidence: RunEvidence, sub: SubFixture, kind: Kind, small = false): Promise<DrawFixture> {
  await openDraw(page, world, event, sub, kind);
  await drawSection(page, kind).getByRole('button', { name: 'Bốc thăm', exact: true }).click();
  const wizard = page.getByRole('dialog', { name: `Bốc thăm ${labels[kind].toLowerCase()}`, exact: true });
  await expect(wizard.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
  const seed = wizard.getByLabel('Số hạt giống', { exact: true });
  if (await seed.count()) await seed.fill('0');
  const qualifiers = wizard.getByLabel('Số suất dành cho vòng loại', { exact: true });
  if (await qualifiers.count()) await qualifiers.fill(small ? '0' : '8');
  if (kind === 'GROUP') {
    await wizard.getByLabel('Số VĐV mỗi bảng', { exact: true }).fill('3');
    await wizard.getByRole('radio', { name: 'Nhất và nhì bảng (2)', exact: true }).check();
  }
  await expect(wizard.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeEnabled();
  await wizard.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  const next = wizard.getByRole('button', { name: 'Tiếp tục', exact: true });
  if (await next.count()) await next.click();
  const draw = await uiResponse<DrawFixture>(page, 'POST', `/admin/sub-events/${sub.id}/draws`, () => wizard.getByRole('button', { name: 'Bốc thăm', exact: true }).click());
  evidence.draws.push(draw.id);
  await saveEvidence(evidence);
  await expect(wizard).not.toBeVisible();
  await drawSection(page, kind).getByRole('button', { name: 'Công bố', exact: true }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'sẽ thấy bảng đấu trên trang giải' });
  await uiResponse(page, 'POST', `/admin/draws/${draw.id}/publish`, () => confirm.getByRole('button', { name: 'Công bố', exact: true }).click());
  return { ...draw, kind, subEventId: sub.id };
}

export async function publishEvent(page: Page, world: FullUiWorld, event: EventFixture): Promise<void> {
  await page.goto(`${world.adminOrigin}/events/${event.id}/info`);
  await page.getByRole('button', { name: 'Công bố giải', exact: true }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Công bố giải?' });
  await uiResponse(page, 'POST', `/admin/events/${event.id}/publish`, () => confirm.getByRole('button', { name: 'Công bố', exact: true }).click());
}

export async function replaceUnplayed(page: Page, world: FullUiWorld, event: EventFixture, draw: DrawFixture): Promise<void> {
  const sub = event.subEvents.find((row) => row.id === draw.subEventId)!;
  await openDraw(page, world, event, sub, draw.kind);
  const panel = drawSection(page, draw.kind);
  const entry = panel.getByRole('button', { pressed: false }).filter({ hasText: new RegExp(world.tag) }).first();
  await entry.click();
  const modal = page.getByRole('dialog').filter({ hasText: 'Thao tác với' });
  await pickOption(page, modal.getByRole('combobox', { name: 'VĐV thay thế', exact: true }), world.reference.replacementName);
  await modal.locator('textarea').fill('Replace one unplayed fixture entrant for the full browser flow.');
  const save = modal.getByRole('button', { name: 'Thay VĐV', exact: true });
  await expect(save).toBeEnabled();
  await uiResponse(page, 'POST', `/admin/draws/${draw.id}/replace-entry`, () => save.click());
  await expect(modal).not.toBeVisible();
  await expect(panel.getByText(world.reference.replacementName, { exact: true })).toBeVisible();
}

export async function placeQualifiers(page: Page, world: FullUiWorld, event: EventFixture, draw: DrawFixture): Promise<void> {
  const sub = event.subEvents.find((row) => row.id === draw.subEventId)!;
  await openDraw(page, world, event, sub, 'MAIN');
  const group = sub.code === 'WD';
  const action = group ? 'place-group-qualifiers' : 'place-qualifiers';
  await uiResponse(page, 'POST', `/admin/draws/${draw.id}/${action}`, () => page.getByRole('button', { name: group ? 'Đưa người đi tiếp vào nhánh chính' : 'Bốc suất vòng loại vào nhánh chính', exact: true }).click());
}
