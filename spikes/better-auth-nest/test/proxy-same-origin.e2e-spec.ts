import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSpikeApp } from '../src/bootstrap-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AUTH_BASE_PATH } from '../src/auth/auth-env.js';
import { createUserDirect, freshIp, ORIGIN, PASSWORD, type Ctx } from './helpers.js';
import { AUTH_TOKEN } from '../src/auth/auth.guard.js';
import type { Auth } from '../src/auth/create-auth.js';

const PUBLIC_HOST = new URL(ORIGIN).host;

// Stands in for Traefik + the admin nginx (nginx is not installed locally): appends the TLS-terminator's view
// of the client IP like Traefik, forwards X-Forwarded-For unchanged like docker/admin-api-proxy.conf, sets Proto.
function startProxy(apiPort: number): Promise<Server> {
  const server = createServer((req, res) => {
    const clientIp = String(req.headers['x-test-client-ip'] ?? '127.0.0.1');
    const inbound = req.headers['x-forwarded-for'];
    const headers = { ...req.headers };
    delete headers['x-test-client-ip'];
    headers['x-forwarded-for'] = inbound ? `${String(inbound)}, ${clientIp}` : clientIp;
    headers['x-forwarded-proto'] = 'https';
    headers.host = PUBLIC_HOST;
    const upstream = httpRequest({ host: '127.0.0.1', port: apiPort, method: req.method, path: req.url, headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on('error', () => {
      res.statusCode = 502;
      res.end();
    });
    req.pipe(upstream);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

describe('same-origin reverse proxy (node stand-in for nginx)', () => {
  let app: INestApplication;
  let proxy: Server;
  let base: string;
  let prisma: PrismaService;
  let ctx: Ctx;
  const created: string[] = [];

  beforeAll(async () => {
    app = await createSpikeApp();
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    ctx = { app, prisma, auth: app.get<Auth>(AUTH_TOKEN), http: () => { throw new Error('unused'); } };
    proxy = await startProxy(((app.getHttpServer().address()) as AddressInfo).port);
    base = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    proxy.close();
    await app.close();
  });

  const post = (path: string, body: unknown, extra: Record<string, string> = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...extra },
      body: JSON.stringify(body),
    });

  it('login through the proxy sets a host-only Secure HttpOnly Lax cookie that works on the next request', async () => {
    const user = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(user.id);
    const res = await post(`${AUTH_BASE_PATH}/sign-in/email`, { email: user.email, password: PASSWORD }, { 'x-test-client-ip': freshIp() });
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie().find((c) => c.includes('session_token')) ?? '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/Domain=/i);
    const me = await fetch(`${base}/api/v1/me`, { headers: { cookie: setCookie.split(';')[0] ?? '' } });
    expect(await me.json()).toEqual({ id: user.id, role: 'RESULTS_OPERATOR' });
  });

  it('rate limit through proxy counts the real client IP even when the client sends its own X-Forwarded-For', async () => {
    const user = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(user.id);
    const client = freshIp();
    const codes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await post(
        `${AUTH_BASE_PATH}/sign-in/email`,
        { email: user.email, password: 'wrong-password-1' },
        { 'x-test-client-ip': client, 'x-forwarded-for': `10.1.1.${i + 1}` },
      );
      codes.push(res.status);
    }
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    const ok = await post(`${AUTH_BASE_PATH}/sign-in/email`, { email: user.email, password: PASSWORD }, { 'x-test-client-ip': freshIp() });
    expect(ok.status).toBe(200);
  });
});
