import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CONNECTION, redisConnectionProvider } from './redis-connection.provider.js';
import { RedisEvictionPolicyCheck } from './redis-eviction-policy-check.js';

@Global()
@Module({
  providers: [redisConnectionProvider, RedisEvictionPolicyCheck],
  exports: [REDIS_CONNECTION, RedisEvictionPolicyCheck],
})
export class QueueModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
