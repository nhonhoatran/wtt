import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ScoreIssue } from '@kamito/competition-engine';

export const matchNotFound = () => new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Không tìm thấy trận đấu' });

export const matchVersionConflict = (currentVersion: number) =>
  new ConflictException({ code: 'MATCH_VERSION_CONFLICT', message: 'Trận vừa được cập nhật bởi người khác. Tải lại rồi thao tác lại', currentVersion });

export const matchStateInvalid = (message: string) => new ConflictException({ code: 'MATCH_STATE_INVALID', message });

export const matchNotReady = (message = 'Trận chưa đủ hai bên, chưa nhập được kết quả') =>
  new ConflictException({ code: 'MATCH_NOT_READY', message });

export const scoreInvalid = (issues: ScoreIssue[]) =>
  new UnprocessableEntityException({ code: 'SCORE_INVALID', message: issues[0]?.message ?? 'Tỷ số không hợp lệ', issues });
