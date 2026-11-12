import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, AUTH, bootApp, cleanupUsers, cookieHeader, createUserDirect, freshIp, login, ORIGIN, PASSWORD, type Ctx } from './helpers.js';

describe('admin plugin, impersonation, temp password, session revocation', () => {
  let ctx: Ctx;
  const created: string[] = [];
  let admin: { id: string; email: string };
  let operator: { id: string; email: string };
  let adminCookie: string;

  beforeAll(async () => {
    ctx = await bootApp();
    admin = await createUserDirect(ctx, 'ADMIN');
    operator = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(admin.id, operator.id);
    adminCookie = (await login(ctx, admin.email)).cookie;
  });
  afterAll(async () => {
    await cleanupUsers(ctx, created);
    await ctx.app.close();
  });

  it('sign-up is 404 for every sign-up path', async () => {
    for (const p of ['/sign-up/email', '/sign-up/anything', '/sign-up']) {
      const res = await ctx.http().post(`${AUTH}${p}`).set('Origin', ORIGIN).set('X-Forwarded-For', freshIp()).send({
        email: `new-${Date.now()}@spike.test`,
        password: PASSWORD,
        name: 'x',
      });
      expect([p, res.status]).toEqual([p, 404]);
    }
    expect(await ctx.prisma.user.count({ where: { email: { startsWith: 'new-' } } })).toBe(0);
  });

  it('admin endpoints: anonymous 401, operator 403, admin 200', async () => {
    const op = (await login(ctx, operator.email)).cookie;
    expect((await ctx.http().get(`${AUTH}/admin/list-users`).set('X-Forwarded-For', freshIp())).status).toBe(401);
    expect((await authed(ctx, 'get', `${AUTH}/admin/list-users`, op)).status).toBe(403);
    expect(
      (await authed(ctx, 'post', `${AUTH}/admin/set-role`, op).send({ userId: operator.id, role: 'ADMIN' })).status,
    ).toBe(403);
    expect((await authed(ctx, 'get', `${AUTH}/admin/list-users`, adminCookie)).status).toBe(200);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: operator.id } })).role).toBe('RESULTS_OPERATOR');
  });

  it('impersonation and user removal are 404 for an ADMIN session (Express allowlist)', async () => {
    for (const p of ['/admin/impersonate-user', '/admin/stop-impersonating', '/admin/remove-user']) {
      const res = await authed(ctx, 'post', `${AUTH}${p}`, adminCookie).send({ userId: operator.id });
      expect([p, res.status]).toEqual([p, 404]);
    }
  });

  it('defence in depth: with the Express filter off, Better Auth disabledPaths still returns 404', async () => {
    for (const p of ['/admin/impersonate-user', '/admin/remove-user']) {
      const res = await ctx.auth.handler(
        new Request(`${ORIGIN}${AUTH}${p}`, {
          method: 'POST',
          headers: { origin: ORIGIN, cookie: adminCookie, 'content-type': 'application/json', 'x-forwarded-for': freshIp() },
          body: JSON.stringify({ userId: operator.id }),
        }),
      );
      expect([p, res.status]).toEqual([p, 404]);
    }
  });

  it('defence in depth: role permissions deny impersonate/remove even through auth.api', async () => {
    const headers = new Headers({ cookie: adminCookie });
    await expect(ctx.auth.api.impersonateUser({ body: { userId: operator.id }, headers })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(ctx.auth.api.removeUser({ body: { userId: operator.id }, headers })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('temp password: admin sets it, old sessions die, user is forced to change before anything else', async () => {
    const user = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(user.id);
    const before = await login(ctx, user.email);
    const temp = 'Temp-Password-2026!';
    const set = await authed(ctx, 'post', `${AUTH}/admin/set-user-password`, adminCookie).send({
      userId: user.id,
      newPassword: temp,
    });
    expect(set.status).toBe(200);
    expect((await authed(ctx, 'get', '/api/v1/me', before.cookie)).status).toBe(401);

    const first = await login(ctx, user.email, temp);
    expect(first.res.status).toBe(200);
    const blocked = await authed(ctx, 'get', '/api/v1/me', first.cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const newPassword = 'Chosen-By-User-2026!';
    const change = await authed(ctx, 'post', `${AUTH}/change-password`, first.cookie).send({
      currentPassword: temp,
      newPassword,
      revokeOtherSessions: true,
    });
    expect(change.status).toBe(200);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(false);
    const fresh = await login(ctx, user.email, newPassword);
    expect((await authed(ctx, 'get', '/api/v1/me', fresh.cookie)).status).toBe(200);
    expect((await login(ctx, user.email, temp)).res.status).toBe(401);
  });

  it('temp password gate also covers raw Better Auth routes for a flagged ADMIN', async () => {
    const flagged = await createUserDirect(ctx, 'ADMIN', { mustChangePassword: true });
    created.push(flagged.id);
    const { cookie } = await login(ctx, flagged.email);
    const res = await authed(ctx, 'get', `${AUTH}/admin/list-users`, cookie);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('admin create-user (sign-up replacement) yields a user that must change the initial password', async () => {
    const email = `created-${Date.now()}@spike.test`;
    const res = await authed(ctx, 'post', `${AUTH}/admin/create-user`, adminCookie).send({
      email,
      password: 'Initial-Password-2026!',
      name: 'Created',
      role: 'RESULTS_OPERATOR',
    });
    expect(res.status).toBe(200);
    created.push(res.body.user.id);
    const row = await ctx.prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect([row.role, row.mustChangePassword]).toEqual(['RESULTS_OPERATOR', true]);
    const bad = await authed(ctx, 'post', `${AUTH}/admin/create-user`, adminCookie).send({
      email: `bad-${Date.now()}@spike.test`,
      password: 'Initial-Password-2026!',
      name: 'Bad',
      role: 'SUPERUSER',
    });
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });

  it('revoke-user-sessions kills every session of that user only', async () => {
    const target = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(target.id);
    const s1 = (await login(ctx, target.email)).cookie;
    const s2 = (await login(ctx, target.email)).cookie;
    const otherUser = (await login(ctx, operator.email)).cookie;
    const res = await authed(ctx, 'post', `${AUTH}/admin/revoke-user-sessions`, adminCookie).send({ userId: target.id });
    expect(res.status).toBe(200);
    expect((await authed(ctx, 'get', '/api/v1/me', s1)).status).toBe(401);
    expect((await authed(ctx, 'get', '/api/v1/me', s2)).status).toBe(401);
    expect((await authed(ctx, 'get', '/api/v1/me', otherUser)).status).toBe(200);
  });
});

describe('step 7: explicit Nest controllers wrapping auth.api, raw handler closed', () => {
  let ctx: Ctx;
  const created: string[] = [];

  beforeAll(async () => {
    ctx = await bootApp({ rawAllowlist: [] });
  });
  afterAll(async () => {
    await cleanupUsers(ctx, created);
    await ctx.app.close();
  });

  it('login, me, change-password, logout work with the raw handler fully closed', async () => {
    const user = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(user.id);
    expect((await ctx.http().post(`${AUTH}/sign-in/email`).send({})).status).toBe(404);

    const login1 = await ctx.http().post('/api/v1/session/login').set('X-Forwarded-For', freshIp()).send({
      email: user.email,
      password: PASSWORD,
    });
    expect(login1.status).toBe(200);
    const raw = (login1.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(raw).toMatch(/^__Secure-better-auth\.session_token=.*HttpOnly.*SameSite=Lax/is);
    const cookie = cookieHeader(login1.headers['set-cookie']);
    expect((await authed(ctx, 'get', '/api/v1/me', cookie)).body.id).toBe(user.id);

    const change = await authed(ctx, 'post', '/api/v1/session/change-password', cookie).send({
      currentPassword: PASSWORD,
      newPassword: 'Another-Pass-2026!',
    });
    expect(change.status).toBe(200);
    const cookie2 = cookieHeader(change.headers['set-cookie']) || cookie;
    expect((await authed(ctx, 'post', '/api/v1/session/logout', cookie2).send({})).status).toBe(200);
    expect((await authed(ctx, 'get', '/api/v1/me', cookie2)).status).toBe(401);
  });

  it('FINDING: auth.api calls skip handler-level rate limit, so wrappers need their own throttling', async () => {
    const user = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(user.id);
    const ip = freshIp();
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await ctx
        .http()
        .post('/api/v1/session/login')
        .set('X-Forwarded-For', ip)
        .send({ email: user.email, password: 'wrong-password-1' });
      codes.push(res.status);
    }
    expect(codes).toEqual([401, 401, 401, 401, 401, 401]);
  });
});
