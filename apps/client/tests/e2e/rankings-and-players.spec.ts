import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizePersonName } from '@kamito/shared';
import { expect, test } from './support/fixtures';
import { runApiSeed } from './support/api-world-runner';

test.describe('published rankings and player profiles', () => {
  test('finds public names without accents and shows the frozen published breakdown', async ({ page, world }) => {
    const r = world.ranking;
    await page.goto(`/vi/rankings/${r.code}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.name);
    await page.getByRole('searchbox', { name: 'Tìm theo tên VĐV' }).fill(normalizePersonName(r.playerName));
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    const row = page.getByRole('row', { name: new RegExp(r.playerName) });
    await expect(row).toBeVisible();
    await expect(page.getByRole('heading', { name: '1 kết quả', exact: true })).toBeVisible();
    await expect(row.getByRole('link', { name: r.playerName, exact: true })).toHaveAttribute('href', `/vi/players/${r.playerSlug}`);
    await row.locator('summary').click();
    await expect(row.locator('details')).toHaveAttribute('open', '');
    await expect(row.getByRole('link', { name: r.eventName, exact: true })).toBeVisible();
    await expect(row.locator('details').getByRole('cell', { name: r.currentPoints.toLocaleString('vi'), exact: true })).toBeVisible();
    await expect(row).not.toContainText('9.900');
    await expect(page.locator('main')).not.toContainText(r.hiddenName);
    await expect(page.locator(`a[href*="/players/${r.legacyPlayerSlug}"]`)).toHaveCount(0);
  });

  test('paginates rankings on the server and keeps search and club filters in links', async ({ page, world }) => {
    const r = world.ranking;
    await page.goto(`/vi/rankings/${r.code}?q=${encodeURIComponent('Tay vợt')}`);
    const pages = page.getByRole('navigation', { name: 'Phân trang' });
    await expect(pages).toBeVisible();
    const before = await page.getByRole('table', { name: r.name, exact: true }).locator('tbody > tr').first().innerText();
    const next = pages.getByRole('link', { name: 'Trang sau', exact: true });
    const href = await next.getAttribute('href');
    expect(href).toContain('page=2');
    expect(href).toContain('q=');
    await next.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole('table', { name: r.name, exact: true }).locator('tbody > tr').first()).not.toHaveText(before);
    await page.goto(`/vi/rankings/${r.code}`);
    await page.getByRole('combobox', { name: 'CLB', exact: true }).selectOption(r.club);
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    await expect(page.getByRole('heading', { name: '2 kết quả', exact: true })).toBeVisible();
  });

  test('native point disclosures and GET search work with JavaScript disabled', async ({ browser, baseURL, world }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      const r = world.ranking;
      await page.goto(`/vi/rankings/${r.code}`);
      await page.getByRole('searchbox', { name: 'Tìm theo tên VĐV' }).fill(normalizePersonName(r.playerName));
      await page.getByRole('button', { name: 'Lọc', exact: true }).click();
      const details = page.locator('details').filter({ hasText: r.eventName });
      await expect(details).toHaveCount(1);
      await details.locator('summary').click();
      await expect(details).toHaveAttribute('open', '');
      await expect(details.getByRole('link', { name: r.eventName, exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('players list filters public aliases and exposes singles and doubles ranks', async ({ page, world }) => {
    const r = world.ranking;
    await page.goto(`/vi/players?q=${encodeURIComponent(normalizePersonName(r.playerName))}&gender=MALE&club=${encodeURIComponent(r.club)}&sort=rank`);
    const row = page.getByRole('row', { name: new RegExp(r.playerName) });
    await expect(row).toBeVisible();
    await expect(row.getByRole('link', { name: new RegExp(r.name) })).toBeVisible();
    await expect(row.getByRole('link', { name: new RegExp(r.doublesName) })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1 vận động viên', exact: true })).toBeVisible();
    await row.getByRole('link', { name: r.playerName, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.playerName);
    await expect(page.locator('main')).not.toContainText(r.hiddenName);
    const ranks = page.getByRole('region', { name: 'Thứ hạng hiện tại' });
    await expect(ranks.getByRole('link', { name: r.name, exact: true })).toBeVisible();
    await expect(ranks.getByRole('link', { name: r.doublesName, exact: true })).toBeVisible();
    const results = page.getByRole('region', { name: 'Kết quả thi đấu' });
    await expect(results.locator(`a[href$="/matches/${r.playedMatchNo}"]`)).toBeVisible();
    await expect(results.locator(`a[href$="/matches/${r.byeMatchNo}"]`)).toHaveCount(0);
    await expect(page.locator('main').getByText('Tuổi', { exact: true })).toHaveCount(0);
  });

  test('private profiles answer 404 and their ranking labels have no profile link', async ({ page, world }) => {
    const r = world.ranking;
    await page.goto(`/vi/rankings/${r.code}`);
    const row = page.getByRole('row', { name: new RegExp(r.privateName) });
    await expect(row).toBeVisible();
    await expect(row.locator(`a[href*="/players/${r.privateSlug}"]`)).toHaveCount(0);
    const response = await page.goto(`/vi/players/${r.privateSlug}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  });

  test('merged profile slugs return HTTP 301 to the public target', async ({ page, request, world }) => {
    const r = world.ranking;
    const response = await request.get(`/vi/players/${r.mergedSlug}?page=2`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    const target = new URL(response.headers().location!, response.url());
    expect(target.pathname).toBe(`/vi/players/${r.playerSlug}`);
    expect(target.search).toBe('?page=2');
    await page.goto(`/vi/players/${r.mergedSlug}`);
    await expect(page).toHaveURL(new RegExp(`/players/${r.playerSlug}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.playerName);
  });

  test('legacy name slugs redirect to opaque profile URLs without exposing them in public links', async ({ page, request, world }) => {
    const r = world.ranking;
    const legacy = await request.get(`/vi/players/${r.legacyPlayerSlug}`, { maxRedirects: 0 });
    expect(legacy.status()).toBe(301);
    expect(new URL(legacy.headers().location!, legacy.url()).pathname).toBe(`/vi/players/${r.playerSlug}`);
    for (const url of [`/vi/players/${r.playerSlug}`, `/vi/events/${r.eventSlug}/matches/${r.playedMatchNo}`]) {
      await page.goto(url);
      await expect(page.locator(`a[href*="/players/${r.legacyPlayerSlug}"]`)).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText(r.hiddenName);
    }
    await page.goto(`/vi/players/${r.playerSlug}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/players/${r.playerSlug}$`));
  });

  test('profile metadata protects noindex players and sitemap excludes profile URLs', async ({ page, request, world }) => {
    const r = world.ranking;
    await page.goto(`/vi/players/${r.playerSlug}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const types = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(types.some((value) => /"@type"\s*:\s*"Person"/.test(value))).toBe(false);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(`/rankings/${r.code}`);
    expect(sitemap).not.toMatch(/\/(?:vi|en)\/players\//);
    await page.goto(`/en/players/${r.playerSlug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.playerName);
    await expect(page.getByRole('heading', { name: 'Current rankings' })).toBeVisible();
  });

  test('profiles without results or rankings show stable empty states', async ({ page, world }) => {
    await page.goto(`/vi/players/${world.ranking.emptySlug}`);
    await expect(page.getByText('Chưa có kết quả thi đấu được công bố.', { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa có thứ hạng được công bố.', { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa có giải đã tham dự được công bố.', { exact: true })).toBeVisible();
  });

  test('event info uses rules effective at its end date and shows linked profile names', async ({ page, world }) => {
    const r = world.ranking;
    await page.goto(`/vi/events/${r.eventSlug}/info`);
    await expect(page.getByRole('heading', { name: 'Điểm xếp hạng theo vòng', exact: true })).toBeVisible();
    const tables = page.getByRole('table');
    const winner = tables.getByRole('row', { name: /Vô địch/ });
    await expect(winner).toContainText('750');
    const finalist = tables.getByRole('row', { name: /Chung kết/ });
    await expect(finalist).toContainText('400');
    await expect(tables).not.toContainText('9.999');
    await page.goto(`/vi/events/${r.eventSlug}/matches/${r.playedMatchNo}`);
    await expect(page.getByRole('link', { name: r.playerName, exact: true })).toBeVisible();
  });

  test('desktop and mobile pages keep tables inside the page with visual evidence', async ({ page, world }, testInfo) => {
    const width = testInfo.project.name === 'mobile' ? 390 : 1440;
    await page.setViewportSize({ width, height: 900 });
    const r = world.ranking;
    const shots = process.env.E2E_SCREENSHOT_DIR ?? testInfo.outputPath('screenshots');
    await mkdir(shots, { recursive: true });
    for (const [name, url] of [
      ['rankings-overview', '/vi/rankings'],
      ['rankings-list', `/vi/rankings/${r.code}`],
      ['players-list', `/vi/players?q=${encodeURIComponent(r.playerName)}`],
      ['player-profile', `/vi/players/${r.playerSlug}`],
    ]) {
      await page.goto(url!);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(shots, `${name}-${width}.png`), fullPage: true });
    }
  });

  test('publication refreshes a warmed public ranking within ten seconds through the worker', () => {
    runApiSeed('ranking-publish.seed.ts');
  });
});
