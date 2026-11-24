import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { publicGet } = vi.hoisted(() => ({ publicGet: vi.fn() }));
vi.mock('../../src/lib/api-client', () => ({ publicGet }));
vi.mock('../../src/lib/server-env', () => ({ serverEnv: { matchdayRevalidateSeconds: () => 1 } }));
// The shared Redis limiter has its own integration test; keep this suite on the in-memory path even when REDIS_URL is set.
vi.mock('../../src/lib/public-redis', async (importOriginal) => ({ ...(await importOriginal<object>()), publicRedis: () => null }));

const config = { rateLimit: { windowSeconds: 5, maxRequests: 3, searchMaxRequests: 1, maxTrackedIps: 2 } };
const load = () => import('../../src/lib/public-rate-limit');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T00:00:00Z'));
  publicGet.mockReset().mockResolvedValue(config);
});
afterEach(() => { vi.useRealTimers(); });

describe('client address and canonical rate-limit keys', () => {
  it('uses edge real IP or the last forwarded address and validates malformed input', async () => {
    const { clientIp } = await load();
    expect(clientIp(new Headers({ 'x-real-ip': ' 192.0.2.1 ', 'x-forwarded-for': '192.0.2.2, 192.0.2.3' }))).toBe('192.0.2.1');
    expect(clientIp(new Headers({ 'x-forwarded-for': '192.0.2.2, 192.0.2.3' }))).toBe('192.0.2.3');
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('falls back from malformed edge IPs and warns once for an unknown address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { clientIp } = await load();
    expect(clientIp(new Headers({ 'x-real-ip': 'not-an-ip', 'x-forwarded-for': '192.0.2.9' }))).toBe('192.0.2.9');
    expect(clientIp(new Headers({ 'x-real-ip': 'malformed' }))).toBe('unknown');
    expect(clientIp(new Headers({ 'x-real-ip': 'still-malformed' }))).toBe('unknown');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('groups compressed, padded, uppercase and rotating IPv6 addresses in the same /64', async () => {
    const { rateLimitKey } = await load();
    const key = rateLimitKey('2001:db8:0:1::1');
    for (const ip of ['2001:0DB8:0000:0001:0:0:0:2', '2001:db8:0:1:ffff:abcd:4321:1234']) expect(rateLimitKey(ip)).toBe(key);
    expect(rateLimitKey('2001:db8:0:2::1')).not.toBe(key);
    expect(rateLimitKey('fe80::1%eth0')).toBe(rateLimitKey('fe80::2%1'));
  });

  it('normalizes IPv4-mapped IPv6 to its IPv4 visitor', async () => {
    const { rateLimitKey } = await load();
    expect(rateLimitKey('::ffff:192.0.2.1')).toBe(rateLimitKey('192.0.2.1'));
    expect(rateLimitKey('0:0:0:0:0:ffff:c000:201')).toBe(rateLimitKey('192.0.2.1'));
    expect(rateLimitKey('::ffff:192.0.2.2')).not.toBe(rateLimitKey('192.0.2.1'));
  });
});

it('limits ordinary pages, rounds Retry-After upwards and resets the window', async () => {
  const { rateLimitRetryAfter: hit } = await load();
  expect(await hit('192.0.2.1', false)).toBeNull();
  expect(await hit('192.0.2.1', false)).toBeNull();
  expect(await hit('192.0.2.1', false)).toBeNull();
  vi.advanceTimersByTime(1200);
  expect(await hit('192.0.2.1', false)).toBe(4);
  vi.advanceTimersByTime(3800);
  expect(await hit('192.0.2.1', false)).toBeNull();
});

it('applies a lower search bucket without blocking ordinary pages or another IP', async () => {
  const { rateLimitRetryAfter: hit } = await load();
  expect(await hit('192.0.2.1', true)).toBeNull();
  expect(await hit('192.0.2.1', true)).toBe(5);
  expect(await hit('192.0.2.1', false)).toBeNull();
  expect(await hit('192.0.2.2', true)).toBeNull();
  expect(await hit('192.0.2.2', true)).toBe(5);
});

it('bounds memory per visitor while preserving the admitted visitors limits', async () => {
  const { rateLimitRetryAfter: hit } = await load();
  await hit('192.0.2.1', true);
  await hit('192.0.2.2', false);
  expect(await hit('192.0.2.2', true)).toBeNull();
  for (let i = 0; i < 5; i++) expect(await hit('192.0.2.3', false)).toBeNull();
  expect(await hit('192.0.2.1', true)).toBe(5);
});

it('shares one cold configuration request between concurrent visitors', async () => {
  let resolve!: (value: typeof config) => void;
  publicGet.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { rateLimitRetryAfter: hit } = await load();
  const pending = [hit('192.0.2.1', false), hit('192.0.2.2', false)];
  expect(publicGet).toHaveBeenCalledTimes(1);
  resolve(config);
  expect(await Promise.all(pending)).toEqual([null, null]);
});

it('refreshes in the background once and keeps enforcing stale limits during API failure', async () => {
  const { rateLimitRetryAfter: hit } = await load();
  await hit('192.0.2.1', true);
  let reject!: (reason: Error) => void;
  publicGet.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  vi.advanceTimersByTime(1001);
  expect(await hit('192.0.2.1', true)).toBe(4);
  expect(await hit('192.0.2.2', false)).toBeNull();
  expect(publicGet).toHaveBeenCalledTimes(2);
  reject(new Error('API unavailable'));
  await Promise.resolve();
  await Promise.resolve();
  expect(await hit('192.0.2.1', true)).toBe(4);
});

it('fails open on cold API failure instead of blocking the site', async () => {
  publicGet.mockRejectedValue(new Error('API unavailable'));
  const { rateLimitRetryAfter: hit } = await load();
  for (let i = 0; i < 5; i++) expect(await hit('192.0.2.1', true)).toBeNull();
  expect(publicGet).toHaveBeenCalledTimes(1);
});
