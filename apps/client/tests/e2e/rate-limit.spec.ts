import { randomInt } from 'node:crypto';
import { API_GLOBAL_PREFIX, PUBLIC_API_SEGMENT, SSR_SECRET_HEADER, type PublicSiteConfig } from '@kamito/shared';
import { expect, test } from './support/fixtures';

// Exercise the real Next proxy and real /site configuration without changing shared database settings.
// Direct local requests intentionally set the edge headers; staging must separately verify Traefik replaces them.
test.describe('public HTTP rate limiting', () => {
  test.skip(({ viewport }) => viewport?.width !== 1280, 'HTTP behavior does not depend on viewport');

  test('enforces the search bucket, excludes prefetches, separates IPs and sends uncached retry headers', async ({ request }) => {
    const api = process.env.API_INTERNAL_URL!.replace(/\/+$/, '');
    const response = await request.get(`${api}/${API_GLOBAL_PREFIX}/${PUBLIC_API_SEGMENT}/site`, { headers: { [SSR_SECRET_HEADER]: process.env.SSR_INTERNAL_SECRET! } });
    expect(response.status()).toBe(200);
    const { rateLimit } = ((await response.json()) as { data: PublicSiteConfig }).data;
    test.skip(rateLimit.searchMaxRequests >= rateLimit.maxRequests || rateLimit.searchMaxRequests > 1000, 'Configured limits do not expose a bounded lower search bucket');
    const ip = `198.18.${randomInt(1, 255)}.${randomInt(1, 255)}`;
    const headers = { 'x-real-ip': ip };
    const path = '/vi/rate-limit-probe?q=rate-limit';
    const prefetchHeaders: Record<string, string>[] = [{ purpose: 'prefetch' }, { 'next-router-prefetch': '1' }];
    for (const prefetch of prefetchHeaders) {
      for (let i = 0; i < 3; i++) expect((await request.get(path, { headers: { ...headers, ...prefetch } })).status()).toBe(404);
    }
    for (let i = 0; i < rateLimit.searchMaxRequests; i++) expect((await request.get(path, { headers })).status()).toBe(404);
    const blocked = await request.get(path, { headers });
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
    expect(Number(blocked.headers()['retry-after'])).toBeLessThanOrEqual(rateLimit.windowSeconds);
    expect(blocked.headers()['cache-control']).toBe('no-store');
    expect(await blocked.text()).toBe('Too many requests');
    expect((await request.get('/vi/rate-limit-probe', { headers })).status()).toBe(404);
    expect((await request.get(path, { headers: { 'x-real-ip': `198.19.${randomInt(1, 255)}.${randomInt(1, 255)}` } })).status()).toBe(404);
    expect((await request.get(path, { headers: { ...headers, purpose: 'prefetch' } })).status()).toBe(404);
  });
});
