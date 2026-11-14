import { rankingSettings } from '@kamito/shared';
import type { RankingDeps } from '../ranking/ranking-deps.js';
import { readSetting } from '../read-setting.js';

const MS_PER_MINUTE = 60_000;

export interface SweepResult {
  found: number;
  enqueued: number;
  failed: number;
}

/** Safety net: re-enqueues sub-events whose dirty mark outlived its job (Redis down, job lost). */
export async function sweepDirtySubEvents(deps: RankingDeps): Promise<SweepResult> {
  const ageMinutes = await readSetting(deps.prisma, rankingSettings.dirtySweepAgeMinutes);
  const cutoff = new Date((deps.now?.() ?? new Date()).getTime() - ageMinutes * MS_PER_MINUTE);
  const stale = await deps.prisma.subEvent.findMany({
    where: { rankingDirtyAt: { not: null, lt: cutoff } },
    select: { id: true },
    orderBy: { rankingDirtyAt: 'asc' },
  });

  let enqueued = 0;
  let failed = 0;
  for (const { id } of stale) {
    try {
      await deps.enqueueRecompute(id);
      enqueued += 1;
    } catch {
      failed += 1;
    }
  }
  // Failing the job makes BullMQ retry it; the next scheduled sweep would catch the remainder anyway.
  if (failed) throw new Error(`dirty sweep: ${failed} of ${stale.length} enqueue(s) failed`);
  return { found: stale.length, enqueued, failed };
}
