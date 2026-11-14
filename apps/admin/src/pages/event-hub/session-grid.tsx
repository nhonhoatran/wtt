import { useQuery } from '@tanstack/react-query';
import { Button, Flex, Result, Skeleton, Table, Typography } from 'antd';
import { apiFetch } from '../../api/http-client';
import { GridSlot, type ScheduleBoard } from './session-grid-cell';
import { TruncatedNotice } from './truncated-notice';
import { scheduleKey, tableLabel, type ScheduleMatch, type SessionRecord } from './schedule-types';

const GRID_COLUMN_WIDTH = 240;
const ORDER_COLUMN_WIDTH = 56;

interface SessionGridProps {
  eventId: string;
  timeZone: string;
  session: SessionRecord;
  canUpdate: boolean;
  board: ScheduleBoard;
}

interface SlotRow {
  order: number;
}

/** Columns are the session's tables, rows are order slots (existing matches plus one empty row to append to). */
export function SessionGrid({ eventId, timeZone, session, canUpdate, board }: SessionGridProps) {
  const matches = useQuery({
    queryKey: [...scheduleKey(eventId), 'grid', session.id],
    queryFn: async () =>
      apiFetch<{ data: ScheduleMatch[]; total: number; truncated?: boolean }>(`/admin/events/${eventId}/matches?${new URLSearchParams({ 'filter[sessionId]': session.id })}`),
  });

  if (matches.isLoading) return <Skeleton active />;
  if (matches.isError || !matches.data) {
    return <Result status="error" title="Không tải được lưới xếp lịch" extra={<Button onClick={() => matches.refetch()}>Thử lại</Button>} />;
  }

  const placed = matches.data.data.filter((match) => match.tableId && match.orderInSession);
  const slotOf = new Map(placed.map((match) => [`${match.tableId}:${match.orderInSession}`, match]));
  const maxOrder = placed.reduce((max, match) => Math.max(max, match.orderInSession ?? 0), 0);
  const rows: SlotRow[] = Array.from({ length: maxOrder + 1 }, (_, index) => ({ order: index + 1 }));

  return (
    <Flex vertical gap="small">
      {matches.data.truncated && <TruncatedNotice action="hiện" shown={matches.data.data.length} total={matches.data.total} />}
      {canUpdate && (
        <Typography.Text type="secondary">
          {board.picked
            ? board.picked.tableId
              ? `Đang chọn trận #${board.picked.matchNo}: bấm vào ô trống để dời, bấm vào ô có trận để đổi chỗ, Esc để bỏ chọn.`
              : `Đang chọn trận #${board.picked.matchNo}: bấm vào ô trống để xếp, Esc để bỏ chọn. Ô đã có trận chỉ đổi chỗ được với trận đã xếp.`
            : 'Chọn một trận (ở danh sách bên trái hoặc trong lưới) rồi bấm ô muốn xếp, hoặc kéo trận thả vào ô.'}
        </Typography.Text>
      )}
      <Table<SlotRow>
        rowKey="order"
        size="small"
        bordered
        pagination={false}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '#', dataIndex: 'order', width: ORDER_COLUMN_WIDTH, fixed: 'left' },
          ...session.tables.map((table) => ({
            title: tableLabel(table),
            key: table.tableId,
            width: GRID_COLUMN_WIDTH,
            render: (_: unknown, row: SlotRow) => (
              <GridSlot
                board={board}
                canUpdate={canUpdate}
                timeZone={timeZone}
                sessionId={session.id}
                table={table}
                order={row.order}
                match={slotOf.get(`${table.tableId}:${row.order}`) ?? null}
              />
            ),
          })),
        ]}
      />
    </Flex>
  );
}
