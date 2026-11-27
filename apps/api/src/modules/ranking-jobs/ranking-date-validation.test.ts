import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingPointsManualService } from '../ranking-points/ranking-points-manual.service.js';
import { RankingRulesSaveService } from '../ranking-rules/ranking-rules-save.service.js';
import { RankingSnapshotDraftsService } from '../ranking-snapshots/ranking-snapshot-drafts.service.js';
import { RankingSnapshotPublishService } from '../ranking-snapshots/ranking-snapshot-publish.service.js';
import { rankingToday } from './ranking-today.js';

const settings = { get: async () => 'Asia/Ho_Chi_Minh' };
const validation = (field: string) => ({ status: 422, response: { fields: { [field]: expect.any(String) } } });

describe('ranking mutation date boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // UTC still says the 26th; the configured business day is already the 27th.
    vi.setSystemTime(new Date('2026-11-26T18:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('takes today from the configured timezone, including midnight and DST boundaries', async () => {
    expect(await rankingToday(settings as never)).toBe('2026-11-27');
    const berlin = { get: async () => 'Europe/Berlin' };
    expect(await rankingToday(berlin as never, new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29');
    expect(await rankingToday(berlin as never, new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
  });

  it('rejects retroactive rules before starting a transaction', async () => {
    const prisma = { $transaction: vi.fn(async () => ({ recompute: [] })) };
    const service = Reflect.construct(RankingRulesSaveService, [prisma, {}, { enqueueRecompute: async () => [] }, { enqueue: async () => [] }, settings]) as RankingRulesSaveService;
    await expect(service.save({ competitorKind: 'SINGLES', drawKind: 'MAIN', effectiveFrom: '2026-11-26', cells: [] }, 'actor')).rejects.toMatchObject(validation('effectiveFrom'));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['2026-11-27', '2026-11-28'])('allows rules taking effect on %s', async (effectiveFrom) => {
    const prisma = { $transaction: vi.fn(async () => ({ recompute: [] })) };
    const service = Reflect.construct(RankingRulesSaveService, [prisma, {}, { enqueueRecompute: async () => [] }, { enqueue: async () => [] }, settings]) as RankingRulesSaveService;
    await expect(service.save({ competitorKind: 'SINGLES', drawKind: 'MAIN', effectiveFrom, cells: [] }, 'actor')).resolves.toMatchObject({ data: { effectiveFrom } });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('rejects future manual points before writing anything', async () => {
    const prisma = { $transaction: vi.fn(async () => ({})) };
    const service = new RankingPointsManualService(prisma as never, {} as never, settings as never);
    await expect(service.create({ rankingListId: 'list', playerId: 'player', points: 1, reason: 'test history', earnedAt: '2026-11-28' }, 'actor')).rejects.toMatchObject(validation('earnedAt'));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, '2026-11-26', '2026-11-27'])('allows manual points earned at %s', async (earnedAt) => {
    const prisma = { $transaction: vi.fn(async () => ({})) };
    const service = new RankingPointsManualService(prisma as never, {} as never, settings as never);
    await service.create({ rankingListId: 'list', playerId: 'player', points: 1, reason: 'test history', earnedAt }, 'actor');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('rejects a future snapshot before reading lists or enqueueing jobs', async () => {
    const prisma = { rankingList: { findMany: vi.fn(async () => [{ id: 'list', code: 'L' }]) } };
    const enqueuer = { enqueueSnapshot: vi.fn(async () => 'job') };
    const service = new RankingSnapshotDraftsService(prisma as never, enqueuer as never, settings as never);
    await expect(service.create({ listIds: ['list'], asOfDate: '2026-11-28' })).rejects.toMatchObject(validation('asOfDate'));
    expect(prisma.rankingList.findMany).not.toHaveBeenCalled();
    expect(enqueuer.enqueueSnapshot).not.toHaveBeenCalled();
  });

  it.each([undefined, '2026-11-26', '2026-11-27'])('queues a snapshot at %s using the business date default', async (asOfDate) => {
    const prisma = { rankingList: { findMany: async () => [{ id: 'list', code: 'L' }] } };
    const enqueuer = { enqueueSnapshot: vi.fn(async () => 'job') };
    const service = new RankingSnapshotDraftsService(prisma as never, enqueuer as never, settings as never);
    await service.create({ listIds: ['list'], asOfDate });
    expect(enqueuer.enqueueSnapshot).toHaveBeenCalledWith('list', asOfDate ?? '2026-11-27');
  });

  it('refuses publication of a future draft created before the API guard existed', async () => {
    const tx = {
      $queryRaw: async () => [{ id: 'snapshot' }],
      rankingSnapshot: { findUniqueOrThrow: async () => ({ id: 'snapshot', status: 'DRAFT', rankingListId: 'list', asOfDate: new Date('2026-11-28T00:00:00Z'), rankingList: { code: 'L' } }), update: vi.fn() },
      subEvent: { findMany: vi.fn(async () => []) },
    };
    const prisma = { $transaction: async (run: (value: unknown) => Promise<unknown>) => run(tx) };
    const service = Reflect.construct(RankingSnapshotPublishService, [prisma, {}, {}, settings]) as RankingSnapshotPublishService;
    await expect(service.publish('snapshot', 'actor')).rejects.toMatchObject(validation('asOfDate'));
    expect(tx.subEvent.findMany).not.toHaveBeenCalled();
    expect(tx.rankingSnapshot.update).not.toHaveBeenCalled();
  });
});
