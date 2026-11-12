import { NextResponse } from 'next/server';

const INTERNAL_HOSTS = (process.env.INTERNAL_HOSTS ?? 'localhost:4101,127.0.0.1:4101').split(',');

export function proxy(req) {
  if (process.env.PROXY_BLOCK === '1' && !INTERNAL_HOSTS.includes(req.headers.get('host') ?? '')) {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/revalidate' };
