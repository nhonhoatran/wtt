import { expect, test } from './support/content-fixture';
import { withSiteNavItems } from './support/content-settings';
import { readFileSync } from 'node:fs';
import type { E2eWorldFile } from './support/world-file';

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
  test('core pages provide localized descriptions in standard and social metadata', async ({ page, world }) => {
    for (const locale of ['vi', 'en'] as const) {
      const dictionary = JSON.parse(readFileSync(new URL(`../../src/i18n/${locale}.json`, import.meta.url), 'utf8'));
      const routes = [`/${locale}`, `/${locale}/events/${world.world.slug}`, `/${locale}/events/${world.world.slug}/draws/MS`, `/${locale}/rankings/${world.ranking.code}`, `/${locale}/events/${world.world.slug}/matches/${world.playedMatchNo}`];
      for (const [index, route] of routes.entries()) {
        await page.goto(route);
        const metadata = await page.evaluate(() => Object.fromEntries(([
          ['description', 'meta[name="description"]'], ['openGraph', 'meta[property="og:description"]'], ['twitter', 'meta[name="twitter:description"]'],
        ] as const).map(([key, selector]) => [key, document.head.querySelector(selector)?.getAttribute('content') ?? null])));
        expect.soft(metadata.description, route).toEqual(expect.stringMatching(/\S/));
        expect.soft(metadata.openGraph, route).toBe(metadata.description);
        expect.soft(metadata.twitter, route).toBe(metadata.description);
        if (index === 0) expect.soft(metadata.description, route).toBe(dictionary.home.metaDescription);
        if (index === 1 || index === 2) expect.soft(metadata.description, route).toContain(await page.locator('h1').textContent());
        if (index === 3) expect.soft(metadata.description, route).toBe(dictionary.rankings.metaDescription);
      }
    }
  });

  test('calendar normalizes invalid and repeated years while preserving canonical years', async ({ page }) => {
    const current = new Date().getFullYear();
    for (const query of ['', '?year=invalid', '?year=2025&year=2024', '?_rsc=nonce-regression']) {
      await page.goto(`/vi/events/calendar${query}`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${process.env.E2E_SITE_URL}/vi/events/calendar`);
    }
    const other = current + 1;
    await page.goto(`/vi/events/calendar?year=${other}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${process.env.E2E_SITE_URL}/vi/events/calendar?year=${other}`);
  });

  test('navigation follows the configured items and distinguishes page from section location', async ({ page, world, cms }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop navigation semantics');
    const nav = page.getByRole('navigation', { name: 'Menu chính' });
      await withSiteNavItems(cms, [{ key: 'events' }, { key: 'calendar' }, { key: 'rankings', labelVi: 'BXH' }], async () => {
      await page.goto('/vi/events');
      await expect(nav.getByRole('link', { name: 'Giải đấu', exact: true })).toHaveAttribute('aria-current', 'page');
      await page.goto('/vi/events/calendar');
      await expect(nav.getByRole('link', { name: 'Lịch thi đấu', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(nav.getByRole('link', { name: 'Giải đấu', exact: true })).not.toHaveAttribute('aria-current');
      await page.goto(root(world.world.slug));
      await expect(nav.getByRole('link', { name: 'Giải đấu', exact: true })).toHaveAttribute('aria-current', 'location');
      await expect(nav.getByRole('link', { name: 'BXH', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Liên hệ' })).toHaveCount(0);
    });
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

  test('canonical drops the ranking and round view parameters', async ({ page, world }) => {
    const site = process.env.E2E_SITE_URL;
    const draws = `${root(world.world.slug)}/draws/MS`;
    for (const [visit, canonical] of [
      [`${draws}?round=2`, draws],
      [`${draws}?round=2&ranking=${world.ranking.code}`, draws],
      [`/vi?ranking=${world.ranking.code}`, '/vi'],
    ] as const) {
      await page.goto(visit);
      const href = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(href, visit).toBe(`${site}${canonical}`);
    }
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
    const policyHeader = process.env.CSP_MODE === 'enforce' ? 'content-security-policy' : 'content-security-policy-report-only';
    expect(page.headers()[policyHeader]).toContain("default-src 'self'");
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
    ['events list', (w: E2eWorldFile) => `/vi/events?q=${w.world.tag}`],
    ['event overview', (w: E2eWorldFile) => root(w.world.slug)],
    ['matches tab', (w: E2eWorldFile) => `${root(w.world.slug)}/matches`],
    ['draws page', (w: E2eWorldFile) => `${root(w.world.slug)}/draws/MS`],
    ['draws page, chosen round', (w: E2eWorldFile) => `${root(w.world.slug)}/draws/MS?round=2`],
    ['groups tab', (w: E2eWorldFile) => `${root(w.world.slug)}/groups/MD`],
    ['match page', (w: E2eWorldFile) => `${root(w.world.slug)}/matches/${w.playedMatchNo}`],
    ['rankings index', () => '/vi/rankings'],
    ['ranking list', (w: E2eWorldFile) => `/vi/rankings/${w.ranking.code}`],
    ['player profile', (w: E2eWorldFile) => `/vi/players/${w.ranking.playerSlug}`],
  ] as const) {
    test(`${name} does not scroll sideways at 390px`, async ({ page, world }) => {
      await page.goto(pathOf(world));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(390);
    });
  }
});

test.describe('print', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop project only');

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
