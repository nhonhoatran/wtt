import { expect, type Locator, type Page } from '@playwright/test';
import type { UserFixture } from './world';

export async function login(page: Page, origin: string, user: UserFixture): Promise<void> {
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  const response = page.waitForResponse((r) => r.url().endsWith('/auth/sign-in/email') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await response).status(), 'Real Better Auth UI sign-in').toBe(200);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

export async function pickOption(page: Page, field: Locator, text: string, search = true, exact = true, selection: 'pointer' | 'keyboard' = 'pointer'): Promise<void> {
  // Ant Design's selected-value span covers the search input; keyboard focus opens both empty and preselected controls.
  await field.focus();
  await field.press('ArrowDown');
  if (search && await field.evaluate((element) => element.tagName === 'INPUT')) await field.fill(text);
  const dropdown = page.locator('.ant-select-dropdown:visible');
  if (selection === 'keyboard') {
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    const listboxId = await field.getAttribute('aria-controls') ?? await field.getAttribute('aria-owns');
    expect(listboxId, 'The active Select must own its dropdown listbox').toBeTruthy();
    const listbox = page.locator(`[id="${listboxId}"]`);
    await expect(listbox).toBeAttached();
    const options = listbox.locator('[role="option"]');
    const optionNodes = await options.evaluateAll((items) => items.map((item) => ({
      id: item.id,
      label: item.getAttribute('aria-label') ?? item.textContent?.trim() ?? '',
    })));
    const targetIndex = optionNodes.findIndex((item) => exact ? item.label === text : item.label.includes(text));
    expect(targetIndex, `The open dropdown must contain the requested option: ${text}`).toBeGreaterThanOrEqual(0);
    const targetId = optionNodes[targetIndex]!.id;
    await expect(field).toBeFocused();
    let activeId = await field.getAttribute('aria-activedescendant');
    let activeIndex = optionNodes.findIndex((item) => item.id === activeId);
    if (activeIndex < 0) {
      await page.keyboard.press('ArrowDown');
      activeId = await field.getAttribute('aria-activedescendant');
      activeIndex = optionNodes.findIndex((item) => item.id === activeId);
    }
    expect(activeIndex, 'The focused Select must expose its active dropdown option').toBeGreaterThanOrEqual(0);
    const optionCount = optionNodes.length;
    const down = (targetIndex - activeIndex + optionCount) % optionCount;
    const up = (activeIndex - targetIndex + optionCount) % optionCount;
    const key = down <= up ? 'ArrowDown' : 'ArrowUp';
    for (let index = 0; index < Math.min(down, up); index++) {
      await page.keyboard.press(key);
      await expect(field).toBeFocused();
    }
    await expect(field).toHaveAttribute('aria-activedescendant', targetId);
    const active = page.locator(`[id="${targetId}"]`);
    await expect(active).toHaveAttribute('aria-label', text);
    await page.keyboard.press('Enter');
    const selector = field.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " ant-select-selector ")]');
    await expect(selector.getByText(text, { exact })).toBeVisible();
  } else {
    const option = exact ? dropdown.getByText(text, { exact: true }) : dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first();
    await expect(option).toBeVisible();
    await option.click();
  }
}

export async function dateInput(field: Locator, iso: string): Promise<void> {
  const [year, month, day] = iso.split('-');
  await field.fill(`${day}/${month}/${year}`);
  await field.press('Enter');
  await field.press('Tab');
}

export async function uiResponse<T>(page: Page, method: string, pathname: string | RegExp, action: () => Promise<unknown>): Promise<T> {
  const response = page.waitForResponse((r) => {
    const path = new URL(r.url()).pathname;
    return r.request().method() === method && (typeof pathname === 'string' ? path === `/api/v1${pathname}` : pathname.test(path));
  });
  const [result] = await Promise.all([response, action()]);
  expect(result.status(), `${method} ${new URL(result.url()).pathname}`).toBeGreaterThanOrEqual(200);
  expect(result.status(), `${method} ${new URL(result.url()).pathname}`).toBeLessThan(300);
  const body = await result.json() as { data: T; warnings?: string[] };
  expect(body.warnings ?? [], 'UI mutations must not silently report delayed public refresh').not.toContain('PUBLIC_REFRESH_DELAYED');
  return body.data;
}

export async function closeDrawer(page: Page): Promise<void> {
  const drawer = page.locator('.ant-drawer-open');
  if (await drawer.count()) {
    try {
      await drawer.getByRole('button', { name: 'Đóng', exact: true }).click({ timeout: 2_000 });
    } catch {
      // Successful confirmation can already be closing the drawer during its CSS animation.
      await expect(drawer, 'A failed close click is acceptable only when the drawer actually closes').not.toBeVisible();
    }
    await expect(drawer).not.toBeVisible();
  }
}
