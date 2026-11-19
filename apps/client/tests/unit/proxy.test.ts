import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { beforeEach, expect, it, vi } from 'vitest';

const { hit, contactHit, site } = vi.hoisted(() => ({ hit: vi.fn(), contactHit: vi.fn(), site: vi.fn() }));
vi.mock('../../src/lib/public-rate-limit', () => ({ clientIp: () => '192.0.2.1', rateLimitRetryAfter: hit }));
vi.mock('../../src/lib/public-contact-rate-limit', () => ({ contactRateLimitRetryAfter: contactHit }));
vi.mock('../../src/lib/public-data', () => ({ getSiteConfig: site, getPlayerProfile: vi.fn(), isUrlPart: () => true }));
vi.mock('../../src/lib/internal-request', () => ({ isInternalHost: (host: string | null) => host === 'internal.test' }));
import { config, proxy } from '../../src/proxy';

beforeEach(() => {
  hit.mockReset().mockResolvedValue(null);
  contactHit.mockReset().mockResolvedValue(null);
  site.mockReset().mockResolvedValue({ contactRateLimit: { windowSeconds: 60, maxRequests: 3 } });
});

it('negotiates a locale without charging the redirect, then charges only the destination page', async () => {
  const redirect = await proxy(new NextRequest('http://site.test/?q=ping', { headers: { 'accept-language': 'en' } }));
  expect(redirect.status).toBe(307);
  expect(redirect.headers.get('location')).toBe('http://site.test/en?q=ping');
  expect(hit).not.toHaveBeenCalled();
  await proxy(new NextRequest('http://site.test/en?q=ping'));
  expect(hit).toHaveBeenCalledExactlyOnceWith('192.0.2.1', true);
});

it('returns an uncached 429 with the limiter retry delay', async () => {
  hit.mockResolvedValue(7);
  const response = await proxy(new NextRequest('http://site.test/vi?q=  '));
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('7');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(hit).toHaveBeenCalledWith('192.0.2.1', false);
});

it('keeps internal revalidation behind the host wall and outside the page budget', async () => {
  expect((await proxy(new NextRequest('http://site.test/api/revalidate', { headers: { host: 'site.test' } }))).status).toBe(404);
  expect((await proxy(new NextRequest('http://internal.test/api/revalidate', { headers: { host: 'internal.test' } }))).status).toBe(200);
  expect(hit).not.toHaveBeenCalled();
});

it('blocks a contact POST at the edge with an HTTP 429 and the contact budget', async () => {
  contactHit.mockResolvedValue(9);
  const response = await proxy(new NextRequest('http://site.test/vi/contact', { method: 'POST' }));
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('9');
  expect(contactHit).toHaveBeenCalledWith('192.0.2.1', { windowSeconds: 60, maxRequests: 3 });
  expect(hit).not.toHaveBeenCalled();
});

it('matches contact posts even when callers spoof prefetch headers', () => {
  for (const locale of ['vi', 'en']) {
    for (const headers of [{ purpose: 'prefetch' }, { 'next-router-prefetch': '1' }]) {
      expect(unstable_doesMiddlewareMatch({ config, url: `http://site.test/${locale}/contact`, headers })).toBe(true);
    }
  }
});
