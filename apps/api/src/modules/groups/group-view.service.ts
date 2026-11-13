import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { DRAW_INCLUDE, FORMAT_SELECT, formatOf } from '../draws/round-format-view.js';
import { MatchQueryService } from '../matches/match-query.service.js';
import { ENTRY_BRIEF_SELECT, toEntryBrief } from '../matches/match-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { groupNotFound } from './group-standings.service.js';

const GROUP_INCLUDE = {
  members: { include: { entry: { select: ENTRY_BRIEF_SELECT } }, orderBy: { slot: 'asc' } },
  standings: true,
  rounds: { include: { matchFormat: FORMAT_SELECT }, orderBy: { number: 'asc' } },
} satisfies Prisma.GroupInclude;

type GroupRow = Prisma.GroupGetPayload<{ include: typeof GROUP_INCLUDE }>;
type DrawFormats = Prisma.DrawGetPayload<{ include: typeof DRAW_INCLUDE }>;
type Match = Awaited<ReturnType<MatchQueryService['listForDraw']>>[number];

function toGroupView(g: GroupRow, draw: DrawFormats, matches: Match[]) {
  return {
    id: g.id,
    code: g.code,
    order: g.order,
    version: g.version,
    members: g.members.map((m) => ({ entryId: m.entryId, slot: m.slot, entry: toEntryBrief(m.entry) })),
    standings: g.standings
      .map(({ groupId: _groupId, ...s }) => s)
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)),
    rounds: g.rounds.map((r) => ({ id: r.id, number: r.number, code: r.code, matchFormatId: r.matchFormatId, ...formatOf(r, draw) })),
    matches: matches.filter((m) => m.groupId === g.id),
  };
}

@Injectable()
export class GroupViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matches: MatchQueryService,
  ) {}

  async forDraw(drawId: string, draw: DrawFormats) {
    const [groups, matches] = await Promise.all([
      this.prisma.group.findMany({ where: { drawId }, orderBy: { order: 'asc' }, include: GROUP_INCLUDE }),
      this.matches.listForDraw(drawId, { groupId: { not: null } }),
    ]);
    return groups.map((g) => toGroupView(g, draw, matches));
  }

  async forGroup(groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, include: { ...GROUP_INCLUDE, draw: { include: DRAW_INCLUDE } } });
    if (!group) throw groupNotFound();
    const matches = await this.matches.listForDraw(group.drawId, { groupId });
    const { draw, ...row } = group;
    return { drawId: group.drawId, ...toGroupView(row, draw, matches) };
  }
}
