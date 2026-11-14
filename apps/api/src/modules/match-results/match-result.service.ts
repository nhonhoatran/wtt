import { Injectable } from '@nestjs/common';
import { validateMatchScore } from '@kamito/competition-engine';
import type { Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { MatchQueryService } from '../matches/match-query.service.js';
import { isPendingWalkover, resolveMatchFormat, type MatchDetailRow } from '../matches/match-result-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS, type MatchTagContext } from '../revalidation/cache-tags.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { advanceWinner } from './bracket-advance.js';
import type { ConfirmMatchBody } from './match-result-dtos.js';
import { matchNotReady, matchStateInvalid, scoreInvalid } from './match-result-errors.js';
import { loadMatchLocked } from './match-lock.js';
import { loadMatchTagContext } from './match-tag-context.js';

type Tx = Prisma.TransactionClient;
type MatchMutation = 'match.start' | 'match.confirm';
interface WriteOutcome {
  context: MatchTagContext;
  rankingDirty: string[];
}

const snapshot = (m: MatchDetailRow) => ({
  status: m.status,
  resultType: m.resultType,
  winnerSide: m.winnerSide,
  games1: m.games1,
  games2: m.games2,
  games: m.games,
  version: m.version,
});

function assertReady(m: MatchDetailRow): void {
  if (m.resultType === 'BYE') throw matchStateInvalid('Trận BYE không nhập kết quả');
  if (m.isVoided) throw matchStateInvalid('Trận đã hủy do VĐV rút khỏi bảng');
  if (isPendingWalkover(m)) throw matchNotReady('Trận đang chờ xử thắng do đối thủ không đến');
  if (!m.side1EntryId || !m.side2EntryId) throw matchNotReady();
}

@Injectable()
export class MatchResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
    private readonly query: MatchQueryService,
    private readonly revalidation: RevalidationEnqueueService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  start(matchId: string, expectedVersion: number) {
    return this.write('match.start', matchId, async (tx) => {
      const m = await loadMatchLocked(tx, this.standings, matchId, expectedVersion);
      if (m.status !== 'SCHEDULED') throw matchStateInvalid('Chỉ bắt đầu được trận chưa đấu');
      assertReady(m);
      await tx.match.update({ where: { id: m.id }, data: { status: 'LIVE', startedAt: new Date(), version: { increment: 1 } } });
      await this.audit.record({ action: 'match.start', entity: 'Match', entityId: m.id, before: snapshot(m), after: { status: 'LIVE', version: m.version + 1 } }, tx);
      return { context: await loadMatchTagContext(tx, m), rankingDirty: [] };
    });
  }

  confirm(matchId: string, body: ConfirmMatchBody, actorUserId: string) {
    return this.write('match.confirm', matchId, async (tx) => {
      const m = await loadMatchLocked(tx, this.standings, matchId, body.expectedVersion);
      if (m.status === 'OFFICIAL') throw matchStateInvalid('Trận đã chốt kết quả');
      assertReady(m);
      const outcome = validateMatchScore({ games: body.games, format: resolveMatchFormat(m), resultType: body.resultType, winnerSide: body.winnerSide ?? null });
      if (!outcome.valid || !outcome.winnerSide) throw scoreInvalid(outcome.issues);

      const now = new Date();
      await tx.game.deleteMany({ where: { matchId } });
      if (body.games.length) {
        await tx.game.createMany({ data: body.games.map((g, i) => ({ matchId, number: i + 1, score1: g.score1, score2: g.score2 })) });
      }
      const result = { resultType: body.resultType, winnerSide: outcome.winnerSide, games1: outcome.games1, games2: outcome.games2 };
      await tx.match.update({
        where: { id: matchId },
        data: { ...result, status: 'OFFICIAL', startedAt: m.startedAt ?? now, officialAt: now, officialById: actorUserId, version: { increment: 1 } },
      });

      const winnerEntryId = (outcome.winnerSide === 1 ? m.side1EntryId : m.side2EntryId) as string;
      const advanced = m.groupId ? [] : await advanceWinner(tx, m, winnerEntryId);
      if (m.groupId) await this.standings.recompute(tx, m.groupId);

      const after = { ...result, status: 'OFFICIAL', games: body.games, version: m.version + 1, advancedMatchNos: advanced };
      await this.audit.record({ action: 'match.confirm', entity: 'Match', entityId: m.id, before: snapshot(m), after }, tx);
      const rankingDirty = await markRankingDirty(tx, [m.subEventId]);
      return { context: await loadMatchTagContext(tx, m, advanced), rankingDirty };
    });
  }

  /** Runs the locked write, then reads the fresh detail and queues cache invalidation and ranking recompute after commit. */
  private async write(mutation: MatchMutation, matchId: string, run: (tx: Tx) => Promise<WriteOutcome>) {
    const { context, rankingDirty } = await this.prisma.$transaction(run, { timeout: 30_000 });
    const data = await this.query.detail(matchId);
    const warnings = [...(await this.revalidation.enqueue(() => CACHE_TAGS[mutation](context))), ...(await this.ranking.enqueueRecompute(rankingDirty))];
    return { data, ...(warnings.length > 0 && { warnings }) };
  }
}
