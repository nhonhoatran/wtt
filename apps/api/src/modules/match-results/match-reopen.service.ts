import { Injectable } from '@nestjs/common';
import type { ImpactCell, ReopenImpact } from '@kamito/competition-engine';
import type { Prisma } from '@kamito/db';
import type { UserRoleName } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { MATCH_DETAIL_INCLUDE, type MatchDetailRow } from '../matches/match-result-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReopenMatchBody } from './match-result-dtos.js';
import { forceReopenAdminOnly, matchNotFound, matchStateInvalid, reopenBlocked, reopenImpactChanged } from './match-result-errors.js';
import { loadMatchLockedAcrossDraws } from './match-lock.js';
import { applyReopenCells } from './reopen-apply.js';
import { loadReopenImpact } from './reopen-impact-loader.js';
import { matchSnapshot } from './match-snapshot.js';
import { loadMatchTagContext } from './match-tag-context.js';
import { MatchWriteRunner } from './match-write-runner.js';

type Tx = Prisma.TransactionClient;

export interface ReopenCellView {
  matchId: string;
  matchNo: number;
  side: 1 | 2;
  entryId: string;
  entryName: string;
  status: string;
  effect: ImpactCell['effect'];
  /** ADVANCE: the winner sits in a later match; SEAT: in a qualifier slot or group place of the main draw. */
  via: 'ADVANCE' | 'SEAT';
}

export interface ReopenPreview {
  affected: ReopenCellView[];
  blocking: ReopenCellView[];
}

function assertReopenable(m: MatchDetailRow): void {
  if (m.status !== 'OFFICIAL') throw matchStateInvalid('Chỉ mở lại được trận đã chốt kết quả');
  if (m.resultType === 'BYE') throw matchStateInvalid('Trận BYE không mở lại được');
  if (m.isVoided) throw matchStateInvalid('Trận đã hủy do VĐV rút khỏi bảng');
  if (m.resultType === 'WALKOVER' && m.officialById === null) throw matchStateInvalid('Trận xử thắng tự động do VĐV rút không mở lại được');
}

@Injectable()
export class MatchReopenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: MatchWriteRunner,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
  ) {}

  /** Read-only view of what a reopen would touch; `reopen` recomputes it under the locks. */
  async preview(matchId: string) {
    const data = await this.prisma.$transaction(async (tx) => {
      const m = await tx.match.findUnique({ where: { id: matchId }, include: MATCH_DETAIL_INCLUDE });
      if (!m) throw matchNotFound();
      assertReopenable(m);
      return this.toPreview(tx, (await loadReopenImpact(tx, m)).impact);
    });
    return { data };
  }

  reopen(matchId: string, body: ReopenMatchBody, actor: { role: UserRoleName }) {
    return this.runner.run('match.reopen', matchId, async (tx) => {
      const m = await loadMatchLockedAcrossDraws(tx, matchId, body.expectedVersion);
      assertReopenable(m);
      const { impact, matches } = await loadReopenImpact(tx, m);
      const preview = await this.toPreview(tx, impact);
      const forced = impact.blocking.length > 0;
      if (body.force) {
        const fresh = [...new Set(impact.blocking.map((c) => c.matchId))].sort();
        const seen = [...new Set(body.expectedBlockingIds ?? [])].sort();
        if (fresh.length !== seen.length || fresh.some((id, i) => id !== seen[i])) throw reopenImpactChanged(preview);
      }
      if (forced && !body.force) throw reopenBlocked(preview);
      if (forced && actor.role !== 'ADMIN') throw forceReopenAdminOnly();

      const reset = await applyReopenCells(tx, impact.cells, matches);
      await tx.match.update({
        where: { id: m.id },
        data: { status: 'LIVE', resultType: null, winnerSide: null, games1: null, games2: null, officialAt: null, officialById: null, version: { increment: 1 } },
      });
      if (m.groupId) await this.standings.recompute(tx, m.groupId);

      for (const r of reset) {
        await this.audit.record({ action: 'match.resetByReopen', entity: 'Match', entityId: r.matchId, before: r.before, reason: body.reason, after: { status: 'SCHEDULED', reopenedMatchId: m.id } }, tx);
      }
      await this.audit.record(
        {
          action: forced ? 'match.forceReopen' : 'match.reopen',
          entity: 'Match',
          entityId: m.id,
          before: matchSnapshot(m),
          after: { status: 'LIVE', version: m.version + 1, preview, reset },
          reason: body.reason,
        },
        tx,
      );
      const touched = impact.cells.map((c) => matches.get(c.matchId)!);
      const entryIds = touched.flatMap((t) => [t.side1EntryId, t.side2EntryId]).filter((id): id is string => Boolean(id));
      const context = await loadMatchTagContext(tx, m, touched.map((t) => t.matchNo), entryIds);
      return { context, rankingSubEventIds: [m.subEventId], extra: { impact: preview } };
    });
  }

  private async toPreview(tx: Tx, impact: ReopenImpact): Promise<ReopenPreview> {
    const entries = await tx.entry.findMany({
      where: { id: { in: [...new Set(impact.cells.map((c) => c.entryId))] } },
      select: { id: true, competitor: { select: { displayName: true } } },
    });
    const names = new Map(entries.map((e) => [e.id, e.competitor.displayName]));
    const view = (c: ImpactCell): ReopenCellView => ({
      matchId: c.matchId,
      matchNo: c.matchNo,
      side: c.side,
      entryId: c.entryId,
      entryName: names.get(c.entryId) ?? '',
      status: c.status,
      effect: c.effect,
      via: c.seat ? 'SEAT' : 'ADVANCE',
    });
    return { affected: impact.affected.map(view), blocking: impact.blocking.map(view) };
  }
}
