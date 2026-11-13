import { NextResponse, type NextRequest } from 'next/server';
import { isInternalHost } from './lib/internal-request';

/** Second wall in front of /api/revalidate (the first is the Traefik rule): public hosts get a 404. */
export function proxy(request: NextRequest) {
  if (!isInternalHost(request.headers.get('host'))) return new NextResponse(null, { status: 404 });
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/revalidate', '/api/revalidate/:path*'],
};
