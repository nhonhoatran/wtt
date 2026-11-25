import type { Prisma } from '@kamito/db';
import { PUBLIC_DRAW_KINDS, publicPlayerSlug } from '@kamito/shared';
import type { PublicBracket, PublicBracketMatch, PublicBracketSection, PublicDrawKind, PublicPlayerName, PublicSide, PublicSideSource, PublicTable } from '@kamito/shared';
import type { PUBLIC_ROUND_INCLUDE, PUBLIC_SIDE_SELECT } from './public-bracket.query.js';

const KIND_ORDER = Object.values(PUBLIC_DRAW_KINDS);

type RoundRow = Prisma.RoundGetPayload<{ include: typeof PUBLIC_ROUND_INCLUDE }>;
type MatchRow = RoundRow['matches'][number];
type SideRow = Prisma.EntryGetPayload<typeof PUBLIC_SIDE_SELECT>;
type PlayerRow = {
  fullName: string; fullNameEn: string | null; publicDisplayName: string | null; club: string | null;
  id: string; isPublicProfile: boolean; isActive: boolean; mergedIntoId: string | null;
};

interface NamedRow {
  name: string;
  nameEn: string | null;
}

interface SubEventRow {
  code: string;
  name: string | null;
  nameEn: string | null;
  discipline: NamedRow;
  category: NamedRow | null;
  event: { slug: string; name: string; nameEn: string | null; timezone: string };
  draws: { kind: string }[];
}

interface DrawRow {
  kind: string;
  size: number | null;
  publishedAt: Date | null;
}

/** Same rule as the admin label: an explicit name wins, else "discipline – category". */
export function subEventNames({ name, nameEn, discipline, category }: Pick<SubEventRow, 'name' | 'nameEn' | 'discipline' | 'category'>) {
  const compose = (pick: (row: NamedRow) => string) => (category ? `${pick(discipline)} – ${pick(category)}` : pick(discipline));
  return {
    name: name ?? compose((row) => row.name),
    nameEn: nameEn ?? (name ? null : compose((row) => row.nameEn ?? row.name)),
  };
}

/** A display name replaces the legal name everywhere, so it also suppresses the English legal name. */
function toPlayerName(p: PlayerRow): PublicPlayerName {
  return {
    name: p.publicDisplayName ?? p.fullName,
    nameEn: p.publicDisplayName ? null : p.fullNameEn,
    club: p.club,
    slug: p.isPublicProfile && p.isActive && !p.mergedIntoId ? publicPlayerSlug(p.id) : null,
  };
}

export function toSide(entry: SideRow | null): PublicSide | null {
  if (!entry) return null;
  const { player, pair } = entry.competitor;
  const players = player ? [player] : pair ? [pair.playerA, pair.playerB] : [];
  const quota = entry.quotaType === 'WILDCARD' || entry.quotaType === 'QUALIFIER' ? entry.quotaType : null;
  return { seed: entry.seed, quota, players: players.map(toPlayerName) };
}

export function toPublicTable(table: { code: string; displayName: string | null } | null): PublicTable | null {
  return table ? { code: table.code, displayName: table.displayName } : null;
}

const isInt = (value: unknown): value is number => Number.isInteger(value);

/** Copies only the known placeholder shapes; anything else stored in the JSON column is dropped. */
export function toPublicSource(raw: Prisma.JsonValue | null): PublicSideSource | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.type === 'WINNER_OF' && isInt(raw.matchNo)) return { type: 'WINNER_OF', matchNo: raw.matchNo };
  if (raw.type === 'QUALIFIER' && isInt(raw.index)) return { type: 'QUALIFIER', index: raw.index };
  if (raw.type === 'GROUP_PLACE' && typeof raw.group === 'string' && isInt(raw.place)) return { type: 'GROUP_PLACE', group: raw.group, place: raw.place };
  return null;
}

function toMatch(m: MatchRow): PublicBracketMatch {
  return {
    matchNo: m.matchNo,
    orderInRound: m.orderInRound,
    status: m.status,
    resultType: m.resultType,
    winnerSide: m.winnerSide === 1 || m.winnerSide === 2 ? m.winnerSide : null,
    games1: m.games1,
    games2: m.games2,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    table: toPublicTable(m.table),
    side1: toSide(m.side1Entry),
    side2: toSide(m.side2Entry),
    side1Source: toPublicSource(m.side1Source),
    side2Source: toPublicSource(m.side2Source),
    games: m.games.map((g) => ({ number: g.number, score1: g.score1, score2: g.score2 })),
  };
}

/** Whitelist serializer: every public field is named here; the field snapshot test pins the list. */
export function toPublicBracket(subEvent: SubEventRow, draw: DrawRow, rounds: RoundRow[]): PublicBracket {
  const sections = new Map<number, PublicBracketSection>();
  for (const round of rounds) {
    const section = sections.get(round.section) ?? { section: round.section, rounds: [] };
    section.rounds.push({ code: round.code, number: round.number, matches: round.matches.map(toMatch) });
    sections.set(round.section, section);
  }
  return {
    event: { slug: subEvent.event.slug, name: subEvent.event.name, nameEn: subEvent.event.nameEn, timezone: subEvent.event.timezone },
    subEvent: { code: subEvent.code, ...subEventNames(subEvent) },
    draw: { kind: draw.kind as PublicDrawKind, size: draw.size, publishedAt: draw.publishedAt?.toISOString() ?? null },
    availableKinds: KIND_ORDER.filter((kind) => subEvent.draws.some((d) => d.kind === kind)),
    sections: [...sections.values()],
  };
}
