import { Injectable } from '@nestjs/common';
import { DrawParamsError, planGroupWithdrawal, type WithdrawalPolicy } from '@kamito/competition-engine';
import { lockGroups, type Draw, type Prisma } from '@kamito/db';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { conflict, engineToHttp, invalid } from './draw-errors.js';
import type { RawImpact } from './draw-impact.js';
import { assertGroupsNotPlaced } from './groups-placed-guard.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class GroupWithdrawalService {
  constructor(private readonly standings: GroupStandingsService) {}

  /** Applies GroupScoringRule.withdrawalPolicy to the entry's group matches, then recomputes the table. */
  async withdraw(tx: Tx, draw: Draw, entryId: string): Promise<RawImpact[]> {
    const member = await tx.groupMember.findFirst({ where: { entryId, group: { drawId: draw.id } }, include: { group: true } });
    if (!member) throw invalid('ENTRY_NOT_IN_DRAW', 'VĐV không nằm trong nhánh này');
    const { group } = member;

    await assertGroupsNotPlaced(tx, draw.subEventId, 'Các bảng đã xếp vào nhánh chính, hãy rút VĐV ở nhánh chính');

    await lockGroups(tx, draw.id);
    const subEvent = await tx.subEvent.findUniqueOrThrow({ where: { id: draw.subEventId }, select: { groupScoringRule: true } });
    const rule = subEvent.groupScoringRule ?? (await tx.groupScoringRule.findFirst({ where: { isDefault: true, isActive: true } }));
    const matches = await tx.match.findMany({
      where: { groupId: group.id },
      include: { round: { select: { code: true } } },
    });
    const own = matches.filter((m) => !m.isVoided && (m.side1EntryId === entryId || m.side2EntryId === entryId));
    const live = own.find((m) => m.status === 'LIVE');
    if (live) throw conflict('MATCH_IN_PROGRESS', `Trận #${live.matchNo} đang diễn ra, hãy kết thúc trận trước khi rút VĐV`);

    let plan;
    try {
      plan = planGroupWithdrawal(
        entryId,
        matches.map((m) => ({ id: m.id, side1EntryId: m.side1EntryId as string, side2EntryId: m.side2EntryId as string, status: m.status, isVoided: m.isVoided })),
        (rule?.withdrawalPolicy ?? null) as WithdrawalPolicy | null,
      );
    } catch (error) {
      if (error instanceof DrawParamsError && error.code === 'WITHDRAWAL_POLICY_MISSING') {
        throw conflict('WITHDRAWAL_POLICY_MISSING', 'Chưa chọn cách xử lý khi VĐV rút lui giữa bảng. Chọn trong luật tính điểm bảng rồi thử lại');
      }
      throw engineToHttp(error);
    }

    const byId = new Map(matches.map((m) => [m.id, m]));
    const impacts: RawImpact[] = [];
    for (const { matchId, winnerSide } of plan.walkovers) {
      const match = byId.get(matchId)!;
      await tx.match.update({
        where: { id: matchId },
        data: { status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide, officialAt: new Date(), version: { increment: 1 } },
      });
      impacts.push({
        type: 'WALKOVER',
        matchId,
        matchNo: match.matchNo,
        roundCode: match.round.code,
        groupCode: group.code,
        removedId: entryId,
        beneficiaryId: (winnerSide === 1 ? match.side1EntryId : match.side2EntryId) as string,
      });
    }
    if (plan.voidedMatchIds.length) {
      await tx.match.updateMany({ where: { id: { in: plan.voidedMatchIds } }, data: { isVoided: true, version: { increment: 1 } } });
      for (const matchId of plan.voidedMatchIds) {
        const match = byId.get(matchId)!;
        impacts.push({ type: 'VOID_MATCH', matchId, matchNo: match.matchNo, roundCode: match.round.code, groupCode: group.code, removedId: entryId });
      }
    }
    await this.standings.recompute(tx, group.id);
    impacts.push({ type: 'STANDINGS_RECOMPUTE', groupCode: group.code });
    return impacts;
  }
}
