import { Injectable } from '@nestjs/common';
import { validateMatchScore } from '@kamito/competition-engine';
import { AuditService } from '../../common/audit/audit.service.js';
import { isGroupPlaced } from '../draws/groups-placed-guard.js';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { resolveMatchFormat } from '../matches/match-result-view.js';
import type { Prisma } from '@kamito/db';
import type { AmendScoresBody } from './match-result-dtos.js';
import { amendChangesPlacedRanks, matchStateInvalid, scoreInvalid, winnerChanged } from './match-result-errors.js';
import { loadMatchLocked } from './match-lock.js';
import { assertResultEditable, matchSnapshot } from './match-snapshot.js';
import { loadMatchTagContext } from './match-tag-context.js';
import { MatchWriteRunner } from './match-write-runner.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class MatchAmendService {
  constructor(
    private readonly runner: MatchWriteRunner,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
  ) {}

  /** Changes the game scores of an official match without changing who won, so nothing downstream moves. */
  amend(matchId: string, body: AmendScoresBody) {
    return this.runner.run('match.amend', matchId, async (tx) => {
      const m = await loadMatchLocked(tx, this.standings, matchId, body.expectedVersion);
      if (m.status !== 'OFFICIAL') throw matchStateInvalid('Chỉ sửa tỷ số được trận đã chốt kết quả');
      assertResultEditable(m);
      const resultType = m.resultType as 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED';
      const outcome = validateMatchScore({
        games: body.games,
        format: resolveMatchFormat(m),
        resultType,
        winnerSide: resultType === 'NORMAL' ? null : (m.winnerSide as 1 | 2),
      });
      if (!outcome.valid) throw scoreInvalid(outcome.issues);
      if (outcome.winnerSide !== m.winnerSide) throw winnerChanged();

      await tx.game.deleteMany({ where: { matchId } });
      if (body.games.length) {
        await tx.game.createMany({ data: body.games.map((g, i) => ({ matchId, number: i + 1, score1: g.score1, score2: g.score2 })) });
      }
      await tx.match.update({ where: { id: m.id }, data: { games1: outcome.games1, games2: outcome.games2, version: { increment: 1 } } });
      if (m.groupId) await this.recomputeGroup(tx, m.groupId, m.subEventId);

      await this.audit.record(
        {
          action: 'match.amend',
          entity: 'Match',
          entityId: m.id,
          before: matchSnapshot(m),
          after: { games: body.games, games1: outcome.games1, games2: outcome.games2, version: m.version + 1 },
          reason: body.reason,
        },
        tx,
      );
      return { context: await loadMatchTagContext(tx, m), rankingSubEventIds: [m.subEventId] };
    });
  }

  /** Placed groups are frozen into the knockout: new scores may not reshuffle their ranks. */
  private async recomputeGroup(tx: Tx, groupId: string, subEventId: string): Promise<void> {
    if (await isGroupPlaced(tx, subEventId, groupId)) {
      const stored = await tx.groupStanding.findMany({ where: { groupId }, select: { entryId: true, rank: true } });
      const fresh = await this.standings.compute(tx, groupId);
      const rankOf = new Map(stored.map((s) => [s.entryId, s.rank]));
      if (fresh.rows.some((row) => rankOf.get(row.entryId) !== row.rank)) throw amendChangesPlacedRanks();
    }
    await this.standings.recompute(tx, groupId);
  }
}
