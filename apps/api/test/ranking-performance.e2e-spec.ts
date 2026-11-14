import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { buildKnockout, playRounds } from './support/ranking-draw-builder.js';
import {
  addEntries,
  addRules,
  cleanupRankingWorld,
  createRankingWorld,
  loadRankingProcessors,
  type RankingDeps,
  type RankingProcessors,
  type RankingWorld,
} from './support/ranking-test-kit.js';

// Targets from the spec: 128-entry recompute < 2 s, 5,000-player snapshot < 10 s. Timings are logged; the hard
// assertions use a wider margin so a busy machine does not make the suite flaky.
const RECOMPUTE_TARGET_MS = 2_000;
const SNAPSHOT_TARGET_MS = 10_000;
const FLAKE_FACTOR = 3;
const PLAYERS = 5_000;

describe('ranking performance (real Postgres)', () => {
  let kit: AuthTestKit;
  let worker: RankingProcessors;
  const worlds: RankingWorld[] = [];
  const deps = (): RankingDeps => ({ prisma: kit.prisma, enqueueRecompute: async () => {} });
  const log = (message: string) => process.stderr.write(`[ranking-perf] ${message}\n`);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    worker = await loadRankingProcessors();
  });
  afterAll(async () => {
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  });

  it('recomputes a played 128-entry draw', async () => {
    const w = await createRankingWorld(kit);
    worlds.push(w);
    await addRules(kit, w, ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'].map((stageCode, i) => ({ stageCode, points: 1000 - i * 100 })));
    const { entryIds } = await addEntries(kit, w, 128);
    const built = await buildKnockout(kit, w, { slots: entryIds, codes: ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'] });
    await playRounds(kit, built, () => 1);

    const started = performance.now();
    await worker.recomputeSubEvent(deps(), w.subEventId);
    const elapsed = Math.round(performance.now() - started);
    log(`recompute 128 entries: ${elapsed} ms (target ${RECOMPUTE_TARGET_MS} ms)`);
    expect(await kit.prisma.rankingPointsEarned.count({ where: { subEventId: w.subEventId } })).toBe(128);
    expect(elapsed).toBeLessThan(RECOMPUTE_TARGET_MS * FLAKE_FACTOR);
  });

  it('builds a snapshot for 5,000 players', async () => {
    const w = await createRankingWorld(kit, { withList: false });
    worlds.push(w);
    const tag = randomUUID().slice(0, 8);
    const players = Array.from({ length: PLAYERS }, (_, i) => ({
      id: randomUUID(), code: `RP${tag}${i}`, slug: `rp-${tag}-${i}`, fullName: `Perf Player ${tag} ${String(i).padStart(5, '0')}`,
      normalizedName: `perf player ${i}`, gender: 'MALE' as const, countryCode: 'VN',
    }));
    await kit.prisma.player.createMany({ data: players });
    w.playerIds.push(...players.map((p) => p.id));
    await kit.prisma.rankingPointsEarned.createMany({
      data: players.map((p, i) => ({
        rankingListId: w.listId, playerId: p.id, source: 'MANUAL' as const, points: 1 + (i % 400), reason: 'sample load data',
        earnedAt: new Date('2099-01-01T00:00:00Z'), expiresAt: new Date('2100-01-01T00:00:00Z'),
      })),
    });

    const started = performance.now();
    const result = await worker.buildSnapshot(deps(), { listId: w.listId, asOf: '2099-06-01' });
    const elapsed = Math.round(performance.now() - started);
    log(`snapshot ${PLAYERS} players: ${elapsed} ms (target ${SNAPSHOT_TARGET_MS} ms)`);
    expect(result).toMatchObject({ outcome: 'built', rows: PLAYERS });
    expect(elapsed).toBeLessThan(SNAPSHOT_TARGET_MS * FLAKE_FACTOR);
  });
});
