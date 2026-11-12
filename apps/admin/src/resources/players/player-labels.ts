export type Gender = 'MALE' | 'FEMALE';
export type Handedness = 'LEFT' | 'RIGHT';

export interface PlayerRecord {
  id: string;
  code: string;
  slug: string;
  fullName: string;
  fullNameEn: string | null;
  publicDisplayName: string | null;
  gender: Gender;
  birthDate: string | null;
  birthYear: number | null;
  club: string | null;
  city: string | null;
  countryCode: string;
  isActive: boolean;
  isPublicProfile: boolean;
  noindex: boolean;
  mergedIntoId: string | null;
  photoMediaId: string | null;
  entryCount: number;
}

export interface PlayerDetail extends PlayerRecord {
  phone: string | null;
  email: string | null;
  handedness: Handedness | null;
  gripStyle: string | null;
  playStyle: string | null;
  bio: string | null;
  bioEn: string | null;
  mergedInto: { id: string; code: string; fullName: string } | null;
  pairCount: number;
}

export interface PlayerLookupItem {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  birthYear: number | null;
  club: string | null;
}

export const PLAYER_FORM_MAX_WIDTH = 720;

export const GENDER_LABELS: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ' };
export const GENDER_OPTIONS = (Object.keys(GENDER_LABELS) as Gender[]).map((value) => ({ value, label: GENDER_LABELS[value] }));

export const HANDEDNESS_OPTIONS: { value: Handedness; label: string }[] = [
  { value: 'RIGHT', label: 'Tay phải' },
  { value: 'LEFT', label: 'Tay trái' },
];

export const PLAYER_ACTIVE_OPTIONS = [
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Ngừng hoạt động' },
];

/** "Nguyễn Văn A – CLB X – 1990": the operator tells namesakes apart by club and birth year. */
export const playerSummary = (player: Pick<PlayerLookupItem, 'fullName' | 'club' | 'birthYear'>) =>
  [player.fullName, player.club ?? 'Chưa có CLB', player.birthYear ?? 'chưa rõ năm sinh'].join(' – ');

export const playerCodeName = (player: Pick<PlayerLookupItem, 'code' | 'fullName'>) => `${player.code} – ${player.fullName}`;

export const playerOptionLabel = (player: PlayerLookupItem) =>
  `${playerCodeName(player)} · ${player.club ?? 'Chưa có CLB'} · ${player.birthYear ?? 'chưa rõ năm sinh'}`;
