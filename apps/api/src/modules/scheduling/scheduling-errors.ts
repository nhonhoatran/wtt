import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export const scheduleMatchNotFound = () => new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Không tìm thấy trận đấu' });

export const sessionNotFound = () => new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Không tìm thấy buổi thi đấu' });

export const scheduleVersionConflict = (currentScheduleVersion: number) =>
  new ConflictException({
    code: 'SCHEDULE_VERSION_CONFLICT',
    message: 'Lịch của trận vừa được người khác thay đổi. Tải lại rồi xếp lại',
    // Same detail key as MATCH_VERSION_CONFLICT; here it carries the current scheduleVersion.
    currentVersion: currentScheduleVersion,
  });

export const matchNotSchedulable = (message: string) => new ConflictException({ code: 'MATCH_NOT_SCHEDULABLE', message });

export const slotOccupied = (message: string) => new ConflictException({ code: 'SCHEDULE_SLOT_OCCUPIED', message });

export const sessionFull = (cap: number) =>
  new ConflictException({ code: 'SESSION_FULL', message: `Buổi thi đấu đã đủ ${cap} trận, không xếp thêm được` });

export const tableNotInSession = () =>
  new UnprocessableEntityException({ code: 'TABLE_NOT_IN_SESSION', message: 'Bàn không thuộc buổi này', fields: { tableId: 'Bàn không thuộc buổi này' } });

export const concurrentScheduleRetry = () =>
  new ConflictException({ code: 'CONCURRENT_UPDATE_RETRY', message: 'Lịch vừa được thay đổi đồng thời, thử lại' });
