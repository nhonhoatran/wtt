import { Injectable } from '@nestjs/common';
import { validateProgressGames } from '@kamito/competition-engine';
import { AuditService } from '../../common/audit/audit.service.js';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { resolveMatchFormat } from '../matches/match-result-view.js';
import type { SaveProgressBody } from './match-result-dtos.js';
import { matchStateInvalid, scoreInvalid } from './match-result-errors.js';
import { loadMatchLocked } from './match-lock.js';
import { matchSnapshot } from './match-snapshot.js';
import { loadMatchTagContext } from './match-tag-context.js';
import { MatchWriteRunner } from './match-write-runner.js';

@Injectable()
export class MatchProgressService {
  constructor(
    private readonly runner: MatchWriteRunner,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
  ) {}

  /** Undo of a mistaken start: back to SCHEDULED; the saved games are dropped but kept in the audit row. */
  unStart(matchId: string, expectedVersion: number) {
    return this.runner.run('match.unStart', matchId, async (tx) => {
      const m = await loadMatchLocked(tx, this.standings, matchId, expectedVersion);
      if (m.status !== 'LIVE') throw matchStateInvalid('Chỉ hủy bắt đầu được trận đang đấu');
      await tx.game.deleteMany({ where: { matchId } });
      await tx.match.update({ where: { id: m.id }, data: { status: 'SCHEDULED', startedAt: null, version: { increment: 1 } } });
      await this.audit.record(
        { action: 'match.unStart', entity: 'Match', entityId: m.id, before: matchSnapshot(m), after: { status: 'SCHEDULED', version: m.version + 1 } },
        tx,
      );
      return { context: await loadMatchTagContext(tx, m), rankingSubEventIds: [] };
    });
  }

  saveProgress(matchId: string, body: SaveProgressBody) {
    return this.runner.run('match.saveProgress', matchId, async (tx) => {
      const m = await loadMatchLocked(tx, this.standings, matchId, body.expectedVersion);
      if (m.status !== 'LIVE') throw matchStateInvalid('Chỉ lưu tạm được trận đang đấu');
      const issues = validateProgressGames(body.games, resolveMatchFormat(m));
      if (issues.length) throw scoreInvalid(issues);

      await tx.game.deleteMany({ where: { matchId } });
      if (body.games.length) {
        await tx.game.createMany({ data: body.games.map((g, i) => ({ matchId, number: i + 1, score1: g.score1, score2: g.score2 })) });
      }
      await tx.match.update({ where: { id: m.id }, data: { version: { increment: 1 } } });
      await this.audit.record(
        { action: 'match.saveProgress', entity: 'Match', entityId: m.id, before: { games: m.games, version: m.version }, after: { games: body.games, version: m.version + 1 } },
        tx,
      );
      return { context: await loadMatchTagContext(tx, m), rankingSubEventIds: [] };
    });
  }
}
