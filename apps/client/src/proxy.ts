import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, negotiateLocale } from './i18n/negotiate-locale';
import { isLocale } from './i18n/locales';
import { isInternalHost } from './lib/internal-request';
import { clientIp, rateLimitRetryAfter } from './lib/public-rate-limit';
import { getPlayerProfile, getSiteConfig, isUrlPart } from './lib/public-data';
import { contactRateLimitRetryAfter } from './lib/public-contact-rate-limit';
import { pageCsp } from './lib/content-security-policy';

const isRevalidatePath = (path: string) => path === '/api/revalidate' || path.startsWith('/api/revalidate/');
const isSitemapPath = (path: string) => path === '/sitemap.xml' || path === '/sitemap' || path.startsWith('/sitemap/');

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/') || isSitemapPath(request.nextUrl.pathname)) return routeRequest(request);
  const csp = pageCsp(request.headers);
  const response = await routeRequest(request, csp.requestHeaders);
  response.headers.set(csp.header, csp.value);
  if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function routeRequest(request: NextRequest, headers?: Headers) {
  const next = () => NextResponse.next(headers ? { request: { headers } } : undefined);
  const { pathname, search, searchParams } = request.nextUrl;
  // Second wall in front of /api/revalidate (the first is the Traefik rule): public hosts get a 404.
  if (isRevalidatePath(pathname)) {
    return isInternalHost(request.headers.get('host')) ? next() : new NextResponse(null, { status: 404 });
  }
  // Runtime XML stays outside locale negotiation, but its uncached reads use the lower search budget.
  if (isSitemapPath(pathname)) {
    const retryAfter = await rateLimitRetryAfter(clientIp(request.headers), true);
    return retryAfter === null ? next() : new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(retryAfter), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const first = pathname.split('/')[1] ?? '';
  if (!isLocale(first)) {
    const locale = negotiateLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get('accept-language'));
    const target = new URL(`/${locale}${pathname === '/' ? '' : pathname}${search}`, request.url);
    const response = NextResponse.redirect(target, 307);
    response.headers.set('Vary', 'Cookie, Accept-Language');
    return response;
  }
  // Prefetches still receive CSP, but do not count as page views. POSTs cannot bypass contact limits.
  if ((request.method === 'GET' || request.method === 'HEAD')
    && (request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch')) return next();
  const ip = clientIp(request.headers);
  const contactPost = request.method === 'POST' && /^\/(vi|en)\/contact\/?$/.test(pathname);
  const contactLimits = contactPost ? (await getSiteConfig().catch(() => null))?.contactRateLimit : undefined;
  const retryAfter = contactLimits
    ? await contactRateLimitRetryAfter(ip, contactLimits)
    : await rateLimitRetryAfter(ip, Boolean(searchParams.get('q')?.trim()));
  if (retryAfter !== null) {
    const message = contactPost && first === 'vi' ? 'Bạn gửi quá nhiều tin. Vui lòng thử lại sau.' : 'Too many requests';
    return new NextResponse(message, { status: 429, headers: { 'Retry-After': String(retryAfter), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const profileRoute = /^\/(vi|en)\/players\/([^/]+)\/?$/.exec(pathname);
  if (profileRoute && (request.method === 'GET' || request.method === 'HEAD') && isUrlPart(profileRoute[2]!)) {
    const profile = await getPlayerProfile(profileRoute[2]!);
    if (profile && 'redirectTo' in profile && isUrlPart(profile.redirectTo)) {
      const response = NextResponse.redirect(new URL(`/${first}/players/${profile.redirectTo}${search}`, request.url), 301);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }
  }
  return next();
}

export const config = {
  // Exclude actual framework/static routes; dotted page paths must still pass the page limiter.
  // Prefetches pass CSP; routeRequest keeps them outside the page-view budget.
  matcher: [
    '/vi/contact',
    '/en/contact',
    '/api/revalidate',
    '/api/revalidate/:path*',
    '/sitemap.xml',
    '/sitemap/:path*',
    {
      source: '/((?!api(?:/|$)|_next/|favicon\\.ico$|robots\\.txt$|sitemap(?:\\.xml$|/)).*)',
    },
  ],
};
