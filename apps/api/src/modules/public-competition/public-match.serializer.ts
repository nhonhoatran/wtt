import type { Prisma } from '@kamito/db';
import type { PublicDrawKind, PublicMatchCard } from '@kamito/shared';
import { PUBLIC_SIDE_SELECT } from './public-bracket.query.js';
import { subEventNames, toPublicSource, toSide } from './public-bracket.serializer.js';

const NAMED = { select: { name: true, nameEn: true } } as const;

export const PUBLIC_MATCH_CARD_SELECT = {
  matchNo: true,
  status: true,
  resultType: true,
  winnerSide: true,
  games1: true,
  games2: true,
  isVoided: true,
  scheduledAt: true,
  side1Source: true,
  side2Source: true,
  side1Entry: PUBLIC_SIDE_SELECT,
  side2Entry: PUBLIC_SIDE_SELECT,
  games: { orderBy: { number: 'asc' }, select: { number: true, score1: true, score2: true } },
  round: { select: { code: true, number: true } },
  group: { select: { code: true } },
  draw: { select: { kind: true } },
  subEvent: { select: { code: true, name: true, nameEn: true, discipline: NAMED, category: NAMED } },
} satisfies Prisma.MatchSelect;

export type PublicMatchCardRow = Prisma.MatchGetPayload<{ select: typeof PUBLIC_MATCH_CARD_SELECT }>;

/** Whitelist serializer for one match card; callers only pass rows already filtered by publicScope.match (no BYE). */
export function toPublicMatchCard(m: PublicMatchCardRow): PublicMatchCard {
  const resultType = m.resultType === 'BYE' ? null : m.resultType;
  return {
    matchNo: m.matchNo,
    subEvent: { code: m.subEvent.code, ...subEventNames(m.subEvent) },
    drawKind: m.draw.kind as PublicDrawKind | 'GROUP',
    round: { code: m.round.code, number: m.round.number },
    groupCode: m.group?.code ?? null,
    status: m.status,
    resultType,
    winnerSide: m.winnerSide === 1 || m.winnerSide === 2 ? m.winnerSide : null,
    games1: m.games1,
    games2: m.games2,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    side1: toSide(m.side1Entry),
    side2: toSide(m.side2Entry),
    side1Source: toPublicSource(m.side1Source),
    side2Source: toPublicSource(m.side2Source),
    games: m.games.map((g) => ({ number: g.number, score1: g.score1, score2: g.score2 })),
    voided: m.isVoided,
  };
}
