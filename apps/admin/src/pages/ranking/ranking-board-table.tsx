import { getDefaultSortOrder, useTable } from '@refinedev/antd';
import { getDefaultFilter } from '@refinedev/core';
import { Button, Card, Flex, Input, Switch, Table, Typography, theme } from 'antd';
import { useEffect, useState } from 'react';
import { FormInstanceHost } from '../../components/form-instance-host';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../components/use-debounced-value';
import { useTableScroll } from '../../components/use-table-scroll';
import { useListPageSize } from '../../providers/use-list-page-size';
import { playerCodeName } from '../../resources/players/player-labels';
import { formatDelta, pointsDelta } from './ranking-board-labels';
import { SnapshotBreakdownTable, type BreakdownItem } from './snapshot-breakdown-table';
import { SnapshotMovementCell } from './snapshot-movement-cell';

interface BoardRow {
  playerId: string;
  rank: number;
  previousRank: number | null;
  movement: number | null;
  points: number;
  previousPoints: number | null;
  resultsCounted: number;
  breakdown: BreakdownItem[];
  player: { id: string; code: string; fullName: string; club: string | null };
}

/** Server-side searched, filtered, sorted and paged rows of one snapshot, compared with the previous period. */
export function RankingBoardTable({ snapshotId, hasPrevious }: { snapshotId: string; hasPrevious: boolean }) {
  const { token } = theme.useToken();
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useTable<BoardRow>({
    resource: `ranking-snapshots/${snapshotId}/rows`,
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'rank', order: 'asc' }] },
  });
  const applied = (getDefaultFilter('q', filters, 'eq') as string | undefined) ?? '';
  const onlyChanged = getDefaultFilter('changed', filters, 'eq') === 'true';
  const [text, setText] = useState(applied);
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => setText(applied), [applied]);
  useEffect(() => {
    if (debounced !== applied) setFilters([{ field: 'q', operator: 'eq', value: debounced || undefined }], 'merge');
    // Only a settled keystroke pushes a filter, and only when it differs from what is applied.
  }, [debounced]);

  const reset = () => {
    setText('');
    setFilters([], 'replace');
  };

  return (
    <Flex vertical gap="middle">
      <Card size="small">
        <FormInstanceHost form={searchFormProps.form} />
        <Flex wrap gap="middle" align="center">
          <Input.Search
            allowClear
            placeholder="Tìm theo tên, mã VĐV hoặc CLB"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onSearch={(value) => setText(value)}
            style={{ width: 320, maxWidth: '100%' }}
          />
          <Flex align="center" gap={token.marginXS}>
            <Switch
              checked={onlyChanged}
              disabled={!hasPrevious}
              aria-label="Chỉ hiện VĐV có thay đổi"
              onChange={(checked) => setFilters([{ field: 'changed', operator: 'eq', value: checked ? 'true' : undefined }], 'merge')}
            />
            <Typography.Text>Chỉ hiện VĐV có thay đổi</Typography.Text>
          </Flex>
          {(applied || onlyChanged) && <Button onClick={reset}>Đặt lại</Button>}
        </Flex>
      </Card>
      <Table<BoardRow>
        {...tableProps}
        rowKey="playerId"
        scroll={tableScroll}
        expandable={{
          rowExpandable: (row) => row.breakdown.length > 0,
          expandedRowRender: (row) => <SnapshotBreakdownTable items={row.breakdown} />,
        }}
      >
        <Table.Column<BoardRow> dataIndex="rank" title="Hạng" sorter defaultSortOrder={getDefaultSortOrder('rank', sorters)} />
        <Table.Column<BoardRow>
          dataIndex="movement"
          title="So với kỳ trước"
          sorter
          defaultSortOrder={getDefaultSortOrder('movement', sorters)}
          render={(movement: number | null, row) => <SnapshotMovementCell movement={movement} previousRank={row.previousRank} comparable={hasPrevious} />}
        />
        <Table.Column<BoardRow> key="player" title="VĐV" render={(_, row) => playerCodeName(row.player)} />
        <Table.Column<BoardRow> key="club" title="CLB" render={(_, row) => row.player.club ?? '—'} />
        <Table.Column<BoardRow> dataIndex="points" title="Điểm" align="right" sorter defaultSortOrder={getDefaultSortOrder('points', sorters)} />
        <Table.Column<BoardRow> key="previousPoints" title="Điểm kỳ trước" align="right" render={(_, row) => (hasPrevious ? (row.previousPoints ?? '—') : '—')} />
        <Table.Column<BoardRow> key="delta" title="Chênh lệch" align="right" render={(_, row) => formatDelta(pointsDelta(row.points, row.previousPoints, hasPrevious))} />
        <Table.Column<BoardRow> dataIndex="resultsCounted" title="Số giải tính điểm" align="right" sorter defaultSortOrder={getDefaultSortOrder('resultsCounted', sorters)} />
      </Table>
    </Flex>
  );
}
