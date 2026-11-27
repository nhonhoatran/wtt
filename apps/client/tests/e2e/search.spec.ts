import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures';

test('searches tournaments through a GET form and links to the full filtered list', async ({ page, world }) => {
  const response = await page.goto('/vi/search');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Tìm kiếm' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Tên giải đấu hoặc vận động viên' }).fill(world.world.tag);
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/vi/search\\?q=${world.world.tag}`));
  await expect(page.getByRole('link', { name: new RegExp(world.eventName) })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Xem tất cả .+ giải đấu$/ })).toHaveAttribute('href', `/vi/events?q=${world.world.tag}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${process.env.E2E_SITE_URL}/vi/search`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('player search respects public display names and hidden-profile scope', async ({ page, world }) => {
  await page.goto(`/en/search?q=${encodeURIComponent(world.ranking.playerName)}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Search', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: world.ranking.playerName, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^View all .+ players$/ })).toHaveAttribute('href', `/en/players?${new URLSearchParams({ q: world.ranking.playerName })}`);
  await expect(page.locator('main')).not.toContainText(world.ranking.hiddenName);
  await page.goto(`/en/search?q=${encodeURIComponent(world.ranking.privateName)}`);
  await expect(page.locator('main')).not.toContainText(world.ranking.privateName);
  await expect(page.getByText('No matching players found.')).toBeVisible();
});

test('header exposes search at desktop and in the mobile menu', async ({ page, isMobile }) => {
  await page.goto('/vi');
  const header = page.locator('header');
  if (isMobile) await header.locator('summary').click();
  const link = header.getByRole('link', { name: 'Tìm kiếm', exact: true }).filter({ visible: true });
  await expect(link).toHaveAttribute('href', '/vi/search');
  await link.click();
  await expect(page.getByRole('searchbox', { name: 'Tên giải đấu hoặc vận động viên' })).toBeVisible();
});
