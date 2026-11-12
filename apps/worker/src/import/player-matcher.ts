import { normalizePersonName } from '@kamito/shared';
import type { Gender } from './import-row-types.js';

export interface KnownPlayer {
  id: string;
  code: string;
  fullName: string;
  normalizedName: string;
  gender: Gender;
  birthYear: number | null;
  club: string | null;
  birthDate?: Date | null;
}

export interface PlayerIndex {
  byCode: Map<string, KnownPlayer>;
  byName: Map<string, KnownPlayer[]>;
  /** Upper-case code of a merged player -> code of the player it was merged into. */
  mergedCodes: Map<string, string>;
}

export interface PlayerInput {
  code: string | null;
  fullName: string;
  gender: Gender | null;
  birthYear: number | null;
}

export type MatchResult =
  | { action: 'LINK_PLAYER'; player: KnownPlayer }
  | { action: 'CREATE_PLAYER'; newPlayerKey: string }
  | { action: 'NEEDS_CONFIRM'; candidates: KnownPlayer[]; newPlayerKey: string | null }
  | { action: 'ERROR'; message: string };

export function buildPlayerIndex(players: KnownPlayer[], mergedCodes: Map<string, string> = new Map()): PlayerIndex {
  const index: PlayerIndex = { byCode: new Map(), byName: new Map(), mergedCodes };
  for (const player of players) {
    index.byCode.set(player.code.toUpperCase(), player);
    const sameName = index.byName.get(player.normalizedName);
    if (sameName) sameName.push(player);
    else index.byName.set(player.normalizedName, [player]);
  }
  return index;
}

/** Two rows describing the same new person share this key so commit creates one player. */
export function newPlayerKey(input: PlayerInput): string | null {
  if (!input.gender || !input.fullName) return null;
  return `${normalizePersonName(input.fullName)}|${input.gender}|${input.birthYear ?? ''}`;
}

function identityMismatches(input: PlayerInput, player: KnownPlayer): string[] {
  const diffs: string[] = [];
  if (input.fullName && normalizePersonName(input.fullName) !== player.normalizedName) diffs.push(`họ tên (hệ thống: ${player.fullName})`);
  if (input.gender && input.gender !== player.gender) diffs.push('giới tính');
  if (input.birthYear !== null && input.birthYear !== player.birthYear) diffs.push(`năm sinh (hệ thống: ${player.birthYear ?? 'chưa có'})`);
  return diffs;
}

/** Pure matching of one spreadsheet player against the known players; never mutates identity data. */
export function matchPlayer(input: PlayerInput, index: PlayerIndex): MatchResult {
  if (input.code) {
    const player = index.byCode.get(input.code.toUpperCase());
    if (!player) {
      const target = index.mergedCodes.get(input.code.toUpperCase());
      return { action: 'ERROR', message: target ? `VĐV mã ${input.code} đã được gộp vào mã ${target} — dùng mã ${target}` : `Không có VĐV mã ${input.code}` };
    }
    const diffs = identityMismatches(input, player);
    if (diffs.length) return { action: 'ERROR', message: `Khác dữ liệu VĐV mã ${input.code}: ${diffs.join(', ')}` };
    return { action: 'LINK_PLAYER', player };
  }
  if (!input.fullName) return { action: 'ERROR', message: 'Thiếu họ tên hoặc mã VĐV' };

  const sameName = index.byName.get(normalizePersonName(input.fullName)) ?? [];
  const key = newPlayerKey(input);
  if (!sameName.length) {
    return key ? { action: 'CREATE_PLAYER', newPlayerKey: key } : { action: 'ERROR', message: 'Thiếu giới tính để tạo VĐV mới' };
  }
  if (input.gender && input.birthYear !== null) {
    const exact = sameName.filter((player) => player.gender === input.gender && player.birthYear === input.birthYear);
    if (exact.length === 1) return { action: 'LINK_PLAYER', player: exact[0]! };
    if (exact.length > 1) return { action: 'NEEDS_CONFIRM', candidates: exact, newPlayerKey: key };
  }
  return { action: 'NEEDS_CONFIRM', candidates: sameName, newPlayerKey: key };
}
