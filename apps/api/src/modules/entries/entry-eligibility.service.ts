import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { confirmedEntryCount, lockPlayersForShare, playersAlreadyEntered, type Prisma } from '@kamito/db';
import { checkEntryEligibility, playerSettings, type EligibilityIssue, type UserRoleName } from '@kamito/shared';
import { fieldError } from '../../common/validation/parse-body.js';
import { AppSettingsService } from '../settings/app-settings.service.js';

type Tx = Prisma.TransactionClient;

export const SUB_EVENT_RULES_INCLUDE = {
  discipline: { select: { competitorKind: true, genderRule: true } },
  category: { select: { name: true, minAge: true, maxAge: true } },
  event: { select: { startDate: true } },
} satisfies Prisma.SubEventInclude;

export type SubEventRules = Prisma.SubEventGetPayload<{ include: typeof SUB_EVENT_RULES_INCLUDE }>;

export type EntryIssue = Omit<EligibilityIssue, 'code'> & { code: EligibilityIssue['code'] | 'CAPACITY' };

export interface EligiblePlayer {
  id: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  birthDate: Date | null;
  birthYear: number | null;
}

@Injectable()
export class EntryEligibilityService {
  constructor(private readonly settings: AppSettingsService) {}

  async loadSubEvent(db: Pick<Tx, 'subEvent'>, id: string): Promise<SubEventRules> {
    const subEvent = await db.subEvent.findUnique({ where: { id }, include: SUB_EVENT_RULES_INCLUDE });
    if (!subEvent) throw new NotFoundException({ code: 'SUB_EVENT_NOT_FOUND', message: 'Không tìm thấy nội dung thi đấu' });
    return subEvent;
  }

  /**
   * Players keep the requested order; unknown, inactive or merged profiles are refused.
   * Call after lockSubEvent: the share lock makes a concurrent merge wait, then we see its result.
   */
  async loadPlayers(tx: Tx, playerIds: string[]): Promise<EligiblePlayer[]> {
    const unique = [...new Set(playerIds)];
    const locked = await lockPlayersForShare(tx, unique);
    const retired = locked.find((row) => row.mergedIntoId);
    if (retired) {
      const target = await tx.player.findUnique({ where: { id: retired.mergedIntoId! }, select: { code: true } });
      throw new ConflictException({ code: 'PLAYER_MERGED', message: `VĐV mã ${retired.code} đã được gộp vào mã ${target?.code ?? '?'}` });
    }
    const rows = await tx.player.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true, gender: true, birthDate: true, birthYear: true, isActive: true, mergedIntoId: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of unique) {
      const row = byId.get(id);
      if (!row) throw fieldError('playerIds', 'Không tìm thấy VĐV');
      if (row.mergedIntoId) throw fieldError('playerIds', `${row.fullName} đã được gộp vào hồ sơ khác, hãy chọn hồ sơ còn hiệu lực`);
      if (!row.isActive) throw fieldError('playerIds', `${row.fullName} đang ngưng hoạt động`);
    }
    return playerIds.map((id) => byId.get(id)!);
  }

  /**
   * Rule + database checks for one entry. Structural problems and duplicates throw at once;
   * the returned issues are the ones an ADMIN may override.
   */
  async assess(tx: Tx, subEvent: SubEventRules, players: EligiblePlayer[], excludeEntryId?: string): Promise<EntryIssue[]> {
    const method = await this.settings.get(playerSettings.ageCalculation);
    const issues: EntryIssue[] = checkEntryEligibility(
      players,
      { ...subEvent.discipline, category: subEvent.category, eventStartDate: subEvent.event.startDate },
      method,
    );
    if (issues.some((issue) => !issue.overridable)) throw ineligible(issues);

    const taken = await playersAlreadyEntered(tx, subEvent.id, players.map((player) => player.id), excludeEntryId);
    if (taken.length) {
      const names = players.filter((player) => taken.includes(player.id)).map((player) => player.fullName).join(', ');
      throw new ConflictException({ code: 'ALREADY_ENTERED', message: `${names} đã có đăng ký trong nội dung này` });
    }

    if (subEvent.maxEntries !== null && (await confirmedEntryCount(tx, subEvent.id, excludeEntryId)) >= subEvent.maxEntries) {
      issues.push({ code: 'CAPACITY', message: `Nội dung đã đủ ${subEvent.maxEntries} đăng ký`, overridable: true });
    }
    return issues;
  }

  /** Returns the override record to store, or null when nothing needed overriding. */
  resolveOverride(issues: EntryIssue[], reason: string | undefined, role: UserRoleName): { reason: string; issues: EntryIssue[] } | null {
    if (reason !== undefined && role !== 'ADMIN') {
      throw new ForbiddenException({ code: 'OVERRIDE_FORBIDDEN', message: 'Chỉ quản trị viên được ghi đè kiểm tra hợp lệ' });
    }
    if (!issues.length) return null;
    if (reason === undefined) throw ineligible(issues);
    return { reason, issues };
  }
}

export function ineligible(issues: EntryIssue[]): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: 'ENTRY_INELIGIBLE', message: issues[0]!.message, issues });
}
