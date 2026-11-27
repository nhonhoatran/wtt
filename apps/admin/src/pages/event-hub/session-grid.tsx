import { Button, Flex, Result, Skeleton, Table, Typography } from 'antd';
import { GridSlot, type ScheduleBoard } from './session-grid-cell';
import { TruncatedNotice } from './truncated-notice';
import { tableLabel, type SessionRecord } from './schedule-types';
import { useSessionGridMatches } from './use-session-grid-matches';
import { ScheduleDisciplineLegend } from './schedule-discipline-legend';

// Narrow enough for six tables beside the side panel; narrower screens scroll the grid sideways.
const GRID_MIN_COLUMN_WIDTH = 104;
const ORDER_COLUMN_WIDTH = 64;
const MIN_CELL_STYLE = { style: { minWidth: GRID_MIN_COLUMN_WIDTH } };

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

/** Columns are the session's tables, rows are turns (existing matches plus one empty row to append to). */
export function SessionGrid({ eventId, timeZone, session, canUpdate, board }: SessionGridProps) {
  const matches = useSessionGridMatches(eventId, session.id);

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
      <ScheduleDisciplineLegend matches={matches.data.data} />
      {matches.data.truncated && <TruncatedNotice action="hiện" shown={matches.data.data.length} total={matches.data.total} />}
      {canUpdate && (
        <Typography.Text type="secondary">
          {board.picked
            ? board.picked.tableId
              ? `Đang chọn trận #${board.picked.matchNo}: bấm vào ô trống để dời, bấm vào ô có trận để đổi chỗ, Esc để bỏ chọn.`
              : `Đang chọn trận #${board.picked.matchNo}: bấm vào ô trống để xếp, Esc để bỏ chọn. Ô đã có trận chỉ đổi chỗ được với trận đã xếp.`
            : 'Kéo trận thả vào ô, hoặc chọn một trận (ở danh sách hoặc trong lưới) rồi bấm ô muốn xếp. Bàn phím: Space để nhấc, mũi tên để chuyển ô, Space để thả.'}
        </Typography.Text>
      )}
      <Table<SlotRow>
        rowKey="order"
        size="small"
        bordered
        pagination={false}
        dataSource={rows}
        tableLayout="fixed"
        scroll={{ x: ORDER_COLUMN_WIDTH + GRID_MIN_COLUMN_WIDTH * session.tables.length }}
        columns={[
          { title: 'Lượt', dataIndex: 'order', width: ORDER_COLUMN_WIDTH, fixed: 'left' },
          ...session.tables.map((table) => ({
            title: tableLabel(table),
            key: table.tableId,
            onCell: () => MIN_CELL_STYLE,
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
