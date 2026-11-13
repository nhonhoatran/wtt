import { afterEach, describe, expect, it } from 'vitest';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { CACHE_TAGS } from './cache-tags.js';
import { PUBLIC_REFRESH_DELAYED, RevalidationEnqueueService } from './revalidation-enqueue.service.js';

const deadRedis = { REDIS_URL: 'redis://127.0.0.1:1', QUEUE_PREFIX: 'kamito-tt:test' } as ApiEnv;

describe('RevalidationEnqueueService', () => {
  let service: RevalidationEnqueueService | undefined;
  afterEach(async () => {
    await service?.onModuleDestroy().catch(() => undefined);
  });

  it('returns a warning instead of throwing when Redis is unreachable', async () => {
    service = new RevalidationEnqueueService(deadRedis);
    const started = Date.now();
    await expect(service.enqueue(() => ['events'])).resolves.toEqual([PUBLIC_REFRESH_DELAYED]);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('turns a tag that cannot be built into a warning', async () => {
    service = new RevalidationEnqueueService(deadRedis);
    const context = { eventSlug: 'bad slug', subEventCode: 'MS', matchNos: [1], isGroupMatch: false, playerSlugs: [] };
    await expect(service.enqueue(() => CACHE_TAGS['match.confirm'](context))).resolves.toEqual([PUBLIC_REFRESH_DELAYED]);
  });
});

describe('CACHE_TAGS', () => {
  it('maps a confirmed group match to event, schedule, draw, groups, match, strip and player tags', () => {
    const tags = CACHE_TAGS['match.confirm']({ eventSlug: 'giai-2026', subEventCode: 'MS', matchNos: [5, 9], isGroupMatch: true, playerSlugs: ['nguyen-a'] });
    expect(tags).toEqual([
      'event-giai-2026',
      'schedule-giai-2026',
      'draw-giai-2026-MS',
      'groups-giai-2026-MS',
      'match-giai-2026-5',
      'match-giai-2026-9',
      'results-strip',
      'player-nguyen-a',
    ]);
  });
});
