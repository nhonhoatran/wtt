import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { BullBoardQueues } from './bull-board-mount.js';
import { REDIS_CONNECTION, redisConnectionProvider } from './redis-connection.provider.js';
import { RedisEvictionPolicyCheck } from './redis-eviction-policy-check.js';

@Global()
@Module({
  providers: [redisConnectionProvider, RedisEvictionPolicyCheck, BullBoardQueues],
  exports: [REDIS_CONNECTION, RedisEvictionPolicyCheck, BullBoardQueues],
})
export class QueueModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
