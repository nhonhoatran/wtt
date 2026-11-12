import { Inject, Injectable, Logger } from '@nestjs/common';
import { authSettings } from '@kamito/shared';
import type { Redis } from 'ioredis';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { REDIS_CONNECTION } from '../queue/redis-connection.provider.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { authRedisKey } from './auth-redis-keys.js';

/** Fixed-window counter of sign-in attempts per real client IP (req.ip, not a client header). */
@Injectable()
export class LoginIpRateLimiter {
  private readonly logger = new Logger(LoginIpRateLimiter.name);

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly settings: AppSettingsService,
  ) {}

  /** Counts one attempt; returns seconds to wait when over the limit, otherwise 0. */
  async hit(ip: string): Promise<number> {
    const [max, windowSeconds] = await Promise.all([
      this.settings.get(authSettings.loginIpMaxAttempts),
      this.settings.get(authSettings.loginIpWindowSeconds),
    ]);
    const key = authRedisKey(this.env.QUEUE_PREFIX, 'login-ip', ip);
    try {
      const results = await this.redis.multi().set(key, 0, 'EX', windowSeconds, 'NX').incr(key).ttl(key).exec();
      const count = Number(results?.[1]?.[1] ?? 0);
      const ttl = Number(results?.[2]?.[1] ?? windowSeconds);
      return count > max ? Math.max(ttl, 1) : 0;
    } catch (error) {
      // Fail open: a Redis outage must not lock every operator out on match day.
      this.logger.error(`login rate limit unavailable: ${(error as Error).message}`);
      return 0;
    }
  }
}
