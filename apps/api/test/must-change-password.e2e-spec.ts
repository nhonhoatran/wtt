import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';

const ADMIN_PATHS = {
  users: '/api/v1/admin/users',
  audit: '/api/v1/admin/audit-logs',
  settings: '/api/v1/admin/settings',
  queues: '/api/v1/admin/queues',
  stepUp: '/api/v1/auth/step-up',
};

describe('mustChangePassword gate (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let target: TestUser;
  let cookie: string;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({
      role: 'ADMIN',
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + 3_600_000),
    });
    target = await kit.createUser();
    cookie = await kit.signIn(admin);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('answers 403 PASSWORD_CHANGE_REQUIRED on every protected API, including bull-board and step-up', async () => {
    const blocked: Array<{ label: string; send: () => Promise<{ status: number; body: { error?: { code?: string } } }> }> = [
      { label: 'GET users', send: () => kit.get(ADMIN_PATHS.users, cookie) },
      { label: 'GET user', send: () => kit.get(`${ADMIN_PATHS.users}/${target.id}`, cookie) },
      {
        label: 'POST user',
        send: () => kit.write('post', ADMIN_PATHS.users, cookie, { email: `blocked-${Date.now()}@test.kamito.local`, name: 'x' }),
      },
      { label: 'PATCH user', send: () => kit.write('patch', `${ADMIN_PATHS.users}/${target.id}`, cookie, { name: 'x' }) },
      { label: 'reset password', send: () => kit.write('post', `${ADMIN_PATHS.users}/${target.id}/reset-password`, cookie) },
      { label: 'revoke sessions', send: () => kit.write('post', `${ADMIN_PATHS.users}/${target.id}/revoke-sessions`, cookie) },
      { label: 'GET audit logs', send: () => kit.get(ADMIN_PATHS.audit, cookie) },
      { label: 'GET settings', send: () => kit.get(ADMIN_PATHS.settings, cookie) },
      {
        label: 'PUT setting',
        send: () => kit.write('put', `${ADMIN_PATHS.settings}/auth.stepUp.ttlMinutes`, cookie, { value: 5 }),
      },
      { label: 'GET bull-board', send: () => kit.get(ADMIN_PATHS.queues, cookie) },
      { label: 'POST step-up', send: () => kit.write('post', ADMIN_PATHS.stepUp, cookie, { password: admin.password }) },
    ];

    const wrong: string[] = [];
    for (const endpoint of blocked) {
      const res = await endpoint.send();
      if (res.status !== 403 || res.body.error?.code !== 'PASSWORD_CHANGE_REQUIRED') {
        wrong.push(`${endpoint.label} -> ${res.status} ${res.body.error?.code ?? ''}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('still opens /me, change-password and sign-out', async () => {
    const me = await kit.get('/api/v1/auth/me', cookie).expect(200);
    expect(me.body.data.mustChangePassword).toBe(true);

    const wrongCurrent = await kit
      .write('post', '/api/v1/auth/change-password', cookie, { currentPassword: 'nope', newPassword: 'Long-enough-123' })
      .expect(422);
    expect(wrongCurrent.body.error.code).not.toBe('PASSWORD_CHANGE_REQUIRED');

    await kit.write('post', '/api/v1/auth/sign-out', cookie).expect(200);
    await kit.get('/api/v1/auth/me', cookie).expect(401);
  });
});
