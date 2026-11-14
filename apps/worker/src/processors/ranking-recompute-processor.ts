import { advisoryLock } from '@kamito/db';
import { rankingSettings } from '@kamito/shared';
import { loadSubEventRankingInput } from '../ranking/load-sub-event-results.js';
import { RANKING_TX_MAX_WAIT_MS, RANKING_TX_TIMEOUT_MS, type RankingDeps } from '../ranking/ranking-deps.js';
import { computeLedgerDrafts, loadRules, replaceAutoLedgerRows } from '../ranking/write-ledger-rows.js';
import { readSetting } from '../read-setting.js';

export type RecomputeOutcome = 'recomputed' | 'missing';

/**
 * Rebuilds the AUTO ledger rows of one sub-event from the current DB state. Runs are serialised per
 * sub-event by an advisory lock; the dirty mark is cleared only if it is unchanged since the run
 * began, so a change committed meanwhile keeps the sub-event dirty for the next run.
 */
export async function recomputeSubEvent(deps: RankingDeps, subEventId: string): Promise<RecomputeOutcome> {
  const awardPointsOnWalkoverLoss = await readSetting(deps.prisma, rankingSettings.awardPointsOnWalkoverLoss);

  return deps.prisma.$transaction(
    async (tx) => {
      await advisoryLock(tx, `ranking:${subEventId}`);
      // Text round trip keeps the column's own precision and avoids time zone conversion.
      const marks = await tx.$queryRaw<{ dirtyAt: string | null }[]>`
        SELECT "rankingDirtyAt"::text AS "dirtyAt" FROM "SubEvent" WHERE "id" = ${subEventId}`;
      if (!marks[0]) return 'missing';
      const startedDirtyAt = marks[0].dirtyAt;

      const input = await loadSubEventRankingInput(tx, subEventId);
      if (!input) return 'missing';
      const rules = input.list && !input.isCancelled ? await loadRules(tx, input) : [];
      await replaceAutoLedgerRows(tx, input, computeLedgerDrafts(input, rules, { awardPointsOnWalkoverLoss }));

      if (startedDirtyAt) {
        await tx.$executeRaw`
          UPDATE "SubEvent" SET "rankingDirtyAt" = NULL
          WHERE "id" = ${subEventId} AND "rankingDirtyAt" = ${startedDirtyAt}::timestamp`;
      }
      return 'recomputed';
    },
    { timeout: RANKING_TX_TIMEOUT_MS, maxWait: RANKING_TX_MAX_WAIT_MS },
  );
}
