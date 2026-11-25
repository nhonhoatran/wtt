import { expect, type Page } from '@playwright/test';
import { dateInput, pickOption, uiResponse } from './ui';
import { saveEvidence, type EventFixture, type FullUiWorld, type RunEvidence, type SubFixture } from './world';

export async function createEvent(page: Page, world: FullUiWorld, evidence: RunEvidence, current = false): Promise<EventFixture> {
  await page.goto(`${world.adminOrigin}/events/create`);
  const name = `Full UI ${current ? 'new' : 'main'} ${world.tag}`;
  await page.getByLabel('Tên giải', { exact: true }).fill(name);
  await pickOption(page, page.getByLabel('Hạng giải', { exact: true }), world.catalog.eventTypeName);
  await dateInput(page.getByLabel('Ngày bắt đầu', { exact: true }), current ? world.newEventDate : world.oldStartDate);
  await dateInput(page.getByLabel('Ngày kết thúc', { exact: true }), current ? world.newEventDate : world.oldEndDate);
  await pickOption(page, page.getByLabel('Địa điểm', { exact: true }), world.catalog.venueName);
  const event = await uiResponse<Omit<EventFixture, 'subEvents'>>(page, 'POST', '/admin/events', () => page.getByRole('button', { name: /Lưu nháp$/ }).click());
  const fixture = { ...event, subEvents: [] };
  evidence.events.push(fixture);
  await saveEvidence(evidence);
  await expect(page).toHaveURL(new RegExp(`/events/${event.id}/sub-events$`));
  return fixture;
}

export async function addContents(page: Page, world: FullUiWorld, event: EventFixture, evidence: RunEvidence, singlesOnly = false): Promise<void> {
  await page.getByRole('button', { name: /Thêm nội dung$/ }).click();
  const modal = page.getByRole('dialog', { name: 'Thêm nội dung thi đấu', exact: true });
  await modal.getByRole('checkbox', { name: world.catalog.msDisciplineName, exact: true }).check();
  if (!singlesOnly) await modal.getByRole('checkbox', { name: world.catalog.wdDisciplineName, exact: true }).check();
  await pickOption(page, modal.getByLabel('Thể thức trận', { exact: true }), world.catalog.matchFormatName);
  const rows = await uiResponse<SubFixture[]>(page, 'POST', `/admin/events/${event.id}/sub-events/bulk`, () => modal.getByRole('button', { name: `Tạo ${singlesOnly ? 1 : 2} nội dung`, exact: true }).click());
  event.subEvents = rows;
  await saveEvidence(evidence);
  // Keep the cross-record regression causal: edit the qualifying singles record before the non-qualifying doubles record.
  const editOrder = singlesOnly ? ['MS'] : ['MS', 'WD'];
  expect(rows.map((row) => row.code).toSorted()).toEqual([...editOrder].toSorted());
  for (const code of editOrder) {
    const row = rows.find((item) => item.code === code)!;
    const singles = row.code === 'MS';
    const tableRow = page.getByRole('row').filter({ has: page.getByText(row.code, { exact: true }) });
    await tableRow.getByRole('button', { name: 'Sửa', exact: true }).click();
    const edit = page.getByRole('dialog').filter({ hasText: 'Sửa nội dung:' });
    const qualifying = edit.getByRole('switch', { name: 'Có vòng loại', exact: true });
    // Opening another record must use its own value, even after editing a qualifying singles event.
    await expect(qualifying).toHaveAttribute('aria-checked', String(row.hasQualifying));
    if (!singles) {
      await edit.getByRole('radio', { name: 'Vòng bảng + loại trực tiếp', exact: true }).check();
      await pickOption(page, edit.getByLabel('Luật vòng bảng', { exact: true }), world.catalog.groupRuleName);
    }
    if (singles && !singlesOnly) {
      await qualifying.click();
      await expect(qualifying).toHaveAttribute('aria-checked', 'true');
    }
    await pickOption(page, edit.getByLabel('Bảng xếp hạng', { exact: true }), singles ? world.ranking.ms.name : world.ranking.wd.name);
    const expectedQualifying = singles && !singlesOnly;
    await expect(qualifying).toHaveAttribute('aria-checked', String(expectedQualifying));
    const saved = await uiResponse<SubFixture>(page, 'PATCH', `/admin/events/${event.id}/sub-events/${row.id}`, () => edit.getByRole('button', { name: 'Lưu', exact: true }).click());
    expect(saved.hasQualifying, `${row.code} must retain its own qualifying configuration`).toBe(expectedQualifying);
    Object.assign(row, saved);
    await saveEvidence(evidence);
    await expect(edit).not.toBeVisible();
  }
}

