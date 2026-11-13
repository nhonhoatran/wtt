import type { Prisma } from '@kamito/db';
import { ENTRY_BRIEF_SELECT, toEntryBrief } from './match-view.js';

const FORMAT_SELECT = { select: { name: true, bestOf: true, pointsPerGame: true, winBy: true } } as const;

export const MATCH_RESULT_INCLUDE = {
  round: { select: { code: true, matchFormat: FORMAT_SELECT } },
  draw: { select: { kind: true, status: true, matchFormat: FORMAT_SELECT } },
  subEvent: { select: { code: true, name: true, matchFormat: FORMAT_SELECT } },
  group: { select: { code: true } },
  side1Entry: { select: ENTRY_BRIEF_SELECT },
  side2Entry: { select: ENTRY_BRIEF_SELECT },
} satisfies Prisma.MatchInclude;

export const MATCH_DETAIL_INCLUDE = {
  ...MATCH_RESULT_INCLUDE,
  games: { orderBy: { number: 'asc' }, select: { number: true, score1: true, score2: true } },
} satisfies Prisma.MatchInclude;

export type MatchResultRow = Prisma.MatchGetPayload<{ include: typeof MATCH_RESULT_INCLUDE }>;
export type MatchDetailRow = Prisma.MatchGetPayload<{ include: typeof MATCH_DETAIL_INCLUDE }>;

/** Round overrides draw, draw overrides sub-event. */
export const resolveMatchFormat = (m: MatchResultRow) => m.round.matchFormat ?? m.draw.matchFormat ?? m.subEvent.matchFormat;

/** A pending walkover waits for its winner to arrive; it is completed by the system, not by result entry. */
export const isPendingWalkover = (m: Pick<MatchResultRow, 'resultType' | 'status'>) => m.resultType === 'WALKOVER' && m.status === 'SCHEDULED';

export const isReadyForResult = (m: Pick<MatchResultRow, 'side1EntryId' | 'side2EntryId' | 'resultType' | 'status' | 'isVoided'>) =>
  Boolean(m.side1EntryId && m.side2EntryId) && m.resultType !== 'BYE' && !m.isVoided && !isPendingWalkover(m);

export function toMatchResultItem(m: MatchResultRow) {
  return {
    id: m.id,
    matchNo: m.matchNo,
    eventId: m.eventId,
    subEventId: m.subEventId,
    subEventCode: m.subEvent.code,
    subEventName: m.subEvent.name ?? m.subEvent.code,
    drawKind: m.draw.kind,
    roundCode: m.round.code,
    groupCode: m.group?.code ?? null,
    status: m.status,
    resultType: m.resultType,
    winnerSide: m.winnerSide === 1 || m.winnerSide === 2 ? m.winnerSide : null,
    games1: m.games1,
    games2: m.games2,
    side1: toEntryBrief(m.side1Entry),
    side2: toEntryBrief(m.side2Entry),
    ready: isReadyForResult(m),
    version: m.version,
  };
}

export function toMatchDetail(m: MatchDetailRow) {
  return { ...toMatchResultItem(m), games: m.games, format: resolveMatchFormat(m) };
}
