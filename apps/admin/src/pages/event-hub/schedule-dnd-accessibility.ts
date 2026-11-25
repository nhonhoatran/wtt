import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';
import type { ScheduleMatch } from './schedule-types';
import type { SlotTarget } from './use-schedule-board';

export const DRAGGABLE_ROLE_DESCRIPTION = 'trận có thể kéo';

const matchOf = (data: { current?: Record<string, unknown> } | undefined) => data?.current?.match as ScheduleMatch | undefined;
const targetOf = (data: { current?: Record<string, unknown> } | undefined) => data?.current?.target as SlotTarget | undefined;

const slotText = (target: SlotTarget | undefined, tableName: (tableId: string) => string) =>
  target ? `bàn ${tableName(target.tableId)}, thứ tự ${target.order}` : 'ngoài lưới';

/** Spoken feedback in Vietnamese; ids stay internal, only match numbers, table names and slot order are read out. */
export function scheduleAnnouncements(tableName: (tableId: string) => string): Announcements {
  const label = (data: Parameters<typeof matchOf>[0]) => `trận số ${matchOf(data)?.matchNo ?? ''}`;
  return {
    onDragStart: ({ active }) => `Đã nhấc ${label(active.data)}.`,
    onDragOver: ({ active, over }) => `${label(active.data)} đang ở ${slotText(targetOf(over?.data), tableName)}.`,
    onDragEnd: ({ active, over }) =>
      over ? `Đã thả ${label(active.data)} vào ${slotText(targetOf(over.data), tableName)}.` : `Đã thả ${label(active.data)} ra ngoài lưới, không đổi gì.`,
    onDragCancel: ({ active }) => `Đã hủy kéo ${label(active.data)}.`,
  };
}

export const scheduleScreenReaderInstructions: ScreenReaderInstructions = {
  draggable: 'Nhấn Space để nhấc trận, dùng phím mũi tên để chuyển ô, nhấn Space hoặc Enter để thả, Esc hoặc Tab để hủy. Hoặc nhấn Enter chọn trận rồi Enter vào ô trống để xếp.',
};
