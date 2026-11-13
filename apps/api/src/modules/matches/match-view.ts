import type { Prisma } from '@kamito/db';

const PLAYER_BRIEF = { select: { id: true, fullName: true, club: true } } as const;

export const ENTRY_BRIEF_SELECT = {
  id: true,
  seed: true,
  status: true,
  stage: true,
  competitor: {
    select: {
      id: true,
      type: true,
      displayName: true,
      player: PLAYER_BRIEF,
      pair: { select: { playerA: PLAYER_BRIEF, playerB: PLAYER_BRIEF } },
    },
  },
} satisfies Prisma.EntrySelect;

type EntryBriefRow = Prisma.EntryGetPayload<{ select: typeof ENTRY_BRIEF_SELECT }>;

export function toEntryBrief(entry: EntryBriefRow | null) {
  if (!entry) return null;
  const { competitor } = entry;
  const players = competitor.player ? [competitor.player] : competitor.pair ? [competitor.pair.playerA, competitor.pair.playerB] : [];
  return {
    id: entry.id,
    seed: entry.seed,
    status: entry.status,
    stage: entry.stage,
    type: competitor.type,
    displayName: competitor.displayName,
    players,
  };
}

export const MATCH_VIEW_INCLUDE = {
  round: { select: { number: true, scopeKey: true, code: true } },
  side1Entry: { select: ENTRY_BRIEF_SELECT },
  side2Entry: { select: ENTRY_BRIEF_SELECT },
} satisfies Prisma.MatchInclude;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof MATCH_VIEW_INCLUDE }>;

export function toMatchView(match: MatchRow) {
  return {
    id: match.id,
    matchNo: match.matchNo,
    roundId: match.roundId,
    scopeKey: match.round.scopeKey,
    roundNumber: match.round.number,
    roundCode: match.round.code,
    section: match.section,
    groupId: match.groupId,
    orderInRound: match.orderInRound,
    side1: toEntryBrief(match.side1Entry),
    side2: toEntryBrief(match.side2Entry),
    side1Source: match.side1Source,
    side2Source: match.side2Source,
    nextMatchId: match.nextMatchId,
    nextMatchSide: match.nextMatchSide,
    status: match.status,
    resultType: match.resultType,
    winnerSide: match.winnerSide,
    games1: match.games1,
    games2: match.games2,
    isVoided: match.isVoided,
    version: match.version,
  };
}
