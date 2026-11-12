import type { Player, Prisma } from '@kamito/db';
import { can, type UserRoleName } from '@kamito/shared';
import { formatDateOnly } from '../events/date-only.js';

type Reader = Pick<Prisma.TransactionClient, 'entry'>;

export const dateOrNull = (value: Date | null): string | null => (value ? formatDateOnly(value) : null);

export const PLAYER_LOOKUP_SELECT = { id: true, code: true, fullName: true, gender: true, birthYear: true, club: true } as const;

/** Phone, email and exact birth date are private: only roles allowed to edit players see them. */
export const canSeePlayerPii = (role: UserRoleName): boolean => can(role, 'players', 'update');

export function toPlayerListItem(player: Player, entryCount: number, role: UserRoleName) {
  return {
    id: player.id,
    code: player.code,
    slug: player.slug,
    fullName: player.fullName,
    fullNameEn: player.fullNameEn,
    publicDisplayName: player.publicDisplayName,
    gender: player.gender,
    ...(canSeePlayerPii(role) && { birthDate: dateOrNull(player.birthDate) }),
    birthYear: player.birthYear,
    club: player.club,
    city: player.city,
    countryCode: player.countryCode,
    isActive: player.isActive,
    isPublicProfile: player.isPublicProfile,
    noindex: player.noindex,
    mergedIntoId: player.mergedIntoId,
    photoMediaId: player.photoMediaId,
    entryCount,
  };
}

export type MergedIntoRef = { id: string; code: string; fullName: string } | null;

export function toPlayerDetail(player: Player, extra: { entryCount: number; pairCount: number; mergedInto: MergedIntoRef }, role: UserRoleName) {
  const { entryCount, ...rest } = extra;
  return {
    ...toPlayerListItem(player, entryCount, role),
    ...(canSeePlayerPii(role) && { phone: player.phone, email: player.email }),
    handedness: player.handedness,
    gripStyle: player.gripStyle,
    playStyle: player.playStyle,
    bio: player.bio,
    bioEn: player.bioEn,
    mergedAt: player.mergedAt,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
    ...rest,
  };
}

/** Entries a player takes part in, alone or through any pair (all statuses). */
export async function countEntriesByPlayer(db: Reader, playerIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(playerIds.map((id) => [id, 0]));
  if (!playerIds.length) return counts;
  const entries = await db.entry.findMany({
    where: {
      competitor: {
        OR: [
          { playerId: { in: playerIds } },
          { pair: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] } },
        ],
      },
    },
    select: { competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } },
  });
  for (const { competitor } of entries) {
    for (const id of [competitor.playerId, competitor.pair?.playerAId, competitor.pair?.playerBId]) {
      if (id && counts.has(id)) counts.set(id, counts.get(id)! + 1);
    }
  }
  return counts;
}

/** Snapshot used for audit diffs: dates as strings so unchanged values compare equal. */
export function auditFields(player: Player): Record<string, unknown> {
  return {
    fullName: player.fullName,
    fullNameEn: player.fullNameEn,
    publicDisplayName: player.publicDisplayName,
    gender: player.gender,
    birthDate: dateOrNull(player.birthDate),
    birthYear: player.birthYear,
    countryCode: player.countryCode,
    club: player.club,
    city: player.city,
    handedness: player.handedness,
    gripStyle: player.gripStyle,
    playStyle: player.playStyle,
    photoMediaId: player.photoMediaId,
    bio: player.bio,
    bioEn: player.bioEn,
    phone: player.phone,
    email: player.email,
    isPublicProfile: player.isPublicProfile,
    noindex: player.noindex,
    isActive: player.isActive,
  };
}

export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    changedBefore[key] = before[key];
    changedAfter[key] = after[key];
  }
  return { before: changedBefore, after: changedAfter, changed: Object.keys(changedAfter).length > 0 };
}
