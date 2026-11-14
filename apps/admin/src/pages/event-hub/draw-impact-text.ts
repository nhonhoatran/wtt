import type { Impact } from './draw-types';

const BLOCKED_TEXT: Record<string, string> = {
  POSITION_ALREADY_PLAYED: 'Vị trí này đã thi đấu nên không thay được.',
  DRAW_STRUCTURE_LOCKED: 'Nhánh đã khóa cấu trúc vì đã có trận bắt đầu.',
  DRAW_NOT_PUBLISHED: 'Nhánh chưa được công bố.',
  ENTRY_NOT_ELIGIBLE: 'Đăng ký này không đủ điều kiện vào nhánh.',
  WITHDRAWAL_POLICY_MISSING: 'Luật vòng bảng chưa chọn cách xử lý khi VĐV rút.',
  DRAW_NOT_DRAFT: 'Nhánh đã công bố, không còn là nháp.',
  ENTRY_NOT_IN_DRAW: 'VĐV này không có trong nhánh.',
  ENTRY_ALREADY_WITHDRAWN: 'VĐV này đã rút khỏi nhánh.',
  MATCH_IN_PROGRESS: 'Trận của VĐV đang diễn ra, hãy kết thúc trận trước.',
  POSITION_NOT_FOUND: 'Không tìm thấy vị trí này trong nhánh.',
  POSITION_NOT_REPLACEABLE: 'Vị trí này không thay VĐV được.',
  POSITION_ENTRY_WITHDRAWN: 'VĐV ở vị trí này đã rút khỏi nhánh.',
  DEPENDENT_DRAW_EXISTS: 'Nhánh chính đã được tạo từ các bảng này. Xóa nhánh chính trước.',
  GROUPS_ALREADY_PLACED: 'Người đi tiếp đã vào nhánh chính, hãy thao tác trên nhánh chính.',
  GROUP_RULE_MISSING: 'Nội dung chưa có luật tính điểm bảng.',
  ADVANCEMENT_CONFLICT: 'Trận kế tiếp đã có người, không đẩy VĐV lên được.',
  ROUND_STARTED: 'Vòng đã có trận bắt đầu nên không đổi được thể thức.',
  DRAW_STALE_ENTRIES: 'Danh sách VĐV đã thay đổi sau khi bốc thăm. Hãy bốc lại trước khi công bố.',
  ENTRY_IN_PUBLISHED_DRAW: 'VĐV đang nằm trong nhánh đã công bố, không đổi giai đoạn được.',
  KIND_NOT_ALLOWED: 'Thao tác này không áp dụng cho loại nhánh này.',
};

export const blockedText = (code: string | undefined) => (code ? (BLOCKED_TEXT[code] ?? `Không thực hiện được (${code}).`) : 'Không thực hiện được.');

const matchLabel = (impact: Impact) => (impact.matchNo !== undefined ? `Trận #${impact.matchNo}` : 'Một trận');

/** One Vietnamese sentence per impact the API reports. */
export function impactText(impact: Impact): string {
  switch (impact.type) {
    case 'WALKOVER':
      return impact.beneficiary ? `${matchLabel(impact)} thành walkover cho ${impact.beneficiary.displayName}` : `${matchLabel(impact)} thành walkover`;
    case 'VOID_MATCH':
      return `${matchLabel(impact)} bị hủy kết quả`;
    case 'REPLACE_SIDE':
      return `${impact.removed?.displayName ?? 'VĐV cũ'} được thay bằng ${impact.added?.displayName ?? 'VĐV mới'}${impact.matchNo !== undefined ? ` ở trận #${impact.matchNo}` : ''}`;
    case 'STANDINGS_RECOMPUTE':
      return impact.groupCode ? `Tính lại bảng xếp hạng bảng ${impact.groupCode}` : 'Tính lại bảng xếp hạng';
    case 'UNPUBLISH':
      return 'Nhánh đấu về trạng thái nháp và ngừng công khai';
  }
}
