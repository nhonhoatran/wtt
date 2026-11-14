import { Injectable } from '@nestjs/common';
import { validateMatchScore } from '@kamito/competition-engine';
import { AuditService } from '../../common/audit/audit.service.js';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { isPendingWalkover, resolveMatchFormat, type MatchDetailRow } from '../matches/match-result-view.js';
import { advanceWinner } from './bracket-advance.js';
import type { ConfirmMatchBody } from './match-result-dtos.js';
import { matchNotReady, matchStateInvalid, scoreInvalid } from './match-result-errors.js';
import { loadMatchLocked } from './match-lock.js';
import { assertResultEditable, matchSnapshot } from './match-snapshot.js';
import { loadMatchTagContext } from './match-tag-context.js';
import { MatchWriteRunner } from './match-write-runner.js';

function assertReady(m: MatchDetailRow): void {
  assertResultEditable(m);
  if (isPendingWalkover(m)) throw matchNotReady('Trận đang chờ xử thắng do đối thủ không đến');
  if (!m.side1EntryId || !m.side2EntryId) throw matchNotReady();
}

@Injectable()
export class MatchResultService {
  constructor(
    private readonly runner: MatchWriteRunner,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
  ) {}

  start(matchId: string, expectedVersion: number) {
    return this.runner.run('match.start', matchId, async (tx) => {
      const m = await loadMatchLocked(tx, this.standings, matchId, expectedVersion);
      if (m.status !== 'SCHEDULED') throw matchStateInvalid('Chỉ bắt đầu được trận chưa đấu');
      assertReady(m);
      await tx.match.update({ where: { id: m.id }, data: { status: 'LIVE', startedAt: new Date(), version: { increment: 1 } } });
      await this.audit.record({ action: 'match.start', entity: 'Match', entityId: m.id, before: matchSnapshot(m), after: { status: 'LIVE', version: m.version + 1 } }, tx);
      return { context: await loadMatchTagContext(tx, m), rankingSubEventIds: [] };
    });
  }

  confirm(matchId: string, body: ConfirmMatchBody, actorUserId: string) {
    return this.runner.run('match.confirm', matchId, async (tx) => {
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
      const advanced = m.groupId ? { matchNos: [], entryIds: [] } : await advanceWinner(tx, m, winnerEntryId);
      if (m.groupId) await this.standings.recompute(tx, m.groupId);

      const after = { ...result, status: 'OFFICIAL', games: body.games, version: m.version + 1, advancedMatchNos: advanced.matchNos };
      await this.audit.record({ action: 'match.confirm', entity: 'Match', entityId: m.id, before: matchSnapshot(m), after }, tx);
      return { context: await loadMatchTagContext(tx, m, advanced.matchNos, advanced.entryIds), rankingSubEventIds: [m.subEventId] };
    });
  }
}
