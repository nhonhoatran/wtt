import { authSettings } from '@kamito/shared';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_ENV } from '../src/common/config/app-config.module.js';
import type { ApiEnv } from '../src/common/config/env-schema.js';
import { AccountLockoutService } from '../src/modules/auth/account-lockout.service.js';
import { authRedisKey, normalizeEmail } from '../src/modules/auth/auth-redis-keys.js';
import { REDIS_CONNECTION } from '../src/modules/queue/redis-connection.provider.js';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit, randomIp, SIGN_IN, type TestUser } from './support/auth-test-kit.js';

const WRONG_PASSWORD = 'x-123456789';

describe('login hardening: client IP and account lockout backoff (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let settings: AppSettingsService;
  let lockout: AccountLockoutService;
  let redis: Redis;
  let queuePrefix: string;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    settings = kit.app.get(AppSettingsService);
    lockout = kit.app.get(AccountLockoutService);
    redis = kit.app.get<Redis>(REDIS_CONNECTION);
    queuePrefix = kit.app.get<ApiEnv>(API_ENV).QUEUE_PREFIX;
  });

  afterAll(async () => {
    await kit.close();
  });

  it('counts sign-in attempts by the real client IP, ignoring spoofed X-Forwarded-For prefixes', async () => {
    const max = await settings.get(authSettings.loginIpMaxAttempts);
    const realIp = randomIp();
    for (let i = 0; i < max; i += 1) {
      await kit.http
        .post(SIGN_IN)
        .set('Origin', kit.origin)
        .set('X-Forwarded-For', `10.0.0.${i}, ${realIp}`)
        .send({ email: `nobody-${i}@test.kamito.local`, password: WRONG_PASSWORD })
        .expect(401);
    }
    await kit.http
      .post(SIGN_IN)
      .set('Origin', kit.origin)
      .set('X-Forwarded-For', `10.9.9.9, ${realIp}`)
      .send({ email: 'nobody-last@test.kamito.local', password: WRONG_PASSWORD })
      .expect(429);
  });

  it('stores the real client IP on the session, not a spoofed header value', async () => {
    const user = await kit.createUser();
    const realIp = randomIp();
    await kit.http
      .post(SIGN_IN)
      .set('Origin', kit.origin)
      .set('X-Forwarded-For', `10.66.66.66, ${realIp}`)
      .send({ email: user.email, password: user.password })
      .expect(200);
    const session = await kit.prisma.session.findFirst({ where: { userId: user.id }, select: { ipAddress: true } });
    expect(session?.ipAddress).toBe(realIp);
  });

  it('locks for the base time, doubles on the next lock, and unlocks once the lock is gone', async () => {
    const user: TestUser = await kit.createUser();
    const [maxFailures, baseSeconds, maxSeconds] = await Promise.all([
      settings.get(authSettings.lockoutMaxFailures),
      settings.get(authSettings.lockoutBaseSeconds),
      settings.get(authSettings.lockoutMaxSeconds),
    ]);
    const lockKey = authRedisKey(queuePrefix, 'lockout-lock', normalizeEmail(user.email));
    const failMany = async () => {
      for (let i = 0; i < maxFailures; i += 1) {
        await kit.signInRequest(user.email, `wrong-${i}-pass`, randomIp()).expect(401);
      }
    };

    try {
      await failMany();
      const firstTtl = await redis.ttl(lockKey);
      expect(firstTtl).toBeGreaterThan(0);
      expect(firstTtl).toBeLessThanOrEqual(baseSeconds);
      await kit.signInRequest(user.email, user.password, randomIp()).expect(401);

      // Deleting the key stands in for TTL expiry, so the test does not wait out the lock.
      await redis.del(lockKey);
      await failMany();
      const secondTtl = await redis.ttl(lockKey);
      const expected = Math.min(baseSeconds * 2, Math.max(maxSeconds, baseSeconds));
      expect(secondTtl).toBeGreaterThan(baseSeconds);
      expect(secondTtl).toBeLessThanOrEqual(expected);

      await redis.del(lockKey);
      await kit.signInRequest(user.email, user.password, randomIp()).expect(200);
    } finally {
      await lockout.clear(user.email);
    }
  });
});
