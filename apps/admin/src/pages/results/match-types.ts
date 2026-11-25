export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
export type MatchResultType = 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED';
export type MatchStatusFilter = 'OPEN' | MatchStatus;

export interface EntryBrief {
  id: string;
  displayName: string;
  /** Seed number from the draw; null or missing when the entry is not seeded. */
  seed?: number | null;
  players: { id: string; fullName: string; club: string | null }[];
}

export interface MatchListItem {
  id: string;
  matchNo: number;
  eventId: string;
  subEventId: string;
  subEventCode: string;
  subEventName: string | null;
  drawKind: 'MAIN' | 'QUALIFYING' | 'GROUP';
  roundCode: string;
  groupCode: string | null;
  status: MatchStatus;
  resultType: MatchResultType | null;
  winnerSide: 1 | 2 | null;
  /** Null until the match has an official result (SCHEDULED and LIVE rows). */
  games1: number | null;
  games2: number | null;
  side1: EntryBrief | null;
  side2: EntryBrief | null;
  ready: boolean;
  version: number;
  sessionId?: string | null;
  tableId?: string | null;
  tableCode?: string | null;
  tableName?: string | null;
  orderInSession?: number | null;
  scheduledAt?: string | null;
}

export interface MatchDetail extends MatchListItem {
  games: { number: number; score1: number; score2: number }[];
  format: { name: string; bestOf: number; pointsPerGame: number; winBy: number };
}

export interface MatchWriteResponse {
  data: MatchDetail;
  warnings?: string[];
}

export type ReopenEffect = 'CLEAR_SIDE' | 'REVERT_AUTO' | 'RESET_RESULT';

export interface ReopenCell {
  matchId: string;
  matchNo: number;
  side: 1 | 2;
  entryId: string;
  entryName: string;
  status: MatchStatus;
  effect: ReopenEffect;
  via: 'ADVANCE' | 'SEAT';
}

export interface ReopenPreview {
  affected: ReopenCell[];
  blocking: ReopenCell[];
}

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = { SCHEDULED: 'Chưa đấu', LIVE: 'Đang đấu', OFFICIAL: 'Đã chốt' };
export const MATCH_STATUS_COLORS: Record<MatchStatus, string | undefined> = { SCHEDULED: undefined, LIVE: 'processing', OFFICIAL: 'green' };

export const STATUS_FILTER_OPTIONS: { value: MatchStatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Chưa chốt' },
  { value: 'SCHEDULED', label: 'Chưa đấu' },
  { value: 'LIVE', label: 'Đang đấu' },
  { value: 'OFFICIAL', label: 'Đã chốt' },
];

export const RESULT_TYPE_LABELS: Record<MatchResultType, string> = {
  NORMAL: 'Kết quả thường',
  WALKOVER: 'Không đến',
  RETIRED: 'Bỏ cuộc giữa trận',
  DISQUALIFIED: 'Truất quyền thi đấu',
};

export const PENDING_SIDE_LABEL = 'Chờ xác định';
export const MATCH_CONFLICT_TEXT = 'Trận vừa được cập nhật bởi người khác';
export const PUBLIC_REFRESH_DELAYED = 'PUBLIC_REFRESH_DELAYED';

export const sideName = (side: EntryBrief | null): string => side?.displayName ?? PENDING_SIDE_LABEL;
export const isOpenMatch = (match: Pick<MatchListItem, 'status' | 'ready'>): boolean => match.ready && match.status !== 'OFFICIAL';
export const firstOpenMatch = (rows: readonly MatchListItem[] | undefined): MatchListItem | undefined => rows?.find(isOpenMatch);

export const matchScoreText = (match: Pick<MatchListItem, 'status' | 'resultType' | 'games1' | 'games2'>): string => {
  if (match.games1 === null || match.games2 === null) return '';
  const score = `${match.games1}–${match.games2}`;
  return match.resultType && match.resultType !== 'NORMAL' ? `${score} (${RESULT_TYPE_LABELS[match.resultType]})` : score;
};

export const formatText = (format: MatchDetail['format']): string => `${format.bestOf} ván · ${format.pointsPerGame} điểm · cách ${format.winBy}`;

export const matchesKey = (eventId: string | undefined) => ['admin-matches', eventId];
export const matchDetailKey = (matchId: string | null) => ['admin-match', matchId];
