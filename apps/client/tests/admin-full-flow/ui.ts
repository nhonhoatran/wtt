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
    await expect(page.locator(`[id="${listboxId}"]`)).toBeAttached();
    // Ant Design's accessible listbox only renders a window around the active option, so walk the active descendant.
    const activeLabel = () => field.evaluate((element) => {
      const id = element.getAttribute('aria-activedescendant');
      return (id && document.getElementById(id)?.getAttribute('aria-label')) || '';
    });
    const matches = (label: string) => exact ? label === text : label.includes(text);
    // Options fetched from the API can arrive after the dropdown opens; walking an empty list ends before the target exists.
    await expect(dropdown.locator('.ant-select-item-option').first(), 'The open dropdown must load its options').toBeVisible();
    const start = await field.getAttribute('aria-activedescendant');
    let found = matches(await activeLabel());
    for (let step = 0; !found && step < 100; step++) {
      await page.keyboard.press('ArrowDown');
      await expect(field).toBeFocused();
      found = matches(await activeLabel());
      if (!found && await field.getAttribute('aria-activedescendant') === start) break;
    }
    expect(found, `The open dropdown must contain the requested option: ${text}`).toBe(true);
    await page.keyboard.press('Enter');
    const selector = field.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " ant-select-selector ")]');
    await expect(selector.getByText(text, { exact })).toBeVisible();
  } else {
    const option = exact ? dropdown.getByText(text, { exact: true }) : dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first();
    await expect(option).toBeVisible();
    // A popup wider than a phone screen rescales the page while it slides in; a click aimed mid-motion keeps missing its option.
    await expect(page.locator('.ant-select-dropdown.ant-slide-up-appear, .ant-select-dropdown.ant-slide-up-enter')).toHaveCount(0);
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
    // After a confirmation the drawer moves on to the next match instead of closing, and the confirm modal may still be fading out.
    await expect(page.locator('.ant-modal-wrap:visible')).toHaveCount(0);
    await expect(async () => {
      if (await drawer.isVisible()) await drawer.getByRole('button', { name: 'Đóng', exact: true }).click({ timeout: 2_000 });
      await expect(drawer).not.toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  }
}
