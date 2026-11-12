import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';

const ME = '/api/v1/auth/me';
const USERS = '/api/v1/admin/users';

describe('session lifecycle and user management (real Postgres + Redis)', () => {
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

  it('creates a user with a one-time temporary password that forces a change', async () => {
    const res = await kit
      .write('post', USERS, adminCookie, { email: `E2E-New-${Date.now()}@Test.Kamito.Local`, name: 'Người mới' })
      .expect(201);
    const { user, tempPassword, tempPasswordExpiresAt } = res.body.data;
    kit.track(user.id);
    expect(user).toMatchObject({ role: 'RESULTS_OPERATOR', mustChangePassword: true, isActive: true });
    expect(user.email).toBe(user.email.toLowerCase());
    expect(new Date(tempPasswordExpiresAt).getTime()).toBeGreaterThan(Date.now());

    const cookie = await kit.signIn({ email: user.email, password: tempPassword });
    expect((await kit.get(ME, cookie).expect(200)).body.data.mustChangePassword).toBe(true);
    await kit.get('/api/v1/admin/users/' + user.id, adminCookie).expect(200);
    const audit = await kit.prisma.auditLog.findFirst({ where: { entityId: user.id, action: 'user.create' } });
    expect(audit?.actorId).toBe(admin.id);

    const duplicate = await kit.write('post', USERS, adminCookie, { email: user.email, name: 'Trùng' }).expect(422);
    expect(duplicate.body.error.fields).toHaveProperty('email');
  });

  it('signs a locked user out at once and blocks the next sign-in', async () => {
    const user = await kit.createUser();
    const cookie = await kit.signIn(user);
    await kit.write('patch', `${USERS}/${user.id}`, adminCookie, { isActive: false }).expect(200);
    await kit.get(ME, cookie).expect(401);
    await kit.signInRequest(user.email, user.password).expect(401);
    expect(await kit.prisma.auditLog.count({ where: { entityId: user.id, action: 'user.lock' } })).toBe(1);

    await kit.write('patch', `${USERS}/${user.id}`, adminCookie, { isActive: true }).expect(200);
    await kit.signInRequest(user.email, user.password).expect(200);
  });

  it('revokes old sessions when the role changes, and the new role applies at once', async () => {
    const user = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    const cookie = await kit.signIn(user);
    await kit.get(USERS, cookie).expect(403);
    await kit.write('patch', `${USERS}/${user.id}`, adminCookie, { role: 'ADMIN' }).expect(200);
    await kit.get(ME, cookie).expect(401);
    const fresh = await kit.signIn(user);
    await kit.get(USERS, fresh).expect(200);
  });

  it('resets a password: sessions revoked, temporary password must be changed', async () => {
    const user = await kit.createUser();
    const cookie = await kit.signIn(user);
    const res = await kit.write('post', `${USERS}/${user.id}/reset-password`, adminCookie).expect(200);
    await kit.get(ME, cookie).expect(401);
    await kit.signInRequest(user.email, user.password).expect(401);
    const temp = await kit.signIn({ email: user.email, password: res.body.data.tempPassword });
    expect((await kit.get(ME, temp).expect(200)).body.data.mustChangePassword).toBe(true);
  });

  it('"sign out everywhere" revokes every session of that user only', async () => {
    const user = await kit.createUser();
    const first = await kit.signIn(user);
    const second = await kit.signIn(user);
    const res = await kit.write('post', `${USERS}/${user.id}/revoke-sessions`, adminCookie).expect(200);
    expect(res.body.data.revoked).toBe(2);
    await kit.get(ME, first).expect(401);
    await kit.get(ME, second).expect(401);
    await kit.get(ME, adminCookie).expect(200);
  });

  it('refuses to let an admin lock, demote or reset themselves', async () => {
    for (const body of [{ isActive: false }, { role: 'RESULTS_OPERATOR' }]) {
      const res = await kit.write('patch', `${USERS}/${admin.id}`, adminCookie, body).expect(422);
      expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
    }
    await kit.write('post', `${USERS}/${admin.id}/reset-password`, adminCookie).expect(422);
    await kit.write('patch', `${USERS}/${admin.id}`, adminCookie, { name: 'Tên mới' }).expect(200);
  });

  it('never leaves zero active admins when two admins demote each other at once', async () => {
    const other = await kit.createUser({ role: 'ADMIN' });
    const otherCookie = await kit.signIn(other);
    await Promise.allSettled([
      kit.write('patch', `${USERS}/${other.id}`, adminCookie, { role: 'RESULTS_OPERATOR' }),
      kit.write('patch', `${USERS}/${admin.id}`, otherCookie, { role: 'RESULTS_OPERATOR' }),
    ]);
    const survivors = await kit.prisma.user.count({
      where: { id: { in: [admin.id, other.id] }, role: 'ADMIN', isActive: true },
    });
    expect(survivors).toBeGreaterThanOrEqual(1);
    await kit.prisma.user.updateMany({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    adminCookie = await kit.signIn(admin);
  });

  it('lists users with server-side search, filter, sort and paging', async () => {
    const marker = `zz-list-${Date.now()}`;
    for (const role of ['ADMIN', 'RESULTS_OPERATOR', 'RESULTS_OPERATOR'] as const) {
      const user = await kit.createUser({ role });
      await kit.prisma.user.update({ where: { id: user.id }, data: { name: `${marker} ${role}` } });
    }
    const res = await kit
      .get(`${USERS}?q=${marker}&filter[role]=RESULTS_OPERATOR&sort=name:asc&page=1&pageSize=1`, adminCookie)
      .expect(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).not.toHaveProperty('password');
    await kit.get(`${USERS}?filter[secret]=x`, adminCookie).expect(400);
    await kit.get(`${USERS}?sort=passwordHash:asc`, adminCookie).expect(400);
  });

  it('lists audit logs with filters, newest first, with actor names', async () => {
    const res = await kit.get(`/api/v1/admin/audit-logs?filter[actorId]=${admin.id}&pageSize=50`, adminCookie).expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.data[0].actorName).toBeTruthy();
    const times = res.body.data.map((row: { createdAt: string }) => new Date(row.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    await kit.get('/api/v1/admin/audit-logs?filter[from]=not-a-date', adminCookie).expect(400);
  });
});
