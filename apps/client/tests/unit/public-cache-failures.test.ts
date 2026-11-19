import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  read: vi.fn(), write: vi.fn(), invalidate: vi.fn(), warn: vi.fn(), revalidateTag: vi.fn(), fetch: vi.fn(),
}));
vi.mock('../../src/lib/public-response-cache', () => ({
  sharedPublicCache: () => ({ read: dependencies.read, write: dependencies.write }),
  invalidatePublicResponses: dependencies.invalidate,
}));
vi.mock('../../src/lib/public-redis', () => ({ warnPublicRedis: dependencies.warn }));
vi.mock('next/cache', () => ({ revalidateTag: dependencies.revalidateTag }));
vi.mock('../../src/lib/internal-request', () => ({
  isInternalHost: (host: string | null) => host === 'internal.test',
  isRevalidateSecret: (secret: string | null) => secret === 'test-secret',
}));
vi.mock('../../src/lib/server-env', () => ({ serverEnv: {
  apiInternalUrl: () => 'http://api.internal/', ssrSecret: () => 'test-ssr-secret', apiTimeoutMs: () => 3210,
  publicRevalidateSeconds: () => 100, matchdayRevalidateSeconds: () => 10,
} }));
import { publicGet } from '../../src/lib/api-client';
import { POST } from '../../src/app/api/revalidate/route';

beforeEach(() => {
  for (const mock of Object.values(dependencies)) mock.mockReset();
  dependencies.read.mockResolvedValue({ generation: 'epoch' });
  dependencies.write.mockResolvedValue(undefined);
  dependencies.invalidate.mockResolvedValue(undefined);
  dependencies.fetch.mockResolvedValue(Response.json({ data: { name: 'Fresh event' } }));
  vi.stubGlobal('fetch', dependencies.fetch);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('reads upstream with no-store and a bounded timeout when Redis reads fail', async () => {
  dependencies.read.mockRejectedValue(new Error('Redis down'));
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  expect(await publicGet('/events/sample', { tags: ['event-sample'], policy: 'matchday' })).toEqual({ name: 'Fresh event' });
  expect(dependencies.fetch).toHaveBeenCalledWith('http://api.internal/api/v1/public/events/sample', expect.objectContaining({
    cache: 'no-store', headers: { 'x-internal-secret': 'test-ssr-secret', 'Accept-Encoding': 'gzip' }, signal: expect.any(AbortSignal),
  }));
  expect(timeout).toHaveBeenCalledWith(3210);
  expect(dependencies.warn).toHaveBeenCalledTimes(1);
  expect(dependencies.write).not.toHaveBeenCalled();
});

it('respects cached null after unpublishing without querying upstream', async () => {
  dependencies.read.mockResolvedValue({ generation: 'epoch', payload: 'null' });
  expect(await publicGet('/events/unpublished', { tags: ['event-unpublished'], policy: 'standard' })).toBeNull();
  expect(dependencies.fetch).not.toHaveBeenCalled();
  expect(dependencies.write).not.toHaveBeenCalled();
});

it('returns fresh API data when Redis cache writes fail', async () => {
  dependencies.write.mockRejectedValue(new Error('Redis noeviction or outage'));
  expect(await publicGet('/events/sample', { tags: ['event-sample'], policy: 'standard' })).toEqual({ name: 'Fresh event' });
  expect(dependencies.write).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ name: 'Fresh event' }), ['event-sample'], 100_000, 'epoch');
  expect(dependencies.warn).toHaveBeenCalledTimes(1);
});

it('does not cache upstream errors', async () => {
  dependencies.fetch.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(publicGet('/events/sample', { tags: ['event-sample'], policy: 'standard' })).rejects.toThrow(/answered 503/);
  expect(dependencies.write).not.toHaveBeenCalled();
});

const revalidation = () => new Request('http://internal.test/api/revalidate', {
  method: 'POST', headers: { host: 'internal.test', 'x-revalidate-secret': 'test-secret', 'content-type': 'application/json' },
  body: JSON.stringify({ tags: ['event-sample', 'event-sample'] }),
});

it('returns a retryable uncached 503 when shared invalidation fails', async () => {
  dependencies.invalidate.mockRejectedValue(new Error('Redis unavailable'));
  const response = await POST(revalidation());
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('1');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(dependencies.revalidateTag).not.toHaveBeenCalled();
});

it('acknowledges each unique tag only after shared invalidation succeeds', async () => {
  const response = await POST(revalidation());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ revalidated: 1 });
  expect(dependencies.invalidate).toHaveBeenCalledExactlyOnceWith(['event-sample']);
  expect(dependencies.revalidateTag).toHaveBeenCalledExactlyOnceWith('event-sample', { expire: 0 });
  expect(dependencies.invalidate.mock.invocationCallOrder[0]).toBeLessThan(dependencies.revalidateTag.mock.invocationCallOrder[0]!);
});
