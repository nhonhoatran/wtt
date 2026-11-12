import { ageOnEvent, effectiveBirthYear, type AgeCalculation } from './age-on-event.js';

export type PlayerGender = 'MALE' | 'FEMALE';
export type DisciplineGenderRule = 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN';
export type DisciplineCompetitorKind = 'SINGLES' | 'DOUBLES';

export interface EligibilityPlayer {
  id: string;
  fullName: string;
  gender: PlayerGender;
  birthDate?: Date | string | null;
  birthYear?: number | null;
}

export interface EligibilitySubEvent {
  competitorKind: DisciplineCompetitorKind;
  genderRule: DisciplineGenderRule;
  category?: { name: string; minAge: number | null; maxAge: number | null } | null;
  eventStartDate: Date | string;
}

export type EligibilityIssueCode =
  | 'PLAYER_COUNT'
  | 'SAME_PLAYER'
  | 'GENDER'
  | 'MIXED_PAIR'
  | 'AGE_UNKNOWN'
  | 'AGE_ABOVE'
  | 'AGE_BELOW';

export interface EligibilityIssue {
  code: EligibilityIssueCode;
  message: string;
  playerId?: string;
  /** Structural problems can never be overridden; rule problems can (ADMIN + reason). */
  overridable: boolean;
}

const GENDER_LABEL: Record<PlayerGender, string> = { MALE: 'nam', FEMALE: 'nữ' };
const METHOD_LABEL: Record<AgeCalculation, string> = { BIRTH_YEAR: 'tính theo năm sinh', EVENT_START_DATE: 'tính theo ngày khai mạc' };
const FALLBACK_LABEL = 'tính theo năm sinh vì chưa có ngày sinh';

function genderIssues(players: EligibilityPlayer[], rule: DisciplineGenderRule): EligibilityIssue[] {
  if (rule === 'OPEN') return [];
  if (rule === 'MIXED') {
    if (players.length !== 2) return [];
    const genders = new Set(players.map((player) => player.gender));
    return genders.size === 2 ? [] : [{ code: 'MIXED_PAIR', message: 'Đôi nam nữ cần một VĐV nam và một VĐV nữ', overridable: true }];
  }
  const expected: PlayerGender = rule === 'MEN' ? 'MALE' : 'FEMALE';
  return players
    .filter((player) => player.gender !== expected)
    .map((player) => ({
      code: 'GENDER' as const,
      playerId: player.id,
      message: `${player.fullName} là VĐV ${GENDER_LABEL[player.gender]}, nội dung chỉ dành cho ${GENDER_LABEL[expected]}`,
      overridable: true,
    }));
}

function ageIssues(players: EligibilityPlayer[], subEvent: EligibilitySubEvent, method: AgeCalculation): EligibilityIssue[] {
  const category = subEvent.category;
  if (!category || (category.minAge === null && category.maxAge === null)) return [];
  const issues: EligibilityIssue[] = [];
  for (const player of players) {
    const age = ageOnEvent(player, subEvent.eventStartDate, method);
    if (age === null) {
      issues.push({ code: 'AGE_UNKNOWN', playerId: player.id, message: `${player.fullName} chưa có năm sinh, không kiểm được nhóm ${category.name}`, overridable: true });
      continue;
    }
    const born = effectiveBirthYear(player);
    const methodLabel = method === 'EVENT_START_DATE' && !player.birthDate ? FALLBACK_LABEL : METHOD_LABEL[method];
    const detail = `VĐV ${player.fullName} sinh ${born}, ${age} tuổi (${methodLabel})`;
    if (category.maxAge !== null && age > category.maxAge) {
      issues.push({ code: 'AGE_ABOVE', playerId: player.id, message: `${detail}, vượt nhóm ${category.name}`, overridable: true });
    } else if (category.minAge !== null && age < category.minAge) {
      issues.push({ code: 'AGE_BELOW', playerId: player.id, message: `${detail}, chưa đủ tuổi nhóm ${category.name}`, overridable: true });
    }
  }
  return issues;
}

/** Pure rule check for one entry; database checks (capacity, duplicates) live with the writers. */
export function checkEntryEligibility(
  players: EligibilityPlayer[],
  subEvent: EligibilitySubEvent,
  method: AgeCalculation,
): EligibilityIssue[] {
  const expectedCount = subEvent.competitorKind === 'DOUBLES' ? 2 : 1;
  if (players.length !== expectedCount) {
    const message = expectedCount === 2 ? 'Nội dung đôi cần đúng 2 VĐV' : 'Nội dung đơn cần đúng 1 VĐV';
    return [{ code: 'PLAYER_COUNT', message, overridable: false }];
  }
  if (players.length === 2 && players[0]!.id === players[1]!.id) {
    return [{ code: 'SAME_PLAYER', message: 'Hai VĐV trong cặp phải khác nhau', overridable: false }];
  }
  return [...genderIssues(players, subEvent.genderRule), ...ageIssues(players, subEvent, method)];
}
