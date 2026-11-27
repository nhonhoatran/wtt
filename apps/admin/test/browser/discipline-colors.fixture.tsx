import '@ant-design/v5-patch-for-react-19';
import { DndContext } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { createRoot } from 'react-dom/client';
import { SessionGrid } from '../../src/pages/event-hub/session-grid';
import type { SessionRecord } from '../../src/pages/event-hub/schedule-types';
import type { ScheduleBoard } from '../../src/pages/event-hub/session-grid-cell';

const session: SessionRecord = {
  id: 'fixture-session', eventId: 'fixture-event', venueId: null, date: '2026-11-27', code: 'AM', name: 'Buổi sáng', nameEn: null,
  startTime: '08:00', endTime: '12:00', matchCount: 3,
  tables: [1, 2, 3].map((order) => ({ tableId: `table-${order}`, code: `B${order}`, displayName: null, order })),
};
const board: ScheduleBoard = { picked: null, busy: false, setPicked: () => {}, moveTo: () => {}, unschedule: () => {}, reload: async () => [] };
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App><DndContext><SessionGrid eventId="fixture-event" timeZone="Asia/Ho_Chi_Minh" session={session} canUpdate={false} board={board} /></DndContext></App>
  </QueryClientProvider>,
);
