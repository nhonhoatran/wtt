import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, negotiateLocale } from './i18n/negotiate-locale';
import { isLocale } from './i18n/locales';
import { isInternalHost } from './lib/internal-request';
import { clientIp, rateLimitRetryAfter } from './lib/public-rate-limit';
import { getPlayerProfile, isUrlPart } from './lib/public-data';

const isRevalidatePath = (path: string) => path === '/api/revalidate' || path.startsWith('/api/revalidate/');

export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  // Second wall in front of /api/revalidate (the first is the Traefik rule): public hosts get a 404.
  if (isRevalidatePath(pathname)) {
    return isInternalHost(request.headers.get('host')) ? NextResponse.next() : new NextResponse(null, { status: 404 });
  }
  const first = pathname.split('/')[1] ?? '';
  if (!isLocale(first)) {
    const locale = negotiateLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get('accept-language'));
    const target = new URL(`/${locale}${pathname === '/' ? '' : pathname}${search}`, request.url);
    const response = NextResponse.redirect(target, 307);
    response.headers.set('Vary', 'Cookie, Accept-Language');
    return response;
  }
  const retryAfter = await rateLimitRetryAfter(clientIp(request.headers), Boolean(searchParams.get('q')?.trim()));
  if (retryAfter !== null) {
    return new NextResponse('Too many requests', { status: 429, headers: { 'Retry-After': String(retryAfter), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
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
  return NextResponse.next();
}

export const config = {
  // Exclude actual framework/static routes; dotted page paths must still pass the page limiter.
  // Link prefetches skip the proxy: they are not page views and would eat a shared venue IP's budget.
  matcher: [
    '/api/revalidate',
    '/api/revalidate/:path*',
    {
      source: '/((?!api(?:/|$)|_next/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
