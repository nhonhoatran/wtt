import type { Prisma } from '@kamito/db';
import type { PublicPointsBreakdown, PublicRankingListInfo, PublicRankingRow } from '@kamito/shared';
import { PUBLIC_PLAYER_SELECT, toPublicPlayer } from '../public-players/public-player.serializer.js';

export const PUBLIC_RANKING_LIST_SELECT = {
  code: true,
  name: true,
  nameEn: true,
  competitorKind: true,
  genderRule: true,
  category: { select: { code: true, name: true, nameEn: true } },
} satisfies Prisma.RankingListSelect;

export const PUBLIC_RANKING_ROW_SELECT = {
  rank: true,
  previousRank: true,
  movement: true,
  points: true,
  resultsCounted: true,
  breakdown: true,
  player: { select: PUBLIC_PLAYER_SELECT },
} satisfies Prisma.RankingSnapshotRowSelect;

type ListRow = Prisma.RankingListGetPayload<{ select: typeof PUBLIC_RANKING_LIST_SELECT }>;
export type RankingRow = Prisma.RankingSnapshotRowGetPayload<{ select: typeof PUBLIC_RANKING_ROW_SELECT }>;

export function toPublicRankingList(list: ListRow): PublicRankingListInfo {
  return {
    code: list.code,
    name: list.name,
    nameEn: list.nameEn,
    competitorKind: list.competitorKind,
    genderRule: list.genderRule,
    category: list.category ? { code: list.category.code, name: list.category.name, nameEn: list.category.nameEn } : null,
  };
}

const text = (value: unknown): string | null => typeof value === 'string' ? value : null;

/** A frozen JSON object is still treated as untrusted; never spread arbitrary keys into the public response. */
export function publicBreakdown(raw: Prisma.JsonValue, publicEvents: ReadonlyMap<string, string>): PublicPointsBreakdown[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    if (typeof value.points !== 'number' || typeof value.earnedAt !== 'string' || typeof value.expiresAt !== 'string') return [];
    // Slugs may be reassigned. Legacy snapshots without a stable event id stay redacted.
    const eventId = text(value.eventId);
    const eventSlug = eventId ? publicEvents.get(eventId) ?? null : null;
    const visible = eventSlug !== null;
    return [{
      eventSlug: visible ? eventSlug : null,
      eventName: visible ? text(value.eventName) : null,
      eventNameEn: visible ? text(value.eventNameEn) : null,
      eventTypeCode: visible ? text(value.eventTypeCode) : null,
      stageCode: text(value.stageCode),
      points: value.points,
      earnedAt: value.earnedAt,
      expiresAt: value.expiresAt,
    }];
  });
}

export function breakdownEventIds(rows: RankingRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Array.isArray(row.breakdown) ? row.breakdown.flatMap((value) => {
    return value && typeof value === 'object' && !Array.isArray(value) && typeof value.eventId === 'string' ? [value.eventId] : [];
  }) : []))];
}

export function toPublicRankingRow(row: RankingRow, mediaBase: string, publicEvents: ReadonlyMap<string, string>): PublicRankingRow {
  return {
    rank: row.rank,
    previousRank: row.previousRank,
    movement: row.movement,
    points: row.points,
    resultsCounted: row.resultsCounted,
    player: toPublicPlayer(row.player, mediaBase),
    breakdown: publicBreakdown(row.breakdown, publicEvents),
  };
}
