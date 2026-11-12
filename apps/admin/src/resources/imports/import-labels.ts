export type ImportStatus = 'AWAITING_UPLOAD' | 'UPLOADED' | 'VALIDATING' | 'VALIDATED' | 'COMMITTING' | 'DONE' | 'FAILED';
export type ImportRowStatus = 'VALID' | 'ERROR' | 'NEEDS_CONFIRM' | 'COMMITTED';
export type ImportPlayerAction = 'LINK_PLAYER' | 'CREATE_PLAYER' | 'NEEDS_CONFIRM';

export interface ImportJob {
  id: string;
  eventId: string;
  event: { id: string; name: string; slug: string };
  fileName: string;
  fileSize: number;
  status: ImportStatus;
  failureReason: string | null;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  needsConfirmRows: number | null;
  committedRows: number | null;
  createdAt: string;
  finishedAt: string | null;
  countsByStatus?: Record<ImportRowStatus, number>;
}

export interface ImportCandidate {
  id: string;
  code: string;
  fullName: string;
  gender: string;
  birthYear: number | null;
  club: string | null;
}

export interface ImportRowPlayer {
  slot: number;
  code: string | null;
  fullName: string | null;
  gender: string | null;
  birthYear: number | null;
  club: string | null;
  action: ImportPlayerAction;
  playerId: string | null;
}

export interface ImportRow {
  rowNo: number;
  status: ImportRowStatus;
  plannedAction: string;
  data: {
    subEventCode: string;
    stage: string | null;
    quotaType: string | null;
    seed: number | null;
    notes: string | null;
    players: ImportRowPlayer[];
  };
  messages: string[];
  candidates: { slot: number; players: ImportCandidate[] }[];
  decisions: Record<string, string> | null;
}

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  AWAITING_UPLOAD: 'Chờ tải file',
  UPLOADED: 'Đã tải file',
  VALIDATING: 'Đang kiểm tra',
  VALIDATED: 'Đã kiểm tra',
  COMMITTING: 'Đang nhập',
  DONE: 'Hoàn tất',
  FAILED: 'Lỗi',
};

export const IMPORT_STATUS_COLORS: Record<ImportStatus, string | undefined> = {
  AWAITING_UPLOAD: undefined,
  UPLOADED: 'blue',
  VALIDATING: 'blue',
  VALIDATED: 'gold',
  COMMITTING: 'blue',
  DONE: 'green',
  FAILED: 'red',
};

export const IMPORT_STATUS_OPTIONS = (Object.keys(IMPORT_STATUS_LABELS) as ImportStatus[]).map((value) => ({
  value,
  label: IMPORT_STATUS_LABELS[value],
}));

/** Tab order on the preview: what needs the operator first. */
export const ROW_STATUS_ORDER: ImportRowStatus[] = ['NEEDS_CONFIRM', 'ERROR', 'VALID', 'COMMITTED'];

export const ROW_STATUS_LABELS: Record<ImportRowStatus, string> = {
  NEEDS_CONFIRM: 'Cần xác nhận',
  ERROR: 'Lỗi',
  VALID: 'Hợp lệ',
  COMMITTED: 'Đã nhập',
};

export const ROW_STATUS_COLORS: Record<ImportRowStatus, string> = {
  NEEDS_CONFIRM: 'gold',
  ERROR: 'red',
  VALID: 'green',
  COMMITTED: 'blue',
};

export const PLAYER_ACTION_LABELS: Record<ImportPlayerAction, string> = {
  LINK_PLAYER: 'VĐV có sẵn',
  CREATE_PLAYER: 'Tạo VĐV mới',
  NEEDS_CONFIRM: 'Cần chọn',
};

/** Statuses during which a worker is busy; the page polls while in one of them. */
export const BUSY_STATUSES: ImportStatus[] = ['UPLOADED', 'VALIDATING', 'COMMITTING'];
export const IMPORT_POLL_MS = 2000;
export const NEW_PLAYER_CHOICE = 'NEW';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

export const importKey = (id: string) => ['admin-import', id];

export const formatFileSize = (bytes: number) =>
  bytes >= BYTES_PER_MB ? `${(bytes / BYTES_PER_MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
