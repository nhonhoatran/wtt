import { Inject, Injectable, Logger } from '@nestjs/common';
import { authSettings } from '@kamito/shared';
import type { Redis } from 'ioredis';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { REDIS_CONNECTION } from '../queue/redis-connection.provider.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { authRedisKey, normalizeEmail } from './auth-redis-keys.js';

// How long a lock level is remembered for the doubling backoff.
const LOCK_LEVEL_MEMORY_SECONDS = 24 * 60 * 60;

// Atomic so concurrent failures cannot skip lock levels or slip past an existing lock.
// KEYS: fail, lock, lock-level. ARGV: maxFailures, baseSeconds, maxSeconds, levelMemorySeconds.
const RECORD_FAILURE_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local fails = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
if fails < tonumber(ARGV[1]) then return 0 end
local level = redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[3], ARGV[4])
local seconds = math.min(tonumber(ARGV[2]) * 2 ^ (level - 1), tonumber(ARGV[3]))
redis.call('SET', KEYS[2], '1', 'EX', math.floor(seconds))
redis.call('DEL', KEYS[1])
return 1
`;

/** Temporary per-account lock after repeated wrong passwords, from any IP, with doubling backoff. */
@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly settings: AppSettingsService,
  ) {}

  async isLocked(email: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.key('lock', email))) === 1;
    } catch (error) {
      this.logger.error(`lockout check unavailable: ${(error as Error).message}`);
      return false;
    }
  }

  async recordFailure(email: string): Promise<void> {
    const [maxFailures, baseSeconds, maxSeconds] = await Promise.all([
      this.settings.get(authSettings.lockoutMaxFailures),
      this.settings.get(authSettings.lockoutBaseSeconds),
      this.settings.get(authSettings.lockoutMaxSeconds),
    ]);
    try {
      await this.redis.eval(
        RECORD_FAILURE_SCRIPT,
        3,
        this.key('fail', email),
        this.key('lock', email),
        this.key('lock-level', email),
        maxFailures,
        baseSeconds,
        Math.max(maxSeconds, baseSeconds),
        LOCK_LEVEL_MEMORY_SECONDS,
      );
    } catch (error) {
      this.logger.error(`lockout record unavailable: ${(error as Error).message}`);
    }
  }

  /** Called on successful sign-in and when an ADMIN resets or re-activates the account. */
  async clear(email: string): Promise<void> {
    try {
      await this.redis.del(this.key('fail', email), this.key('lock', email), this.key('lock-level', email));
    } catch (error) {
      this.logger.error(`lockout clear unavailable: ${(error as Error).message}`);
    }
  }

  private key(kind: string, email: string): string {
    return authRedisKey(this.env.QUEUE_PREFIX, `lockout-${kind}`, normalizeEmail(email));
  }
}
