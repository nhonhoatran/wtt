import { Inject, Injectable } from '@nestjs/common';
import { findPendingMigrations } from '@kamito/db';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CONNECTION } from '../queue/redis-connection.provider.js';
import { RedisEvictionPolicyCheck } from '../queue/redis-eviction-policy-check.js';
import { OBJECT_STORAGE } from '../storage/object-storage.provider.js';

export type CheckStatus = 'up' | 'down' | 'degraded';
export interface CheckResult {
  status: CheckStatus;
  detail?: string;
}

const CHECK_TIMEOUT_MS = 3000;

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function probe(work: () => Promise<CheckResult | void>): Promise<CheckResult> {
  try {
    return (await withTimeout(work())) ?? { status: 'up' };
  } catch (error) {
    return { status: 'down', detail: error instanceof Error ? error.message : 'unknown error' };
  }
}

@Injectable()
export class ReadinessChecksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly eviction: RedisEvictionPolicyCheck,
  ) {}

  async runAll(): Promise<Record<string, CheckResult>> {
    const [database, migrations, redis, storage] = await Promise.all([
      probe(async () => void (await this.prisma.$queryRaw`SELECT 1`)),
      probe(async () => {
        const pending = await findPendingMigrations(this.prisma);
        return pending.length ? { status: 'down', detail: `pending: ${pending.join(', ')}` } : undefined;
      }),
      probe(async () => {
        await this.redis.ping();
        const verdict = this.eviction.current();
        if (!verdict || verdict.status === 'ok') return undefined;
        return { status: verdict.status === 'fatal' ? 'down' : 'degraded', detail: verdict.message };
      }),
      probe(() => this.storage.ping()),
    ]);
    return { database, migrations, redis, storage };
  }
}
