import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ScoreIssue } from '@kamito/competition-engine';

export const matchNotFound = () => new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Không tìm thấy trận đấu' });

export const matchVersionConflict = (currentVersion: number) =>
  new ConflictException({ code: 'MATCH_VERSION_CONFLICT', message: 'Trận vừa được cập nhật bởi người khác. Tải lại rồi thao tác lại', currentVersion });

export const matchStateInvalid = (message: string) => new ConflictException({ code: 'MATCH_STATE_INVALID', message });

export const matchNotReady = (message = 'Trận chưa đủ hai bên, chưa nhập được kết quả') =>
  new ConflictException({ code: 'MATCH_NOT_READY', message });

export const scoreInvalid = (issues: ScoreIssue[]) =>
  new UnprocessableEntityException({ code: 'SCORE_INVALID', message: issues[0]?.message ?? 'Tỷ số không hợp lệ', issues });

export const winnerChanged = () =>
  new BadRequestException({ code: 'MATCH_WINNER_CHANGED', message: 'Sửa tỷ số không được đổi người thắng. Dùng "Mở lại" để đổi người thắng' });

export const amendChangesPlacedRanks = () =>
  new ConflictException({
    code: 'AMEND_CHANGES_PLACED_RANKS',
    message: 'Tỷ số mới làm đổi thứ hạng của bảng đã đưa vào nhánh. Dùng "Mở lại" để sửa',
  });

export const reopenBlocked = (preview: unknown) =>
  new ConflictException({
    code: 'REOPEN_BLOCKED',
    message: 'Có trận phía sau đã đấu. Chỉ quản trị viên mới cưỡng chế mở lại được',
    preview,
  });

export const forceReopenAdminOnly = () =>
  new ForbiddenException({ code: 'FORCE_REOPEN_ADMIN_ONLY', message: 'Chỉ quản trị viên được cưỡng chế mở lại' });

export const reopenImpactChanged = (preview: unknown) =>
  new ConflictException({ code: 'REOPEN_IMPACT_CHANGED', message: 'Danh sách trận bị ảnh hưởng đã thay đổi từ lúc xem trước. Xem lại rồi xác nhận lần nữa', preview });
