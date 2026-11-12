import type { Prisma } from '@kamito/db';

const PLAYER_BRIEF = { select: { id: true, code: true, fullName: true, gender: true, birthYear: true, club: true } } as const;

export const ENTRY_INCLUDE = {
  competitor: {
    select: {
      id: true,
      type: true,
      displayName: true,
      player: PLAYER_BRIEF,
      pair: { select: { playerA: PLAYER_BRIEF, playerB: PLAYER_BRIEF } },
    },
  },
} satisfies Prisma.EntryInclude;

type EntryRow = Prisma.EntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

export function toEntryView(entry: EntryRow) {
  const { competitor } = entry;
  const players = competitor.player ? [competitor.player] : competitor.pair ? [competitor.pair.playerA, competitor.pair.playerB] : [];
  return {
    id: entry.id,
    subEventId: entry.subEventId,
    status: entry.status,
    stage: entry.stage,
    quotaType: entry.quotaType,
    seed: entry.seed,
    notes: entry.notes,
    eligibilityOverrideReason: entry.eligibilityOverrideReason,
    rankingAtEntry: entry.rankingAtEntry,
    pointsAtEntry: entry.pointsAtEntry,
    createdAt: entry.createdAt,
    competitor: { id: competitor.id, type: competitor.type, displayName: competitor.displayName, players },
  };
}

export function entryAuditFields(entry: { status: string; stage: string; quotaType: string; seed: number | null; notes: string | null }) {
  return { status: entry.status, stage: entry.stage, quotaType: entry.quotaType, seed: entry.seed, notes: entry.notes };
}
