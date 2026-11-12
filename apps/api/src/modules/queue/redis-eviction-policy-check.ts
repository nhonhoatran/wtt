import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { judgeEvictionPolicy, type EvictionVerdict } from '@kamito/shared';
import { probeRedisEvictionPolicy } from '@kamito/shared/redis-probe';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

/** Checks the policy once at boot; /health/ready reports the cached verdict. */
@Injectable()
export class RedisEvictionPolicyCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisEvictionPolicyCheck.name);
  private verdict: EvictionVerdict | undefined;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<EvictionVerdict> {
    const probe = await probeRedisEvictionPolicy(this.env.REDIS_URL);
    this.verdict = probe.reachable
      ? judgeEvictionPolicy({
          policy: probe.policy,
          appEnv: this.env.APP_ENV,
          override: this.env.REDIS_EVICTION_CHECK_OVERRIDE,
        })
      : { status: 'degraded', policy: undefined, message: `Redis unreachable at boot: ${probe.error}` };
    if (this.verdict.status === 'overridden') this.logger.warn(`${this.verdict.message} (override set)`);
    else if (this.verdict.status !== 'ok') this.logger.error(this.verdict.message);
    return this.verdict;
  }

  current(): EvictionVerdict | undefined {
    return this.verdict;
  }
}