export async function importEntries(page: Page, world: FullUiWorld, event: EventFixture, evidence: RunEvidence, kind: 'MS' | 'WD'): Promise<void> {
  const sub = event.subEvents.find((row) => row.code === kind)!;
  await page.goto(`${world.adminOrigin}/events/${event.id}/entries?subEvent=${sub.id}`);
  await page.getByRole('button', { name: /Nhập từ Excel$/ }).click();
  const job = await uiResponse<{ id: string }>(page, 'POST', '/admin/imports', () => page.locator('input[type=file]').setInputFiles(kind === 'MS' ? world.files.msXlsx : world.files.wdXlsx));
  evidence.imports.push(job.id);
  await saveEvidence(evidence);
  await expect(page).toHaveURL(new RegExp(`[?&]import=${job.id}`));
  const count = kind === 'MS' ? 40 : 12;
  if (kind === 'MS') {
    await expect(page.getByRole('tab', { name: /Cần xác nhận \(1\)/ })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('tab', { name: /Cần xác nhận \(1\)/ }).click();
    const decision = page.getByRole('combobox', { name: /Chọn VĐV 1 cho dòng/ }).first();
    await pickOption(page, decision, 'Tạo VĐV mới', false);
    await expect(page.getByRole('tab', { name: /Cần xác nhận \(0\)/ })).toBeVisible();
  }
  const commit = page.getByRole('button', { name: `Nhập ${count} dòng`, exact: true });
  await expect(commit).toBeEnabled({ timeout: 60_000 });
  await commit.click();
  const confirm = page.getByRole('dialog').filter({ hasText: `Nhập ${count} dòng hợp lệ?` });
  await uiResponse(page, 'POST', `/admin/imports/${job.id}/commit`, () => confirm.getByRole('button', { name: 'Nhập', exact: true }).click());
  await expect(page.getByText(`Đã nhập ${count} dòng.`, { exact: true })).toBeVisible({ timeout: 90_000 });
}

export async function addReplacementEntry(page: Page, world: FullUiWorld, event: EventFixture): Promise<{ id: string; competitor: { displayName: string } }> {
  const ms = event.subEvents.find((row) => row.code === 'MS')!;
  await page.goto(`${world.adminOrigin}/events/${event.id}/entries?subEvent=${ms.id}`);
  await page.getByRole('button', { name: /Thêm VĐV$/ }).click();
  const playerLookup = page.getByRole('combobox', { name: 'Thêm VĐV', exact: true });
  await expect(playerLookup).toHaveCount(1);
  await expect(playerLookup).toBeFocused();
  const lookupResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && url.pathname === '/api/v1/admin/players/lookup'
      && url.searchParams.get('q') === world.reference.replacementName && response.ok();
  });
  await pickOption(page, playerLookup, world.reference.replacementName, true, false);
  const lookupBody = await (await lookupResponse).json() as { data: { fullName: string }[] };
  expect(lookupBody.data.some((player) => player.fullName === world.reference.replacementName), 'The UI lookup must return the exact replacement player').toBe(true);
  const addButton = page.getByRole('button', { name: /Thêm vào danh sách$/ });
  await expect(addButton).toHaveCount(1);
  const added = await uiResponse<{ id: string; competitor: { displayName: string } }>(page, 'POST', `/admin/sub-events/${ms.id}/entries`, () => addButton.click());
  await expect(addButton).not.toHaveClass(/ant-btn-loading/);
  await expect(addButton).toBeDisabled();
  await expect(playerLookup).toBeFocused();
  const selector = playerLookup.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select ")][1]');
  await expect(selector.locator('.ant-select-selection-item')).toHaveCount(0);
  return added;
}

export async function addExistingSingles(page: Page, world: FullUiWorld, event: EventFixture, names: string[]): Promise<void> {
  const ms = event.subEvents.find((row) => row.code === 'MS')!;
  await page.goto(`${world.adminOrigin}/events/${event.id}/entries?subEvent=${ms.id}`);
  await page.getByRole('button', { name: /Thêm VĐV$/ }).click();
  for (const name of names) {
    const playerLookup = page.getByRole('combobox', { name: 'Thêm VĐV', exact: true });
    await expect(playerLookup).toHaveCount(1);
    await expect(playerLookup).toBeFocused();
    const lookupResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && url.pathname === '/api/v1/admin/players/lookup'
        && url.searchParams.get('q') === name && response.ok();
    });
    await pickOption(page, playerLookup, name, true, false);
    const lookupBody = await (await lookupResponse).json() as { data: { fullName: string }[] };
    expect(lookupBody.data.some((player) => player.fullName === name), `The UI search must return the exact requested player: ${name}`).toBe(true);
    const addButton = page.getByRole('button', { name: /Thêm vào danh sách$/ });
    await expect(addButton).toHaveCount(1);
    await expect(addButton).toBeEnabled();
    await uiResponse(page, 'POST', `/admin/sub-events/${ms.id}/entries`, () => addButton.click());
    await expect(addButton).not.toHaveClass(/ant-btn-loading/);
    await expect(addButton).toBeDisabled();
    await expect(playerLookup).toBeFocused();
    const selector = playerLookup.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select ")][1]');
    await expect(selector.locator('.ant-select-selection-item')).toHaveCount(0);
  }
}
