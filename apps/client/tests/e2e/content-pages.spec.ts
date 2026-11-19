import { test, expect } from './support/content-fixture';

test.describe('published CMS pages', () => {
  test('lists published news and renders bilingual sanitized article details', async ({ page, cms }) => {
    await page.goto(`/vi/news?page=${await cms.listingPage('article')}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tin tức');
    const publishedLink = page.locator(`main a[href="/vi/news/${cms.articleSlug}"]`);
    await expect(publishedLink).toBeVisible();
    await expect(page.locator(`main a[href="/vi/news/${cms.draftArticleSlug}"]`)).toHaveCount(0);
    await publishedLink.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(cms.title);
    await expect(page.getByRole('heading', { name: `Nội dung ${cms.tag}`, exact: true })).toBeVisible();
    await expect(page.locator('main script:not([type="application/ld+json"]), main iframe, main [onerror], main [onclick], main a[href^="javascript:"]')).toHaveCount(0);
    const structuredData = page.locator('main script[type="application/ld+json"]');
    await expect(structuredData).toHaveCount(1);
    expect(JSON.parse(await structuredData.innerText())).toMatchObject({ '@type': 'NewsArticle', headline: cms.title });
    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, 'cmsXss'))).toBe(false);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/vi/news/${cms.articleSlug}$`));
    await page.goto(`/en/news/${cms.articleSlug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(cms.titleEn);
    await expect(page.getByRole('heading', { name: `Content ${cms.tag}`, exact: true })).toBeVisible();
    const draft = await page.goto(`/vi/news/${cms.draftArticleSlug}`);
    expect(draft?.status()).toBe(404);
  });

  test('paginates news with real links and JavaScript disabled', async ({ browser, baseURL, cms }) => {
    await cms.addPagedArticles();
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto('/vi/news');
      const cards = page.locator('main article');
      await expect(cards).toHaveCount(await cms.pageSize());
      const firstHref = await cards.first().getByRole('link').getAttribute('href');
      const next = page.getByRole('navigation', { name: 'Phân trang' }).getByRole('link', { name: 'Trang sau', exact: true });
      await expect(next).toHaveAttribute('href', /page=2/);
      await next.click();
      await expect(page).toHaveURL(/page=2/);
      await expect(cards.first().getByRole('link')).not.toHaveAttribute('href', firstHref!);
      expect(await cards.count()).toBeLessThanOrEqual(await cms.pageSize());
    } finally {
      await context.close();
    }
  });

  test('renders published static pages in the footer, localizes them and hides drafts', async ({ page, request, cms }) => {
    await page.goto(`/vi/pages/${cms.pageSlug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(cms.pageTitle);
    await expect(page.getByText(`Nội dung trang ${cms.tag}`, { exact: true })).toBeVisible();
    await expect(page.locator('main [onerror], main img[src="x"]')).toHaveCount(0);
    await expect(page.locator(`footer a[href="/vi/pages/${cms.pageSlug}"]`)).toHaveText(cms.pageTitle);
    await expect(page.locator(`footer a[href="/vi/pages/${cms.draftPageSlug}"]`)).toHaveCount(0);
    await page.goto(`/en/pages/${cms.pageSlug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(cms.pageTitleEn);
    await expect(page.getByText(`English page ${cms.tag}`, { exact: true })).toBeVisible();
    await expect(page.locator(`footer a[href="/en/pages/${cms.pageSlug}"]`)).toHaveText(cms.pageTitleEn);
    expect((await page.goto(`/vi/pages/${cms.draftPageSlug}`))?.status()).toBe(404);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(`/news/${cms.articleSlug}`);
    expect(sitemap).toContain(`/pages/${cms.pageSlug}`);
    expect(sitemap).not.toContain(`/news/${cms.draftArticleSlug}`);
    expect(sitemap).not.toContain(`/pages/${cms.draftPageSlug}`);
  });

  test('lists videos and loads a sandboxed iframe only after an explicit play click', async ({ page, cms }) => {
    // The provider document is outside this application; keep this test independent of YouTube uptime.
    await page.route('https://www.youtube-nocookie.com/embed/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Provider fixture</title>' }));
    await page.goto(`/vi/videos?page=${await cms.listingPage('video')}`);
    await expect(page.locator(`main a[href="/vi/videos/${cms.videoSlug}"]`)).toBeVisible();
    await expect(page.locator(`main a[href="/vi/videos/${cms.draftVideoSlug}"]`)).toHaveCount(0);
    await expect(page.locator('main iframe')).toHaveCount(0);
    await page.locator(`main a[href="/vi/videos/${cms.videoSlug}"]`).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(cms.videoTitle);
    await expect(page.locator('main iframe')).toHaveCount(0);
    await page.getByRole('button', { name: `Phát video: ${cms.videoTitle}`, exact: true }).click();
    const iframe = page.locator('main iframe');
    await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1$/);
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect((await page.goto(`/vi/videos/${cms.draftVideoSlug}`))?.status()).toBe(404);
  });

  test('keeps CMS pages within desktop and mobile viewports', async ({ page, cms }, testInfo) => {
    await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 390 : 1440, height: 900 });
    for (const path of ['/vi/news', `/vi/news/${cms.articleSlug}`, '/vi/videos', `/vi/pages/${cms.pageSlug}`, '/vi/contact']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });
});
