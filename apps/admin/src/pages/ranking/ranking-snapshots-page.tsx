import { PlusOutlined } from '@ant-design/icons';
import { getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { useCan } from '@refinedev/core';
import { Button, Flex, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogRows } from '../../resources/events/use-catalog-options';
import { useListPageSize } from '../../providers/use-list-page-size';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { SNAPSHOT_STATUS_COLORS, SNAPSHOT_STATUS_LABELS, SNAPSHOT_STATUS_OPTIONS, type SnapshotStatus } from './ranking-labels';
import { SnapshotDraftModal } from './snapshot-draft-modal';
import { SnapshotJobsTracker, type SnapshotJobRef } from './snapshot-jobs-tracker';

export interface SnapshotRecord {
  id: string;
  rankingListId: string;
  rankingList: { id: string; code: string; name: string };
  asOfDate: string;
  status: SnapshotStatus;
  publishedAt: string | null;
  publishedById: string | null;
  publishedBy: { id: string; name: string } | null;
  _count: { rows: number };
  dirtySubEvents: number;
}

export const formatSnapshotDate = (value: string) => dayjs(value.slice(0, 10)).format(DISPLAY_DATE_FORMAT);
const formatTime = (value: string | null) => (value ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—');

export function RankingSnapshotsPage() {
  const pageSize = useListPageSize();
  const canCreate = useCan({ resource: 'rankings', action: 'create' }).data?.can ?? false;
  const lists = useCatalogRows('ranking-lists', { isActive: '' });
  const { tableProps, sorters, filters, setFilters, tableQuery } = useTable<SnapshotRecord>({
    resource: 'ranking-snapshots',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'asOfDate', order: 'desc' }] },
  });
  const [creating, setCreating] = useState(false);
  const [jobs, setJobs] = useState<SnapshotJobRef[]>([]);
  const refetch = tableQuery.refetch;
  const onFinished = useCallback(() => void refetch(), [refetch]);

  return (
    <List title="Kỳ chốt" headerButtons={canCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Tạo bản nháp</Button> : undefined}>
      <Flex vertical gap="middle">
        {jobs.length > 0 && <SnapshotJobsTracker key={jobs.map((job) => job.jobId).join()} jobs={jobs} onFinished={onFinished} />}
        <div>
        <ListFilterBar
          filters={filters}
          setFilters={setFilters}
          fields={[
            { kind: 'select', field: 'listId', placeholder: 'Bảng xếp hạng', options: (lists.data ?? []).map((list) => ({ value: list.id, label: list.name })) },
            { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: SNAPSHOT_STATUS_OPTIONS },
          ]}
        />
        <Table<SnapshotRecord> {...tableProps} rowKey="id" scroll={{ x: true }}>
          <Table.Column<SnapshotRecord> key="list" title="Bảng XH" render={(_, row) => <Link to={`/ranking-snapshots/${row.id}`}>{row.rankingList.name}</Link>} />
          <Table.Column<SnapshotRecord>
            dataIndex="asOfDate"
            title="Ngày chốt"
            sorter
            defaultSortOrder={getDefaultSortOrder('asOfDate', sorters)}
            render={formatSnapshotDate}
          />
          <Table.Column<SnapshotRecord> dataIndex="status" title="Trạng thái" render={(status: SnapshotStatus) => <Tag color={SNAPSHOT_STATUS_COLORS[status]}>{SNAPSHOT_STATUS_LABELS[status]}</Tag>} />
          <Table.Column<SnapshotRecord> key="rows" title="Số VĐV" align="right" render={(_, row) => row._count.rows} />
          <Table.Column<SnapshotRecord>
            key="dirty"
            title="Chưa tính lại"
            render={(_, row) => (row.dirtySubEvents > 0 ? <Tag color="orange">{row.dirtySubEvents} nội dung chưa tính lại</Tag> : '—')}
          />
          <Table.Column<SnapshotRecord>
            dataIndex="publishedAt"
            title="Công bố lúc / bởi"
            sorter
            defaultSortOrder={getDefaultSortOrder('publishedAt', sorters)}
            render={(value: string | null, row) => (value && row.publishedBy ? `${formatTime(value)} · ${row.publishedBy.name}` : formatTime(value))}
          />
        </Table>
        </div>
      </Flex>
      <SnapshotDraftModal
        open={creating}
        onClose={() => setCreating(false)}
        onQueued={(queued) => {
          setCreating(false);
          setJobs(queued);
        }}
      />
    </List>
  );
}
