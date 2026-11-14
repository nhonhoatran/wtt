import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateGroupStandings, type GroupMatchInput, type GroupScoringRuleInput, type GroupStandingsResult } from '@kamito/competition-engine';
import { lockGroups, type Draw, type Group, type Prisma } from '@kamito/db';
import { tiebreakersSchema } from '@kamito/shared';
import { conflict } from '../draws/draw-errors.js';
import { loadDrawLocked } from '../draws/draw-lock.js';
import { pickMatchFormat } from '../draws/round-format-view.js';

type Tx = Prisma.TransactionClient;

export const groupNotFound = () => new NotFoundException({ code: 'GROUP_NOT_FOUND', message: 'Không tìm thấy bảng đấu' });

@Injectable()
export class GroupStandingsService {
  /**
   * Opens every group write in the fixed lock order SubEvent, Draw, Group. Phase 07 result confirmation
   * calls this before touching a group match, then `recompute` in the same transaction.
   */
  async lockForWrite(tx: Tx, groupId: string): Promise<{ draw: Draw; group: Group }> {
    const probe = await tx.group.findUnique({ where: { id: groupId }, select: { drawId: true } });
    if (!probe) throw groupNotFound();
    const draw = await loadDrawLocked(tx, probe.drawId);
    await lockGroups(tx, probe.drawId);
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group) throw groupNotFound();
    return { draw, group };
  }

  /**
   * Pure read: standings from the group's current matches. Manual ranks default to the stored ones and
   * only survive while the tie they settle is unchanged (the calculator drops the rest).
   */
  async compute(tx: Tx, groupId: string, manualRanks?: Readonly<Record<string, number>>): Promise<GroupStandingsResult> {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: {
        members: { select: { entryId: true, entry: { select: { status: true } } }, orderBy: { slot: 'asc' } },
        standings: { select: { entryId: true, manualRank: true } },
        draw: { select: { advancePerGroup: true, matchFormat: true, subEvent: { select: { matchFormat: true, groupScoringRule: true } } } },
        matches: { include: { games: { orderBy: { number: 'asc' } }, round: { select: { matchFormat: true } } } },
      },
    });
    if (!group) throw groupNotFound();
    const { draw } = group;
    if (draw.advancePerGroup === null) throw new Error(`Group draw of group ${groupId} has no advancePerGroup`);
    const rule = draw.subEvent.groupScoringRule ?? (await tx.groupScoringRule.findFirst({ where: { isDefault: true, isActive: true } }));
    if (!rule) throw conflict('GROUP_RULE_MISSING', 'Nội dung chưa có luật tính điểm bảng');

    const stored = Object.fromEntries(group.standings.filter((s) => s.manualRank !== null).map((s) => [s.entryId, s.manualRank as number]));
    const matches: GroupMatchInput[] = group.matches.map((m) => ({
      side1EntryId: m.side1EntryId as string,
      side2EntryId: m.side2EntryId as string,
      status: m.status,
      resultType: m.resultType,
      winnerSide: m.winnerSide === 1 || m.winnerSide === 2 ? m.winnerSide : null,
      isVoided: m.isVoided,
      format: pickMatchFormat(m.round, draw, draw.subEvent),
      games: m.games.map((g) => ({ score1: g.score1, score2: g.score2 })),
    }));
    const ruleInput: GroupScoringRuleInput = { ...rule, tiebreakers: tiebreakersSchema.parse(rule.tiebreakers) };
    return calculateGroupStandings({
      entryIds: group.members.map((m) => m.entryId),
      matches,
      rule: ruleInput,
      // Only a placeholder: every match above carries its own resolved format.
      format: draw.subEvent.matchFormat,
      advancePerGroup: draw.advancePerGroup,
      withdrawnEntryIds: group.members.filter((m) => m.entry.status === 'WITHDRAWN').map((m) => m.entryId),
      manualRanks: manualRanks ?? stored,
    });
  }

  /** Caller holds the locks from `lockForWrite`. Replaces every standing row of the group and bumps Group.version. */
  async recompute(tx: Tx, groupId: string, manualRanks?: Readonly<Record<string, number>>): Promise<{ result: GroupStandingsResult; version: number }> {
    const result = await this.compute(tx, groupId, manualRanks);
    await tx.groupStanding.deleteMany({ where: { groupId } });
    await tx.groupStanding.createMany({
      data: result.rows.map((row) => ({
        groupId,
        entryId: row.entryId,
        played: row.played,
        won: row.won,
        lost: row.lost,
        matchPoints: row.matchPoints,
        gamesFor: row.gamesFor,
        gamesAgainst: row.gamesAgainst,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        rank: row.rank,
        qualified: row.qualified,
        needsManualTiebreak: row.needsManualTiebreak,
        manualRank: row.manualRank,
      })),
    });
    const group = await tx.group.update({ where: { id: groupId }, data: { version: { increment: 1 } } });
    return { result, version: group.version };
  }
}
