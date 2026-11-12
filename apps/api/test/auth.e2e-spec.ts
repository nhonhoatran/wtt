import { authSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit, randomIp } from './support/auth-test-kit.js';

const ME = '/api/v1/auth/me';

describe('auth: sign-in, throttling, password rules (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let settings: AppSettingsService;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    settings = kit.app.get(AppSettingsService);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('signs in, returns /me with permissions, and signs out', async () => {
    const user = await kit.createUser({ role: 'RESULTS_OPERATOR' });
    const cookie = await kit.signIn(user);
    expect(cookie).toMatch(/^__Secure-better-auth\.session_token=/);

    const me = await kit.get(ME, cookie).expect(200);
    expect(me.body.data).toMatchObject({ id: user.id, role: 'RESULTS_OPERATOR', mustChangePassword: false });
    expect(me.body.data.permissions).toContain('matches.confirm');
    expect(me.body.data.permissions).not.toContain('users.list');
    expect(Object.keys(me.body.data).sort()).toEqual(
      ['email', 'id', 'listDefaultPageSize', 'mustChangePassword', 'name', 'permissions', 'role'].sort(),
    );

    const row = await kit.prisma.user.findUnique({ where: { id: user.id }, select: { lastLoginAt: true } });
    expect(row?.lastLoginAt).toBeInstanceOf(Date);

    await kit.write('post', '/api/v1/auth/sign-out', cookie).expect(200);
    await kit.get(ME, cookie).expect(401);
  });

  it('sets HttpOnly, Secure, SameSite=Lax on the session cookie', async () => {
    const user = await kit.createUser();
    const res = await kit.signInRequest(user.email, user.password).expect(200);
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.includes('session_token'));
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=Lax/i);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const user = await kit.createUser();
    const wrong = await kit.signInRequest(user.email, 'not-the-password').expect(401);
    const unknown = await kit.signInRequest(`nobody-${Date.now()}@test.kamito.local`, 'whatever-123').expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('rejects disabled accounts and expired temporary passwords with the same generic error', async () => {
    const disabled = await kit.createUser({ isActive: false });
    const expired = await kit.createUser({ mustChangePassword: true, tempPasswordExpiresAt: new Date(Date.now() - 1000) });
    const generic = (await kit.signInRequest(`nobody-${Date.now()}@test.kamito.local`, 'x-123456789')).body;
    expect((await kit.signInRequest(disabled.email, disabled.password).expect(401)).body).toEqual(generic);
    expect((await kit.signInRequest(expired.email, expired.password).expect(401)).body).toEqual(generic);
  });

  it('ends the session after the absolute lifetime and after the idle timeout', async () => {
    const user = await kit.createUser();
    const maxAgeHours = await settings.get(authSettings.sessionMaxAgeHours);
    const idleMinutes = await settings.get(authSettings.sessionIdleMinutes);

    const old = await kit.signIn(user);
    await kit.prisma.session.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - maxAgeHours * 3_600_000 - 1000) },
    });
    expect((await kit.get(ME, old).expect(401)).body.error.code).toBe('SESSION_EXPIRED');

    const idle = await kit.signIn(user);
    await kit.prisma.session.updateMany({
      where: { userId: user.id },
      data: { lastSeenAt: new Date(Date.now() - idleMinutes * 60_000 - 1000) },
    });
    expect((await kit.get(ME, idle).expect(401)).body.error.code).toBe('SESSION_IDLE_TIMEOUT');
  });

  it('returns 429 once one IP exceeds the sign-in limit, even with the right password', async () => {
    const user = await kit.createUser();
    const max = await settings.get(authSettings.loginIpMaxAttempts);
    const ip = randomIp();
    for (let i = 0; i < max; i += 1) await kit.signInRequest(`nobody-${i}@test.kamito.local`, 'x-123456789', ip);
    const blocked = await kit.signInRequest(user.email, user.password, ip).expect(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
    await kit.signInRequest(user.email, user.password, randomIp()).expect(200);
  });

  it('locks the account after repeated failures from many IPs, still with the generic error', async () => {
    const user = await kit.createUser();
    const maxFailures = await settings.get(authSettings.lockoutMaxFailures);
    let lastFailure: unknown;
    for (let i = 0; i < maxFailures; i += 1) {
      lastFailure = (await kit.signInRequest(user.email, `wrong-${i}-pass`, randomIp()).expect(401)).body;
    }
    const locked = await kit.signInRequest(user.email, user.password, randomIp()).expect(401);
    expect(locked.body).toEqual(lastFailure);
  });

  it('only opens /me and change-password while a password change is pending', async () => {
    const user = await kit.createUser({
      role: 'ADMIN',
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + 3_600_000),
    });
    const cookie = await kit.signIn(user);
    expect((await kit.get(ME, cookie).expect(200)).body.data.mustChangePassword).toBe(true);
    const blocked = await kit.get('/api/v1/admin/users', cookie).expect(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const newPassword = `New-${user.password}`;
    const changed = await kit
      .write('post', '/api/v1/auth/change-password', cookie, { currentPassword: user.password, newPassword })
      .expect(200);
    const fresh = ([] as string[]).concat(changed.headers['set-cookie'] ?? []).find((c) => c.includes('session_token'));
    expect(fresh).toBeTruthy();
    await kit.get(ME, cookie).expect(401);
    await kit.get('/api/v1/admin/users', fresh!.split(';')[0]).expect(200);
    await kit.signInRequest(user.email, user.password).expect(401);
    await kit.signInRequest(user.email, newPassword).expect(200);
  });

  it('maps a wrong current password and a short new password to field errors', async () => {
    const user = await kit.createUser();
    const cookie = await kit.signIn(user);
    const wrong = await kit
      .write('post', '/api/v1/auth/change-password', cookie, { currentPassword: 'nope', newPassword: 'Long-enough-123' })
      .expect(422);
    expect(wrong.body.error.fields).toHaveProperty('currentPassword');
    const short = await kit
      .write('post', '/api/v1/auth/change-password', cookie, { currentPassword: user.password, newPassword: 'short' })
      .expect(422);
    expect(short.body.error.fields).toHaveProperty('newPassword');
  });

  it('marks the session after a correct step-up and rejects a wrong one', async () => {
    const user = await kit.createUser();
    const cookie = await kit.signIn(user);
    const wrong = await kit.write('post', '/api/v1/auth/step-up', cookie, { password: 'wrong' }).expect(422);
    expect(wrong.body.error.code).toBe('STEP_UP_FAILED');
    const ok = await kit.write('post', '/api/v1/auth/step-up', cookie, { password: user.password }).expect(200);
    expect(new Date(ok.body.data.stepUpExpiresAt).getTime()).toBeGreaterThan(Date.now());
    const session = await kit.prisma.session.findFirst({ where: { userId: user.id } });
    expect(session?.stepUpAt).toBeInstanceOf(Date);
    const audit = await kit.prisma.auditLog.count({ where: { entityId: user.id, action: 'auth.step-up.failed' } });
    expect(audit).toBe(1);
  });

  it('rejects writes from a foreign Origin on both Better Auth and Nest routes', async () => {
    const user = await kit.createUser();
    await kit.http
      .post('/api/v1/auth/sign-in/email')
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', randomIp())
      .send({ email: user.email, password: user.password })
      .expect(403);
    const cookie = await kit.signIn(user);
    const res = await kit.http
      .post('/api/v1/auth/step-up')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ password: user.password })
      .expect(403);
    expect(res.body.error.code).toBe('ORIGIN_MISMATCH');
  });
});
