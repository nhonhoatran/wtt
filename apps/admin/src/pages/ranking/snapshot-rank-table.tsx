import { getDefaultSortOrder, useTable } from '@refinedev/antd';
import { Table } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { playerCodeName } from '../../resources/players/player-labels';
import { SnapshotBreakdownTable, type BreakdownItem } from './snapshot-breakdown-table';
import { SnapshotMovementCell } from './snapshot-movement-cell';
import { useTableScroll } from '../../components/use-table-scroll';

interface SnapshotRankRow {
  playerId: string;
  rank: number;
  movement: number | null;
  points: number;
  resultsCounted: number;
  breakdown: BreakdownItem[];
  player: { id: string; code: string; fullName: string };
}

/** Server-side paged and sorted rows of one snapshot, with the point breakdown expandable per player. */
export function SnapshotRankTable({ snapshotId }: { snapshotId: string }) {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const { tableProps, sorters, filters, setFilters } = useTable<SnapshotRankRow>({
    resource: `ranking-snapshots/${snapshotId}/rows`,
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'rank', order: 'asc' }] },
  });

  return (
    <div>
      <ListFilterBar filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tên VĐV' }]} />
      <Table<SnapshotRankRow>
        {...tableProps}
        rowKey="playerId" scroll={tableScroll}
        expandable={{ rowExpandable: (row) => row.breakdown.length > 0, expandedRowRender: (row) => <SnapshotBreakdownTable items={row.breakdown} /> }}
      >
        <Table.Column<SnapshotRankRow> dataIndex="rank" title="Hạng" sorter defaultSortOrder={getDefaultSortOrder('rank', sorters)} />
        <Table.Column<SnapshotRankRow> dataIndex="movement" title="Biến động" sorter defaultSortOrder={getDefaultSortOrder('movement', sorters)} render={(movement: number | null) => <SnapshotMovementCell movement={movement} />} />
        <Table.Column<SnapshotRankRow> key="player" title="VĐV" render={(_, row) => playerCodeName(row.player)} />
        <Table.Column<SnapshotRankRow> dataIndex="points" title="Điểm" align="right" sorter defaultSortOrder={getDefaultSortOrder('points', sorters)} />
        <Table.Column<SnapshotRankRow> dataIndex="resultsCounted" title="Số kết quả" align="right" sorter defaultSortOrder={getDefaultSortOrder('resultsCounted', sorters)} />
      </Table>
    </div>
  );
}
