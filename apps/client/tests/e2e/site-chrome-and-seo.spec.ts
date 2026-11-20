import { expect, test } from './support/fixtures';

const root = (slug: string) => `/vi/events/${slug}`;

test.describe('locale', () => {
  test('missing English event retains the English error and home destination', async ({ page }) => {
    const response = await page.goto('/en/events/nonexistent-e2e-event');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/en');
  });
  test('/ redirects to the negotiated locale and sets html lang', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/vi$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  });

  test('switching to EN keeps the query string', async ({ page, world }) => {
    await page.goto(`/vi/events?q=${world.world.tag}&year=2099`);
    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(new RegExp(`/en/events\\?q=${world.world.tag}&year=2099$`));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });
    test('/ redirects to /en', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/en$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });
});

test.describe('SEO', () => {
  test('calendar normalizes invalid and repeated years while preserving canonical years', async ({ page }) => {
    const current = new Date().getFullYear();
    for (const query of ['', '?year=invalid', '?year=2025&year=2024']) {
      await page.goto(`/vi/events/calendar${query}`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${process.env.E2E_SITE_URL}/vi/events/calendar`);
    }
    const other = current + 1;
    await page.goto(`/vi/events/calendar?year=${other}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${process.env.E2E_SITE_URL}/vi/events/calendar?year=${other}`);
  });

  test('navigation distinguishes the exact page and event section location', async ({ page, world, viewport }) => {
    test.skip(viewport?.width !== 1280, 'Desktop navigation semantics');
    const nav = page.getByRole('navigation', { name: 'Menu chính' });
    await page.goto('/vi/events');
    await expect(nav.getByRole('link', { name: 'Giải đấu', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.goto('/vi/events/calendar');
    await expect(nav.getByRole('link', { name: 'Lịch thi đấu', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Giải đấu', exact: true })).not.toHaveAttribute('aria-current');
    await page.goto(root(world.world.slug));
    await expect(nav.getByRole('link', { name: 'Giải đấu', exact: true })).toHaveAttribute('aria-current', 'location');
  });
  test('overview carries canonical and hreflang alternates', async ({ page, world }) => {
    const site = process.env.E2E_SITE_URL;
    const path = root(world.world.slug);
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${site}${path}`);
    for (const [lang, prefix] of [['vi', 'vi'], ['en', 'en'], ['x-default', 'vi']]) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveAttribute('href', `${site}/${prefix}/events/${world.world.slug}`);
    }
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const sportsEvent = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(sportsEvent['@type']).toBe('SportsEvent');
    expect(sportsEvent.url).toBe(`${site}${path}`);
  });

  test('sitemap lists the event and robots points at the sitemap', async ({ request, world }) => {
    const site = process.env.E2E_SITE_URL;
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain(`<loc>${site}${root(world.world.slug)}</loc>`);
    expect(xml).toContain(`<loc>${site}/en/events/${world.world.slug}</loc>`);
    expect(xml).toContain(`<loc>${site}${root(world.world.slug)}/draws/MS</loc>`);
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain(`Sitemap: ${site}/sitemap.xml`);
  });
});

test.describe('security headers', () => {
  test('sends security headers and accepts a CSP violation report', async ({ request }) => {
    const page = await request.get('/vi');
    expect(page.headers()['content-security-policy-report-only']).toContain("default-src 'self'");
    expect(page.headers()['strict-transport-security']).toContain('max-age=31536000');
    expect(page.headers()['x-content-type-options']).toBe('nosniff');
    expect(page.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(page.headers()['x-frame-options']).toBe('DENY');
    const report = await request.post('/api/csp-report', {
      headers: { 'content-type': 'application/csp-report' },
      data: JSON.stringify({ 'csp-report': { 'document-uri': 'http://localhost/vi', 'violated-directive': 'img-src', 'blocked-uri': 'https://example.test/x.png' } }),
    });
    expect(report.status()).toBe(204);
    const malformed = await request.post('/api/csp-report', { data: [null, { body: null }, { body: 'bad' }, { body: { effectiveDirective: 'img-src' } }] });
    expect(malformed.status()).toBe(204);
  });
});

test.describe('mobile layout', () => {
  test.skip(({ viewport }) => viewport?.width !== 390, 'mobile project only');

  for (const [name, pathOf] of [
    ['events list', (slug: string) => `/vi/events?q=${slug}`],
    ['event overview', (slug: string) => root(slug)],
    ['draws page', (slug: string) => `${root(slug)}/draws/MS`],
  ] as const) {
    test(`${name} does not scroll sideways at 390px`, async ({ page, world }) => {
      await page.goto(pathOf(name === 'events list' ? world.world.tag : world.world.slug));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(390);
    });
  }
});

test.describe('print', () => {
  test.skip(({ viewport }) => viewport?.width !== 1280, 'desktop project only');

  test('draws page prints the bracket without site chrome', async ({ page, world }, testInfo) => {
    await page.goto(`${root(world.world.slug)}/draws/MS`);
    await expect(page.getByRole('heading', { name: 'Chung kết' })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('footer')).toBeHidden();
    await expect(page.locator('nav').first()).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Chung kết' })).toBeVisible();
    await expect(page.getByText(/^Trận #\d+$/).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('draws-ms-print.png'), fullPage: true });
  });
});
