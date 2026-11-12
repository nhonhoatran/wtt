import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';

const USERS = '/api/v1/admin/users';

/** Every key name in a JSON value, at any depth. */
function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
  }
  return [];
}

describe('user changes are audited and never leak secrets (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: TestUser;
  let adminCookie: string;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('records a role change with before and after values, by the acting admin', async () => {
    const target = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    await kit.write('patch', `${USERS}/${target.id}`, adminCookie, { role: 'ADMIN' }).expect(200);
    const row = await kit.prisma.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: 'user.role.change' },
    });
    expect(row).toMatchObject({ actorType: 'USER', actorId: admin.id, before: { role: 'RESULTS_OPERATOR' }, after: { role: 'ADMIN' } });
  });

  it('records a password reset without storing the temporary password', async () => {
    const target = await kit.createUser();
    const res = await kit.write('post', `${USERS}/${target.id}/reset-password`, adminCookie).expect(200);
    const row = await kit.prisma.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: 'user.password.reset' },
    });
    expect(row.actorId).toBe(admin.id);
    expect(JSON.stringify(row)).not.toContain(res.body.data.tempPassword);
  });

  it('records session revocation with the number of sessions ended', async () => {
    const target = await kit.createUser();
    await kit.signIn(target);
    await kit.signIn(target);
    await kit.write('post', `${USERS}/${target.id}/revoke-sessions`, adminCookie).expect(200);
    const row = await kit.prisma.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: 'user.sessions.revoke' },
    });
    expect(row.after).toEqual({ count: 2 });
  });

  it('records re-activation as user.unlock', async () => {
    const target = await kit.createUser();
    await kit.write('patch', `${USERS}/${target.id}`, adminCookie, { isActive: false }).expect(200);
    await kit.write('patch', `${USERS}/${target.id}`, adminCookie, { isActive: true }).expect(200);
    expect(await kit.prisma.auditLog.count({ where: { entityId: target.id, action: 'user.unlock' } })).toBe(1);
  });

  it('returns no password hash, credential or session token in user responses', async () => {
    const target = await kit.createUser();
    await kit.signIn(target);
    const detail = await kit.get(`${USERS}/${target.id}`, adminCookie).expect(200);
    const list = await kit.get(`${USERS}?q=${target.email}`, adminCookie).expect(200);
    const secretKeys = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'idToken'];
    for (const body of [detail.body, list.body]) {
      expect(keysDeep(body).filter((key) => secretKeys.includes(key))).toEqual([]);
    }
  });

  it('keeps the audit log read-only: writes to it have no route', async () => {
    const id = 'probe-audit-id';
    await kit.write('post', '/api/v1/admin/audit-logs', adminCookie, { action: 'x' }).expect(404);
    await kit.write('patch', `/api/v1/admin/audit-logs/${id}`, adminCookie, { reason: 'x' }).expect(404);
    await kit.write('delete', `/api/v1/admin/audit-logs/${id}`, adminCookie).expect(404);
  });
});
