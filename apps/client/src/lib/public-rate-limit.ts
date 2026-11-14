import type { PublicSiteConfig } from '@kamito/shared';
import { publicGet } from './api-client';
import { serverEnv } from './server-env';

type Limits = PublicSiteConfig['rateLimit'];

/** Fixed window per IP, in this instance's memory (enough for one client replica; see phase 08 risks). */
const hits = new Map<string, { count: number; resetAt: number }>();
let sweepAt = 0;
let limits: { value: Limits | null; expiresAt: number } = { value: null, expiresAt: 0 };
let refreshing: Promise<void> | null = null;

function refreshLimits(now: number): Promise<void> {
  refreshing ??= publicGet<PublicSiteConfig>('/site', { tags: [], policy: 'none' })
    .catch(() => null)
    .then((config) => {
      limits = { value: config?.rateLimit ?? limits.value, expiresAt: now + serverEnv.matchdayRevalidateSeconds() * 1000 };
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * The proxy has no fetch cache: the /settings values are kept for one matchday TTL and refreshed by a single
 * call in the background, so no visitor waits on the API once a value is known. Fails open while none is.
 */
async function currentLimits(now: number): Promise<Limits | null> {
  if (now >= limits.expiresAt) {
    const pending = refreshLimits(now);
    if (!limits.value) await pending;
  }
  return limits.value;
}

/**
 * The client address as the edge proxy saw it. Traefik (default forwardedHeaders) replaces X-Real-Ip and appends
 * to X-Forwarded-For, so the last entry is the one a visitor cannot forge. Verify on staging when a CDN sits in front.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for')?.split(',').map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? 'unknown';
}

/** One subscriber gets a whole IPv6 /64, so it counts as one visitor rather than 2^64 of them. */
export function rateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head = '', tail] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).join(':')}::/64`;
}

function sweep(now: number) {
  if (now < sweepAt) return;
  for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  sweepAt = now + 60_000;
}

/** Seconds to wait when over the limit, else null. Search pages (uncached) count against a lower limit too. */
export async function rateLimitRetryAfter(ip: string, searching: boolean): Promise<number | null> {
  const now = Date.now();
  const config = await currentLimits(now);
  if (!config) return null;
  sweep(now);
  const key = rateLimitKey(ip);
  const buckets: [string, number][] = [[`page:${key}`, config.maxRequests]];
  if (searching) buckets.push([`search:${key}`, config.searchMaxRequests]);
  let retryAfter: number | null = null;
  for (const [bucket, max] of buckets) {
    let entry = hits.get(bucket);
    if (!entry || entry.resetAt <= now) {
      // Memory bound from /settings: past it, new addresses go unlimited until the window clears (fail open).
      if (!entry && hits.size >= config.maxTrackedIps) continue;
      entry = { count: 0, resetAt: now + config.windowSeconds * 1000 };
      hits.set(bucket, entry);
    }
    entry.count += 1;
    if (entry.count > max) retryAfter = Math.max(retryAfter ?? 0, Math.ceil((entry.resetAt - now) / 1000));
  }
  return retryAfter;
}
