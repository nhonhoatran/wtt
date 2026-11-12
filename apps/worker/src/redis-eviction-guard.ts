import { judgeEvictionPolicy, type EvictionVerdict } from '@kamito/shared';
import { probeRedisEvictionPolicy } from '@kamito/shared/redis-probe';
import type { WorkerEnv } from './worker-env.js';

export async function checkRedisEvictionPolicy(env: WorkerEnv): Promise<EvictionVerdict> {
  const probe = await probeRedisEvictionPolicy(env.REDIS_URL);
  if (!probe.reachable) {
    return { status: 'fatal', policy: undefined, message: `Redis unreachable at boot: ${probe.error}` };
  }
  return judgeEvictionPolicy({ policy: probe.policy, appEnv: env.APP_ENV, override: env.REDIS_EVICTION_CHECK_OVERRIDE });
}
