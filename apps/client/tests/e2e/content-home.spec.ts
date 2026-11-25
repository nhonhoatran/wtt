import { test, expect } from './support/content-fixture';
import { withHomeSections } from './support/content-settings';

test.describe('CMS home configuration', () => {
  // home.sections is global: one project owns this probe, with a version-checked restore in finally.
  test.describe.configure({ mode: 'serial' });
  test.skip(({ isMobile }) => isMobile, 'Global home configuration is exercised once per run');

  test('turns news and video sections on and off without removing their public pages', async ({ page, cms }) => {
    const off = { hero: false, events: false, news: false, videos: false, rankings: false, sponsors: false };
    await withHomeSections(cms, { ...off, news: true, videos: true }, async () => {
      await page.goto('/vi');
      await expect(page.getByRole('heading', { name: 'Tin nổi bật', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Video mới', exact: true })).toBeVisible();
    });
    expect((await page.goto('/vi?ranking=bad'))?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute('href', /\?/);
    await withHomeSections(cms, off, async () => {
      await page.goto('/vi');
      await expect(page.locator('main #home-news, main #home-videos')).toHaveCount(0);
      expect((await page.goto(`/vi/news/${cms.articleSlug}`))?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(cms.title);
      expect((await page.goto(`/vi/videos/${cms.videoSlug}`))?.status()).toBe(200);
    });
  });
});
