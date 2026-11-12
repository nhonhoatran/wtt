import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_BASE_PATH, AUTH_INSTANCE, type Auth } from '../src/modules/auth/auth-instance.js';
import { BULL_BOARD_PATH } from '../src/modules/queue/bull-board-mount.js';
import { AuthTestKit, randomIp } from './support/auth-test-kit.js';
import { betterAuthRoutes, concretePath, expressRoutes, PROBE_BODY, type Probe } from './support/route-probes.js';

/** Reachable without a session; anything else must not answer 2xx/3xx anonymously. */
const UNAUTHENTICATED_ALLOWLIST = new Set([
  'POST /api/v1/auth/sign-in/email',
  'POST /api/v1/auth/sign-out',
  'GET /api/v1/health/live',
  'GET /api/v1/health/ready',
]);

describe('Express router allowlist (handlers outside Nest guards)', () => {
  let kit: AuthTestKit;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
  });

  afterAll(async () => {
    await kit.close();
  });

  it('answers nothing but the allowlist with 2xx/3xx when signed out', async () => {
    const server = kit.app.getHttpAdapter().getInstance();
    const fromRouter = expressRoutes(server).map((route) => ({
      method: route.method === '_ALL' ? 'POST' : route.method,
      path: route.path,
    }));
    const fromAuth = betterAuthRoutes(kit.app.get<Auth>(AUTH_INSTANCE));
    expect(fromAuth.length).toBeGreaterThanOrEqual(30);
    const fromBoard: Probe[] = [
      { method: 'GET', path: BULL_BOARD_PATH },
      { method: 'GET', path: `${BULL_BOARD_PATH}/api/queues` },
      { method: 'PUT', path: `${BULL_BOARD_PATH}/api/queues/maintenance/retry/failed` },
    ];
    const probes = [...fromRouter, ...fromAuth, ...fromBoard, { method: 'POST', path: `${AUTH_BASE_PATH}/sign-up/email` }];
    const usersBefore = await kit.prisma.user.count();

    const leaks: string[] = [];
    for (const probe of probes) {
      const path = concretePath(probe.path);
      const key = `${probe.method} ${path}`;
      const method = probe.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const req = kit.http[method](path).set('Origin', kit.origin).set('X-Forwarded-For', randomIp());
      const res = method === 'get' ? await req : await req.send(PROBE_BODY);
      if (res.status < 400 && !UNAUTHENTICATED_ALLOWLIST.has(key)) leaks.push(`${key} -> ${res.status}`);
    }
    expect(leaks).toEqual([]);
    expect(await kit.prisma.user.count()).toBe(usersBefore);
  });

  it('returns 404 for sign-up and its look-alike paths', async () => {
    for (const path of ['/sign-up/email', '/sign-up', '/SIGN-UP/email', '/sign-up/email/', '/sign-in/email/']) {
      const res = await kit.write('post', `${AUTH_BASE_PATH}${path}`, undefined, PROBE_BODY);
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
  });

  it('guards bull-board: 401 signed out, 403 for a foreign Origin on writes', async () => {
    await kit.get(BULL_BOARD_PATH).expect(401);
    const admin = await kit.createUser({ role: 'ADMIN' });
    const cookie = await kit.signIn(admin);
    await kit.get(`${BULL_BOARD_PATH}/api/queues`, cookie).expect(200);
    await kit.http
      .put(`${BULL_BOARD_PATH}/api/queues/maintenance/retry/failed`)
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .expect(403);
  });
});
