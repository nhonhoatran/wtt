import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_BASE_PATH, AUTH_INSTANCE, type Auth } from '../src/modules/auth/auth-instance.js';
import { AuthTestKit, randomIp, type TestUser } from './support/auth-test-kit.js';
import { betterAuthRoutes, concretePath, PROBE_BODY } from './support/route-probes.js';

/** Better Auth paths we serve on purpose, or that Nest serves under the same path. */
const SERVED_ELSEWHERE = new Set([
  'POST /api/v1/auth/sign-in/email',
  'POST /api/v1/auth/sign-out',
  'POST /api/v1/auth/change-password',
]);

describe('signed-in staff cannot reach Better Auth endpoints outside the raw allowlist', () => {
  let kit: AuthTestKit;
  let operator: TestUser;
  let cookie: string;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    operator = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    cookie = await kit.signIn(operator);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('answers 404 to every other Better Auth path, even with a valid session', async () => {
    const probes = betterAuthRoutes(kit.app.get<Auth>(AUTH_INSTANCE)).filter(
      (probe) => !SERVED_ELSEWHERE.has(`${probe.method} ${probe.path}`),
    );
    expect(probes.length).toBeGreaterThanOrEqual(25);

    const unexpected: string[] = [];
    for (const probe of probes) {
      const path = concretePath(probe.path);
      const method = probe.method.toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const req = kit.http[method as 'get'](path).set('Cookie', cookie).set('Origin', kit.origin).set('X-Forwarded-For', randomIp());
      const res = method === 'get' ? await req : await req.send(PROBE_BODY);
      if (res.status !== 404) unexpected.push(`${probe.method} ${path} -> ${res.status}`);
    }
    expect(unexpected).toEqual([]);
  });

  it('keeps the role unchanged when a staff member posts a role change to Better Auth', async () => {
    await kit.write('post', `${AUTH_BASE_PATH}/update-user`, cookie, { role: 'ADMIN' }).expect(404);
    const row = await kit.prisma.user.findUnique({ where: { id: operator.id }, select: { role: true } });
    expect(row?.role).toBe('RESULTS_OPERATOR');
  });
});
