import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authed, AUTH, bootApp, cleanupUsers, createUserDirect, freshIp, login, ORIGIN, PASSWORD, type Ctx } from './helpers.js';

describe('session lifecycle through the mounted handler and Nest guard', () => {
  let ctx: Ctx;
  const created: string[] = [];
  let admin: { id: string; email: string };
  let operator: { id: string; email: string };

  beforeAll(async () => {
    ctx = await bootApp();
    admin = await createUserDirect(ctx, 'ADMIN');
    operator = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(admin.id, operator.id);
  });
  afterAll(async () => {
    await cleanupUsers(ctx, created);
    await ctx.app.close();
  });

  it('body parser and global prefix coexist: raw handler under /api/v1/auth, Nest JSON routes still parse bodies', async () => {
    const raw = await login(ctx, operator.email);
    expect(raw.res.status).toBe(200);
    const wrongPrefix = await ctx.http().post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({});
    expect(wrongPrefix.status).toBe(404);
    const nestJson = await ctx
      .http()
      .post('/api/v1/session/login')
      .set('X-Forwarded-For', freshIp())
      .send({ email: operator.email, password: PASSWORD });
    expect(nestJson.status).toBe(200);
  });

  it('login sets a hardened cookie and guard resolves id and role from the DB', async () => {
    const { res, cookie } = await login(ctx, operator.email);
    expect(res.status).toBe(200);
    const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.includes('session_token')) ?? '';
    writeFileSync('cookie-sample.txt', raw.replace(/=[^;]+/, '=<redacted>'));
    expect(raw).toMatch(/^__Secure-better-auth\.session_token=/);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Path=\//i);
    const me = await authed(ctx, 'get', '/api/v1/me', cookie);
    expect(me.body).toEqual({ id: operator.id, role: 'RESULTS_OPERATOR' });
  });

  it('role is read from the DB on every request, not frozen in the session', async () => {
    const user = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(user.id);
    const { cookie } = await login(ctx, user.email);
    expect((await authed(ctx, 'get', '/api/v1/admin/ping', cookie)).status).toBe(403);
    await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    expect((await authed(ctx, 'get', '/api/v1/admin/ping', cookie)).status).toBe(200);
    await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'RESULTS_OPERATOR' } });
    expect((await authed(ctx, 'get', '/api/v1/admin/ping', cookie)).status).toBe(403);
  });

  it('unauthenticated, forged and garbage cookies are rejected by the guard', async () => {
    expect((await ctx.http().get('/api/v1/me')).status).toBe(401);
    const forged = await authed(ctx, 'get', '/api/v1/me', '__Secure-better-auth.session_token=abc.def');
    expect(forged.status).toBe(401);
    expect((await ctx.http().get('/api/v1/health')).status).toBe(200);
  });

  it('logout invalidates the session server-side', async () => {
    const { cookie } = await login(ctx, operator.email);
    const out = await authed(ctx, 'post', `${AUTH}/sign-out`, cookie).send({});
    expect(out.status).toBe(200);
    expect((await authed(ctx, 'get', '/api/v1/me', cookie)).status).toBe(401);
  });

  it('expired session is rejected', async () => {
    const { cookie } = await login(ctx, operator.email);
    await ctx.prisma.session.updateMany({ where: { userId: operator.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect((await authed(ctx, 'get', '/api/v1/me', cookie)).status).toBe(401);
  });

  it('banned user: live sessions die, new logins refused, DB-level ban also blocks a surviving session', async () => {
    const victim = await createUserDirect(ctx, 'RESULTS_OPERATOR');
    created.push(victim.id);
    const adminLogin = await login(ctx, admin.email);
    const v1 = await login(ctx, victim.email);
    expect((await authed(ctx, 'get', '/api/v1/me', v1.cookie)).status).toBe(200);
    const ban = await authed(ctx, 'post', `${AUTH}/admin/ban-user`, adminLogin.cookie).send({ userId: victim.id });
    expect(ban.status).toBe(200);
    expect((await authed(ctx, 'get', '/api/v1/me', v1.cookie)).status).toBe(401);
    const again = await login(ctx, victim.email);
    expect(again.res.status).toBe(403);
    expect(again.res.body.code).toBe('BANNED_USER');

    await authed(ctx, 'post', `${AUTH}/admin/unban-user`, adminLogin.cookie).send({ userId: victim.id });
    const v2 = await login(ctx, victim.email);
    expect(v2.res.status).toBe(200);
    await ctx.prisma.user.update({ where: { id: victim.id }, data: { banned: true } });
    expect((await authed(ctx, 'get', '/api/v1/me', v2.cookie)).status).toBe(403);
  });

  it('repeated wrong passwords: 3 x 401 then 429, correct password still 429 on that IP, other IP unaffected', async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await login(ctx, operator.email, 'wrong-password-1', ip)).res.status);
    expect(statuses).toEqual([401, 401, 401, 429]);
    const correctSameIp = await login(ctx, operator.email, PASSWORD, ip);
    expect(correctSameIp.res.status).toBe(429);
    expect(correctSameIp.res.headers['x-retry-after']).toBeDefined();
    expect((await login(ctx, operator.email, PASSWORD, freshIp())).res.status).toBe(200);
  });

  it('rate limit counts the trust-proxy client IP, not a spoofed left-most X-Forwarded-For value', async () => {
    const realClient = freshIp();
    const codes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await ctx
        .http()
        .post(`${AUTH}/sign-in/email`)
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', `10.9.8.${i + 1}, ${realClient}`)
        .send({ email: operator.email, password: 'wrong-password-1' });
      codes.push(res.status);
    }
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    // A different real client reusing the same spoofed prefix must not share the exhausted bucket.
    const other = await ctx
      .http()
      .post(`${AUTH}/sign-in/email`)
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', `10.9.8.1, ${freshIp()}`)
      .send({ email: operator.email, password: PASSWORD });
    expect(other.status).toBe(200);
  });

  it('login error is identical for unknown email and wrong password', async () => {
    const unknown = await login(ctx, `ghost-${Date.now()}@spike.test`, 'wrong-password-1');
    const wrong = await login(ctx, operator.email, 'wrong-password-1');
    expect(unknown.res.status).toBe(wrong.res.status);
    expect(unknown.res.body).toEqual(wrong.res.body);
    expect(unknown.res.status).toBe(401);
    writeFileSync('login-error-sample.json', JSON.stringify(wrong.res.body));
  });

  it('login error timing for unknown vs known email is comparable (informational)', async () => {
    const time = async (email: string) => {
      const t0 = performance.now();
      await login(ctx, email, 'wrong-password-1');
      return performance.now() - t0;
    };
    const known: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      known.push(await time(operator.email));
      unknown.push(await time(`ghost-${i}-${Date.now()}@spike.test`));
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    writeFileSync('login-timing.json', JSON.stringify({ knownMs: avg(known), unknownMs: avg(unknown) }));
    expect(avg(known)).toBeGreaterThan(0);
  });

  it('CSRF: cookie-bearing cross-origin POST is 403; cookie-less cross-site browser sign-in is 403 via Fetch Metadata', async () => {
    const { cookie } = await login(ctx, operator.email);
    const withCookie = await ctx
      .http()
      .post(`${AUTH}/change-password`)
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', freshIp())
      .send({ currentPassword: PASSWORD, newPassword: 'Evil-Changed-Pass-1' });
    expect(withCookie.status).toBe(403);
    const crossSite = await ctx
      .http()
      .post(`${AUTH}/sign-in/email`)
      .set('Origin', 'https://evil.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Sec-Fetch-Mode', 'navigate')
      .set('Sec-Fetch-Dest', 'document')
      .set('X-Forwarded-For', freshIp())
      .send({ email: operator.email, password: PASSWORD });
    expect(crossSite.status).toBe(403);
  });

  it('password hash default is scrypt (salt:key, 128 hex key) and verifies', async () => {
    const account = await ctx.prisma.account.findFirst({ where: { userId: operator.id, providerId: 'credential' } });
    expect(account?.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    const c = await ctx.auth.$context;
    expect(await c.password.verify({ hash: account?.password ?? '', password: PASSWORD })).toBe(true);
  });
});
