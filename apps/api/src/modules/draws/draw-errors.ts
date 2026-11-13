import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DrawParamsError } from '@kamito/competition-engine';

export const drawNotFound = () => new NotFoundException({ code: 'DRAW_NOT_FOUND', message: 'Không tìm thấy nhánh đấu' });
export const subEventNotFound = () => new NotFoundException({ code: 'SUB_EVENT_NOT_FOUND', message: 'Không tìm thấy nội dung thi đấu' });

export const versionConflict = (currentVersion: number) =>
  new ConflictException({
    code: 'DRAW_VERSION_CONFLICT',
    message: 'Nhánh đấu vừa được người khác thay đổi. Tải lại rồi thao tác lại',
    currentVersion,
  });

export const notDraft = () => new ConflictException({ code: 'DRAW_NOT_DRAFT', message: 'Chỉ sửa được nhánh đang ở trạng thái nháp' });
export const alreadyPublished = () =>
  new ConflictException({ code: 'DRAW_ALREADY_PUBLISHED', message: 'Nhánh đã công bố, không thể bốc lại hay xóa' });
export const structureLocked = () =>
  new ConflictException({ code: 'DRAW_STRUCTURE_LOCKED', message: 'Đã có trận bắt đầu, cấu trúc nhánh bị khóa' });

export const conflict = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  new ConflictException({ code, message, ...extra });
export const invalid = (code: string, message: string) => new UnprocessableEntityException({ code, message });

/** Engine rejections are caller mistakes (parameters or data), not server faults. */
export function engineToHttp(error: unknown): unknown {
  return error instanceof DrawParamsError ? invalid(error.code, error.message) : error;
}

export function runEngine<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw engineToHttp(error);
  }
}

export const notPublished = () => new ConflictException({ code: 'DRAW_NOT_PUBLISHED', message: 'Nhánh chưa công bố' });
