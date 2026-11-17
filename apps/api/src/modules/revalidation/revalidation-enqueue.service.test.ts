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

  it('turns a failing async tag builder (context lookup) into a warning', async () => {
    service = new RevalidationEnqueueService(deadRedis);
    await expect(
      service.enqueue(async () => {
        throw new Error('db down');
      }),
    ).resolves.toEqual([PUBLIC_REFRESH_DELAYED]);
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

  it('invalidates both the old and the new slug when an event is renamed', () => {
    const tags = CACHE_TAGS['event.update']({ eventSlugs: ['cu', 'moi'], subEventCodes: ['MS'] });
    expect(tags).toEqual(['events', 'event-cu', 'schedule-cu', 'draw-cu-MS', 'groups-cu-MS', 'event-moi', 'schedule-moi', 'draw-moi-MS', 'groups-moi-MS']);
  });

  it('maps a sub-event change to its event, schedule, draw and groups tags for old and new code', () => {
    expect(CACHE_TAGS['subEvent.update']({ eventSlug: 'g', subEventCodes: ['MS', 'MS2'] })).toEqual([
      'event-g',
      'schedule-g',
      'draw-g-MS',
      'groups-g-MS',
      'draw-g-MS2',
      'groups-g-MS2',
    ]);
  });

  it('maps an entry change to event, draw, groups and player tags only', () => {
    expect(CACHE_TAGS['entry.bulk']({ eventSlug: 'g', subEventCodes: ['MS'], playerSlugs: ['a', 'b'] })).toEqual(['event-g', 'draw-g-MS', 'groups-g-MS', 'player-a', 'player-b']);
  });

  it('maps a player merge to the players list, both profiles and the entered events', () => {
    const tags = CACHE_TAGS['player.merge']({ playerSlugs: ['a', 'b'], events: [{ eventSlug: 'g', subEventCodes: ['MS'], matchNos: [3, 8] }] });
    expect(tags).toEqual(['players', 'rankings', 'player-a', 'player-b', 'event-g', 'draw-g-MS', 'groups-g-MS', 'schedule-g', 'match-g-3', 'match-g-8']);
  });

  it('adds the results strip and match pages to publish, unpublish and cancel flips only', () => {
    const context = { eventSlugs: ['g'], subEventCodes: ['MS'], matchNos: [4] };
    for (const key of ['event.publish', 'event.unpublish', 'event.cancel', 'event.uncancel'] as const) {
      expect(CACHE_TAGS[key](context)).toEqual(expect.arrayContaining(['results-strip', 'match-g-4']));
    }
    expect(CACHE_TAGS['event.update'](context)).not.toContain('results-strip');
  });
});
