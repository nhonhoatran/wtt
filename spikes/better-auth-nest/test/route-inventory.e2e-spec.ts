import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UNAUTH_PATHS } from '../src/auth/raw-allowlist.js';
import { AUTH, bootApp, freshIp, ORIGIN, type Ctx } from './helpers.js';

interface RouteInfo {
  path: string;
  methods: string[];
}

// Superset body so validation does not mask a route that would otherwise succeed.
const RICH_BODY = {
  email: 'nobody@spike.test',
  password: 'Sup3r-Secret-Pass!',
  name: 'Nobody',
  newPassword: 'N3w-Secret-Pass!!',
  currentPassword: 'Sup3r-Secret-Pass!',
  token: 'x',
  userId: 'x',
  role: 'ADMIN',
  provider: 'github',
  callbackURL: '/',
  sessionToken: 'x',
  newEmail: 'other@spike.test',
  data: { name: 'x' },
};

function listRoutes(api: Record<string, unknown>): RouteInfo[] {
  return Object.values(api)
    .map((fn) => {
      const endpoint = fn as { path?: string; options?: { method?: string | string[] } };
      const method = endpoint.options?.method ?? 'GET';
      return { path: endpoint.path ?? '', methods: Array.isArray(method) ? method : [method] };
    })
    .filter((r) => r.path)
    .sort((a, b) => a.path.localeCompare(b.path));
}

const concrete = (path: string) => path.replace(/:\w+/g, 'x');

describe('route inventory and unauthenticated allowlist', () => {
  let ctx: Ctx;
  let routes: RouteInfo[];

  beforeAll(async () => {
    ctx = await bootApp();
    routes = listRoutes(ctx.auth.api as unknown as Record<string, unknown>);
  });
  afterAll(async () => ctx.app.close());

  it('express router exposes Better Auth only as one wildcard route (router walk is not an inventory)', () => {
    const server = ctx.app.getHttpAdapter().getInstance();
    const stack = (server.router?.stack ?? []) as { route?: { path: string } }[];
    const authLayers = stack.filter((l) => l.route?.path?.includes('/api/v1/auth'));
    expect(authLayers.map((l) => l.route?.path)).toEqual(['/api/v1/auth/*splat']);
  });

  it('records every Better Auth endpoint (auth.api walk)', () => {
    writeFileSync('route-inventory.json', JSON.stringify(routes, null, 2));
    expect(routes.length).toBeGreaterThan(40);
  });

  it('layer A: Better Auth handler alone (disabledPaths only) - report 2xx/3xx unauthenticated', async () => {
    const before = await ctx.prisma.user.count();
    const open: string[] = [];
    const redirects: string[] = [];
    for (const route of routes) {
      for (const method of route.methods) {
        const url = `${ORIGIN}${AUTH}${concrete(route.path)}`;
        const init: RequestInit = {
          method,
          redirect: 'manual',
          headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': freshIp() },
        };
        if (method !== 'GET') init.body = JSON.stringify(RICH_BODY);
        const res = await ctx.auth.handler(new Request(url, init));
        const tag = `${method} ${route.path} -> ${res.status}`;
        if (res.status >= 200 && res.status < 300) open.push(tag);
        else if (res.status >= 300 && res.status < 400) redirects.push(tag);
      }
    }
    writeFileSync('route-layer-a.json', JSON.stringify({ open, redirects }, null, 2));
    expect(await ctx.prisma.user.count()).toBe(before);
    const unexpected = open.filter((o) => !UNAUTH_PATHS.includes(o.split(' ')[1] ?? ''));
    expect(unexpected).toEqual([]);
  });

  it('layer B: full Nest app with default-deny allowlist - only UNAUTH_PATHS return 2xx/3xx', async () => {
    const before = await ctx.prisma.user.count();
    const results: { method: string; path: string; status: number }[] = [];
    for (const route of routes) {
      for (const method of route.methods) {
        const m = method.toLowerCase() as 'get' | 'post';
        const req = ctx.http()[m](`${AUTH}${concrete(route.path)}`).redirects(0);
        req.set('Origin', ORIGIN).set('X-Forwarded-For', freshIp());
        if (m === 'post') req.send(RICH_BODY);
        const res = await req;
        results.push({ method, path: route.path, status: res.status });
      }
    }
    writeFileSync('route-probe.json', JSON.stringify(results, null, 2));
    expect(await ctx.prisma.user.count()).toBe(before);
    const reachable = results.filter((r) => r.status >= 200 && r.status < 400);
    expect(reachable.filter((r) => !UNAUTH_PATHS.includes(r.path))).toEqual([]);
  });

  it('layer B: path-variant bypass attempts on sign-up stay 404', async () => {
    const variants = [
      `${AUTH}/sign-up/email/`,
      `${AUTH}//sign-up/email`,
      `${AUTH}/SIGN-UP/email`,
      `${AUTH}/sign-up/%65mail`,
      `${AUTH}/sign-up/email?x=1`,
      `${AUTH}/./sign-up/email`,
      `${AUTH}/sign-in/../sign-up/email`,
    ];
    for (const url of variants) {
      const res = await ctx.http().post(url).set('Origin', ORIGIN).set('X-Forwarded-For', freshIp()).send(RICH_BODY);
      expect([url, res.status]).toEqual([url, 404]);
    }
  });

  it('layer A: sign-up via BA handler alone is 404 (disabledPaths), variants noted', async () => {
    const out: Record<string, number> = {};
    for (const p of ['/sign-up/email', '/sign-up/email/', '//sign-up/email', '/SIGN-UP/email', '/sign-up/%65mail']) {
      const res = await ctx.auth.handler(
        new Request(`${ORIGIN}${AUTH}${p}`, {
          method: 'POST',
          headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': freshIp() },
          body: JSON.stringify(RICH_BODY),
        }),
      );
      out[p] = res.status;
    }
    writeFileSync('route-layer-a-signup-variants.json', JSON.stringify(out, null, 2));
    expect(out['/sign-up/email']).toBe(404);
  });
});
