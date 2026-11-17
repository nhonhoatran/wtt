import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { PUBLIC_DRAW_KINDS, type PublicBracket, type PublicDrawKind } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { toPublicBracket } from './public-bracket.serializer.js';

const PLAYER_SELECT = {
  select: { id: true, fullName: true, fullNameEn: true, publicDisplayName: true, club: true, isPublicProfile: true, isActive: true, mergedIntoId: true },
} as const;

export const PUBLIC_SIDE_SELECT = {
  select: {
    seed: true,
    quotaType: true,
    competitor: { select: { player: PLAYER_SELECT, pair: { select: { playerA: PLAYER_SELECT, playerB: PLAYER_SELECT } } } },
  },
} satisfies { select: Prisma.EntrySelect };

export const PUBLIC_ROUND_INCLUDE = {
  matches: {
    orderBy: { orderInRound: 'asc' },
    select: {
      matchNo: true,
      orderInRound: true,
      status: true,
      resultType: true,
      winnerSide: true,
      games1: true,
      games2: true,
      scheduledAt: true,
      side1Source: true,
      side2Source: true,
      side1Entry: PUBLIC_SIDE_SELECT,
      side2Entry: PUBLIC_SIDE_SELECT,
      games: { orderBy: { number: 'asc' }, select: { number: true, score1: true, score2: true } },
    },
  },
} satisfies Prisma.RoundInclude;

const KNOCKOUT_KINDS: PublicDrawKind[] = ['MAIN', 'QUALIFYING'];

@Injectable()
export class PublicBracketQuery {
  constructor(private readonly prisma: PrismaService) {}

  /** Two queries: sub-event with its published knockout draws, then rounds with matches, sides and games. Null = not public. */
  async bracket(slug: string, subEventCode: string, kindParam: unknown): Promise<PublicBracket | null> {
    const param = kindParam ?? 'main';
    if (typeof param !== 'string' || !Object.hasOwn(PUBLIC_DRAW_KINDS, param)) return null;
    const kind = PUBLIC_DRAW_KINDS[param as keyof typeof PUBLIC_DRAW_KINDS];
    const subEvent = await this.prisma.subEvent.findFirst({
      where: { code: subEventCode, event: publicScope.event(slug) },
      select: {
        code: true,
        name: true,
        nameEn: true,
        discipline: { select: { name: true, nameEn: true } },
        category: { select: { name: true, nameEn: true } },
        event: { select: { slug: true, name: true, nameEn: true, timezone: true } },
        draws: {
          where: { ...publicScope.draw, kind: { in: KNOCKOUT_KINDS } },
          select: { id: true, kind: true, size: true, publishedAt: true },
        },
      },
    });
    const draw = subEvent?.draws.find((d) => d.kind === kind);
    if (!subEvent || !draw) return null;

    const rounds = await this.prisma.round.findMany({
      where: { drawId: draw.id, groupId: null },
      orderBy: [{ section: 'asc' }, { number: 'asc' }],
      include: PUBLIC_ROUND_INCLUDE,
    });
    return toPublicBracket(subEvent, draw, rounds);
  }
}
