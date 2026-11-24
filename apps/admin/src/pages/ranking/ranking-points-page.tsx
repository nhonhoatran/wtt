import { PlusOutlined } from '@ant-design/icons';
import { getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { getDefaultFilter, useCan, useInvalidate } from '@refinedev/core';
import { Button, Flex, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { playerCodeName } from '../../resources/players/player-labels';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { ManualPointsForm } from './manual-points-form';
import { POINTS_SOURCE_COLORS, POINTS_SOURCE_LABELS, POINTS_SOURCE_OPTIONS, POINTS_VALIDITY_OPTIONS, type PointsSource } from './ranking-labels';
import { RankingPointsDeleteModal, type DeletablePoints } from './ranking-points-delete-modal';
import { useRankingPointsFilterOptions } from './use-ranking-points-filter-options';

interface PointsRow {
  id: string;
  source: PointsSource;
  points: number;
  stageCode: string | null;
  earnedAt: string;
  expiresAt: string;
  reason: string | null;
  player: { id: string; code: string; fullName: string };
  event: { id: string; name: string } | null;
  subEvent: { id: string; code: string; name: string | null } | null;
  rankingList: { id: string; code: string; name: string };
}

const RESOURCE = 'ranking-points';
const dateText = (value: string) => dayjs(value).format(DISPLAY_DATE_FORMAT);
const isExpired = (row: PointsRow) => !dayjs(row.expiresAt).isAfter(dayjs(), 'day');

export function RankingPointsPage() {
  const pageSize = useListPageSize();
  const invalidate = useInvalidate();
  const canCreate = useCan({ resource: 'rankings', action: 'create' }).data?.can ?? false;
  const canDelete = useCan({ resource: 'rankings', action: 'delete' }).data?.can ?? false;
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<DeletablePoints | null>(null);
  const { tableProps, sorters, filters, setFilters } = useTable<PointsRow>({
    resource: RESOURCE,
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'earnedAt', order: 'desc' }] },
  });
  const options = useRankingPointsFilterOptions(filters);
  const refresh = () => void invalidate({ resource: RESOURCE, invalidates: ['list'] });

  return (
    <List
      title="Sổ điểm"
      headerButtons={
        canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Thêm điểm thủ công
          </Button>
        ) : undefined
      }
    >
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'select', field: 'rankingListId', placeholder: 'Bảng xếp hạng', showSearch: true, ...options.lists },
          { kind: 'select', field: 'playerId', placeholder: 'Vận động viên', showSearch: true, ...options.players },
          { kind: 'select', field: 'eventId', placeholder: 'Giải', showSearch: true, ...options.events },
          { kind: 'select', field: 'source', placeholder: 'Nguồn', options: POINTS_SOURCE_OPTIONS },
          { kind: 'select', field: 'active', placeholder: 'Hiệu lực', options: POINTS_VALIDITY_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={{ x: true }}>
        <Table.Column<PointsRow> key="player" title="VĐV" render={(_, row) => playerCodeName(row.player)} />
        <Table.Column<PointsRow> key="list" title="Bảng" render={(_, row) => row.rankingList.name} />
        <Table.Column<PointsRow> key="event" title="Giải" render={(_, row) =>
            row.event ? (
              <Flex vertical>
                <span>{row.event.name}</span>
                {row.subEvent && <Typography.Text type="secondary">{row.subEvent.name ?? row.subEvent.code}</Typography.Text>}
              </Flex>
            ) : (
              '—'
            )
          }
        />
        <Table.Column<PointsRow> key="stage" title="Vòng" render={(_, row) => row.stageCode ?? '—'} />
        <Table.Column<PointsRow>
          dataIndex="points"
          title="Điểm"
          align="right"
          sorter
          defaultSortOrder={getDefaultSortOrder('points', sorters)}
          render={(points: number) => <Typography.Text strong>{points}</Typography.Text>}
        />
        <Table.Column<PointsRow>
          key="source"
          title="Nguồn"
          render={(_, row) => <Tag color={POINTS_SOURCE_COLORS[row.source]}>{POINTS_SOURCE_LABELS[row.source]}</Tag>}
        />
        <Table.Column<PointsRow>
          dataIndex="earnedAt"
          title="Ngày đạt"
          sorter
          defaultSortOrder={getDefaultSortOrder('earnedAt', sorters)}
          render={dateText}
        />
        <Table.Column<PointsRow>
          dataIndex="expiresAt"
          title="Hết hạn"
          sorter
          defaultSortOrder={getDefaultSortOrder('expiresAt', sorters)}
          render={(_, row) =>
            isExpired(row) ? (
              <Space size="small">
                <Typography.Text type="secondary">{dateText(row.expiresAt)}</Typography.Text>
                <Tag>Hết hạn</Tag>
              </Space>
            ) : (
              dateText(row.expiresAt)
            )
          }
        />
        <Table.Column<PointsRow> key="reason" title="Lý do" render={(_, row) => row.reason ?? '—'} />
        {canDelete && (
          <Table.Column<PointsRow>
            key="actions"
            title="Thao tác"
            render={(_, row) =>
              row.source === 'MANUAL' ? (
                <Button
                  danger
                  size="small"
                  onClick={() => setDeleting({ id: row.id, points: row.points, playerLabel: playerCodeName(row.player) })}
                >
                  Xóa
                </Button>
              ) : null
            }
          />
        )}
      </Table>
      <ManualPointsForm
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={refresh}
        defaultListId={getDefaultFilter('rankingListId', filters, 'eq') as string | undefined}
      />
      <RankingPointsDeleteModal target={deleting} onClose={() => setDeleting(null)} onDeleted={refresh} />
    </List>
  );
}
