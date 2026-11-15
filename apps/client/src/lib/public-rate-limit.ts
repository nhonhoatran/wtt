import { isIP } from 'node:net';
import type { PublicSiteConfig } from '@kamito/shared';
import { publicGet } from './api-client';
import { serverEnv } from './server-env';
import { sharedRateLimitRetryAfter } from './public-shared-rate-limit';

type Limits = PublicSiteConfig['rateLimit'];

/** Fixed window per IP, in this instance's memory (enough for one client replica; see phase 08 risks). */
type Bucket = { count: number; resetAt: number };
const hits = new Map<string, { page?: Bucket; search?: Bucket }>();
let sweepAt = 0;
let limits: { value: Limits | null; expiresAt: number } = { value: null, expiresAt: 0 };
let refreshing: Promise<void> | null = null;
let warnedUnknownIp = false;

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
  if (real && isIP(real)) return real;
  const forwarded = headers.get('x-forwarded-for')?.split(',').map((part) => part.trim()).filter(Boolean);
  const last = forwarded?.at(-1);
  if (last && isIP(last)) return last;
  if (!warnedUnknownIp) {
    warnedUnknownIp = true;
    console.warn('public-rate-limit: no valid client IP; check trusted proxy headers');
  }
  return 'unknown';
}

/** One subscriber gets a whole IPv6 /64, so it counts as one visitor rather than 2^64 of them. */
export function rateLimitKey(ip: string): string {
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return 'unknown';
  // URL canonicalization handles embedded IPv4, compressed groups and leading zeroes alike.
  // Node accepts interface scopes (fe80::1%eth0); they identify an interface, not a different visitor.
  const address = ip.split('%')[0]!;
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [head = '', tail] = normalized.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  if (groups.slice(0, 5).every((g) => g === '0') && groups[5] === 'ffff') {
    const high = parseInt(groups[6]!, 16);
    const low = parseInt(groups[7]!, 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return `${groups.slice(0, 4).join(':')}::/64`;
}

function sweep(now: number) {
  if (now < sweepAt) return;
  for (const [key, entry] of hits) if ((entry.page?.resetAt ?? 0) <= now && (entry.search?.resetAt ?? 0) <= now) hits.delete(key);
  sweepAt = now + 60_000;
}

/** Seconds to wait when over the limit, else null. Search pages (uncached) count against a lower limit too. */
export async function rateLimitRetryAfter(ip: string, searching: boolean): Promise<number | null> {
  const now = Date.now();
  const config = await currentLimits(now);
  if (!config) return null;
  const key = rateLimitKey(ip);
  const shared = await sharedRateLimitRetryAfter(key, searching, config);
  if (shared !== undefined) return shared;
  sweep(now);
  let visitor = hits.get(key);
  if (!visitor) {
    // The configurable memory cap counts visitors, including both of their counters.
    if (hits.size >= config.maxTrackedIps) return null;
    visitor = {};
    hits.set(key, visitor);
  }
  const buckets: ['page' | 'search', number][] = [['page', config.maxRequests]];
  if (searching) buckets.push(['search', config.searchMaxRequests]);
  let retryAfter: number | null = null;
  for (const [bucket, max] of buckets) {
    let entry = visitor[bucket];
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + config.windowSeconds * 1000 };
      visitor[bucket] = entry;
    }
    entry.count += 1;
    if (entry.count > max) retryAfter = Math.max(retryAfter ?? 0, Math.ceil((entry.resetAt - now) / 1000));
  }
  return retryAfter;
}
