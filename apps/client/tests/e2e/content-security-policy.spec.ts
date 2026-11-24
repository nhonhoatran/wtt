import type { Page } from '@playwright/test';
import { test, expect } from './support/content-fixture';

type Violation = { directive: string; blocked: string; disposition: string };
type CspWindow = Window & { __cspViolations?: Violation[]; __cspPositive?: number; __cspNegative?: number; __cspDocumentMarker?: string };

async function observe(page: Page) {
  await page.addInitScript(() => {
    (window as CspWindow).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as CspWindow).__cspViolations!.push({ directive: event.effectiveDirective, blocked: event.blockedURI, disposition: event.disposition });
    });
  });
}
const violations = (page: Page) => page.evaluate(() => (window as CspWindow).__cspViolations ?? []);

test.describe('enforced public CSP', () => {
  test.skip(process.env.CSP_MODE !== 'enforce', 'Run with CSP_MODE=enforce against the production test stack');
  test.use({ bypassCSP: false });

  test('uses fresh trusted nonces on real documents with self-hosted fonts and JSON-LD', async ({ page, world }, testInfo) => {
    await observe(page);
    const seen = new Set<string>();
    const checks: object[] = [];
    for (const path of ['/vi', `/vi/events/${world.world.slug}`, `/en/events/${world.world.slug}/draws/MS`, `/vi/rankings/${world.ranking.code}`, '/vi/contact', '/vi']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const headers = response!.headers();
      const policy = headers['content-security-policy'] ?? '';
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
      expect(nonce).toBeTruthy();
      expect(seen.has(nonce!)).toBe(false);
      seen.add(nonce!);
      expect(headers['content-security-policy-report-only']).toBeUndefined();
      expect(headers['cache-control']).toContain('private');
      expect(headers['cache-control']).toContain('no-store');
      const scriptPolicy = policy.split(';').find((part) => part.trim().startsWith('script-src '));
      expect(scriptPolicy).not.toMatch(/unsafe-inline|unsafe-eval/);
      await page.evaluate(() => document.fonts.ready);
      const scripts = [...(await response!.text()).matchAll(/<script\b([^>]*)>/g)].map((match) => /\bnonce="([^"]+)"/.exec(match[1]!)?.[1]);
      expect(scripts.length).toBeGreaterThan(0);
      expect(scripts.every((value) => value === nonce)).toBe(true);
      const inline = await page.locator('script:not([src])').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).nonce));
      expect(inline.every((value) => value === nonce)).toBe(true);
      expect(await violations(page)).toEqual([]);
      checks.push({ path, scripts: scripts.length, nonceMatchesAllScripts: true, privateNoStore: true, violations: [] });
    }
    expect(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('.woff2')))).toBe(true);
    await testInfo.attach('csp-documents.json', { body: JSON.stringify({ distinctNonces: seen.size, checks }), contentType: 'application/json' });
  });

  test('blocks missing and incorrect nonce scripts while a trusted control can execute', async ({ page }, testInfo) => {
    await observe(page);
    // Inject a controlled parser attack into real HTML while retaining the server's actual policy/status.
    await page.route('**/vi', async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      const nonce = /'nonce-([^']+)'/.exec(response.headers()['content-security-policy'] ?? '')?.[1];
      expect(nonce).toBeTruthy();
      const payload = `<script>window.__cspNegative=1</script><script nonce="incorrect-nonce">window.__cspNegative=2</script><script nonce="${nonce}">window.__cspPositive=1</script>`;
      await route.fulfill({ response, body: (await response.text()).replace('<head>', `<head>${payload}`) });
    });
    await page.goto('/vi');
    await expect.poll(async () => (await violations(page)).filter((item) => item.directive.startsWith('script-src')).length).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => (window as CspWindow).__cspNegative)).toBeUndefined();
    expect(await page.evaluate(() => (window as CspWindow).__cspPositive)).toBe(1);
    const blocked = await violations(page);
    expect(blocked.every((item) => item.disposition === 'enforce' && item.blocked === 'inline')).toBe(true);
    await testInfo.attach('csp-negative-controls.json', { body: JSON.stringify(blocked), contentType: 'application/json' });
  });

  test('keeps hydration and video interaction working through client navigation and history', async ({ page, cms }, testInfo) => {
    await observe(page);
    const rscNonces: string[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === `/en/videos/${cms.videoSlug}` && response.headers()['content-type']?.includes('text/x-component')) {
        const nonce = /'nonce-([^']+)'/.exec(response.headers()['content-security-policy'] ?? '')?.[1];
        if (nonce) rscNonces.push(nonce);
      }
    });
    // Only the external provider document is stubbed; application/API responses retain their CSP.
    await page.route('https://www.youtube-nocookie.com/embed/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Provider fixture</title>' }));
    const documentResponse = await page.goto(`/vi/videos/${cms.videoSlug}`);
    const documentNonce = /'nonce-([^']+)'/.exec(documentResponse!.headers()['content-security-policy'] ?? '')?.[1];
    await page.evaluate(() => { (window as CspWindow).__cspDocumentMarker = 'same-document'; });
    await page.getByRole('button', { name: `Phát video: ${cms.videoTitle}`, exact: true }).click();
    await expect(page.locator('main iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    await page.locator('a[hreflang="en"]').click();
    await expect(page).toHaveURL(`/en/videos/${cms.videoSlug}`);
    expect(await page.evaluate(() => (window as CspWindow).__cspDocumentMarker)).toBe('same-document');
    expect(rscNonces.length).toBeGreaterThan(0);
    expect(rscNonces.every((nonce) => nonce !== documentNonce)).toBe(true);
    await page.getByRole('button', { name: `Play video: ${cms.videoTitle}`, exact: true }).click();
    await expect(page.locator('main iframe')).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(`/vi/videos/${cms.videoSlug}`);
    await page.goForward();
    await expect(page).toHaveURL(`/en/videos/${cms.videoSlug}`);
    expect(await violations(page)).toEqual([]);
    await testInfo.attach('csp-navigation.json', { body: JSON.stringify({ hydratedVideo: true, localeNavigation: true, sameDocument: true, distinctRscNonce: true, backForward: true, violations: [] }), contentType: 'application/json' });
  });
});
