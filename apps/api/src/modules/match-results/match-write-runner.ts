import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { MatchQueryService } from '../matches/match-query.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { CACHE_TAGS, type MatchTagContext } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';

type Tx = Prisma.TransactionClient;
/** Fixed on purpose (internal reliability knob, not an operational setting): a match write holds draw and group locks, so a stuck transaction must give up well before a client retries. */
export const MATCH_WRITE_TIMEOUT_MS = 30_000;

export type MatchMutation = 'match.start' | 'match.unStart' | 'match.saveProgress' | 'match.confirm' | 'match.amend' | 'match.reopen';

export interface WriteOutcome {
  context: MatchTagContext;
  /** Sub-events to flag for ranking recompute; empty when the write cannot change points. */
  rankingSubEventIds: string[];
  /** Extra response fields next to `data`. */
  extra?: object;
}

/** Runs a locked match write, then reads the fresh detail and queues cache invalidation and ranking recompute after commit. */
@Injectable()
export class MatchWriteRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: MatchQueryService,
    private readonly revalidation: RevalidationEnqueueService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  async run(mutation: MatchMutation, matchId: string, work: (tx: Tx) => Promise<WriteOutcome>) {
    const { context, rankingSubEventIds, extra } = await this.prisma.$transaction(
      async (tx) => {
        const outcome = await work(tx);
        return { ...outcome, rankingSubEventIds: await markRankingDirty(tx, outcome.rankingSubEventIds) };
      },
      { timeout: MATCH_WRITE_TIMEOUT_MS },
    );
    const data = await this.query.detail(matchId);
    const warnings = [...(await this.revalidation.enqueue(() => CACHE_TAGS[mutation](context))), ...(await this.ranking.enqueueRecompute(rankingSubEventIds))];
    return { data, ...extra, ...(warnings.length > 0 && { warnings }) };
  }
}
