import { stripDiacritics } from '@kamito/shared';
import type { GroupRecord } from './draw-types';

export interface SameClubConflict {
  groupId: string;
  groupCode: string;
  /** Club name as written on the first entry. */
  club: string;
  entries: { id: string; name: string }[];
}

const clubKey = (club: string) => stripDiacritics(club).trim().replace(/\s+/g, ' ').toLowerCase();

/** Groups holding two or more different entries from the same club; blank clubs are ignored. */
export function findSameClubGroups(groups: GroupRecord[]): SameClubConflict[] {
  const conflicts: SameClubConflict[] = [];
  for (const group of groups) {
    const byClub = new Map<string, SameClubConflict>();
    for (const { entry } of group.members) {
      const seenInEntry = new Set<string>();
      for (const player of entry.players) {
        const key = player.club ? clubKey(player.club) : '';
        if (!key || seenInEntry.has(key)) continue;
        seenInEntry.add(key);
        const found = byClub.get(key) ?? { groupId: group.id, groupCode: group.code, club: player.club!.trim(), entries: [] };
        found.entries.push({ id: entry.id, name: entry.displayName });
        byClub.set(key, found);
      }
    }
    conflicts.push(...[...byClub.values()].filter((item) => item.entries.length > 1));
  }
  return conflicts;
}

export function sameClubSummary(conflicts: SameClubConflict[]): string {
  return conflicts.map((item) => `Bảng ${item.groupCode} có ${item.entries.length} VĐV cùng CLB (${item.club})`).join('; ');
}
