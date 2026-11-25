import { MoreOutlined } from '@ant-design/icons';
import { EditButton, getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { CanAccess, useCan } from '@refinedev/core';
import { Button, Dropdown, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { GENDER_LABELS, GENDER_OPTIONS, PLAYER_ACTIVE_OPTIONS, type PlayerRecord } from './player-labels';
import { PlayerMergeModal } from './player-merge-modal';
import { useTableScroll } from '../../components/use-table-scroll';

export function PlayerList() {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const canManage = useCan({ resource: 'players', action: 'manage' }).data?.can ?? false;
  const [mergeTarget, setMergeTarget] = useState<PlayerRecord | null>(null);
  const { tableProps, searchFormProps, sorters, filters, setFilters, tableQuery } = useTable<PlayerRecord>({
    resource: 'players',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
  });

  return (
    <List
      title="Vận động viên"
      headerButtons={
        <CanAccess resource="players" action="create">
          <CreateButton>Thêm VĐV</CreateButton>
        </CanAccess>
      }
    >
      <ListFilterBar searchForm={searchFormProps.form}
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo tên hoặc mã VĐV' },
          { kind: 'select', field: 'gender', placeholder: 'Giới tính', options: GENDER_OPTIONS },
          { kind: 'search', field: 'club', placeholder: 'Câu lạc bộ' },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: PLAYER_ACTIVE_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        <Table.Column<PlayerRecord> dataIndex="code" title="Mã" sorter defaultSortOrder={getDefaultSortOrder('code', sorters)} />
        <Table.Column<PlayerRecord>
          dataIndex="fullName"
          title="Họ tên"
          sorter
          defaultSortOrder={getDefaultSortOrder('fullName', sorters)}
          render={(name: string, player) => <Link to={`/players/${player.id}/edit`}>{name}</Link>}
        />
        <Table.Column<PlayerRecord> dataIndex="gender" title="Giới tính" render={(gender: PlayerRecord['gender']) => GENDER_LABELS[gender]} />
        <Table.Column<PlayerRecord> dataIndex="birthYear" title="Năm sinh" sorter defaultSortOrder={getDefaultSortOrder('birthYear', sorters)} render={(year: number | null) => year ?? '—'} />
        <Table.Column<PlayerRecord> dataIndex="club" title="Câu lạc bộ" render={(club: string | null) => club ?? '—'} />
        <Table.Column<PlayerRecord> dataIndex="entryCount" title="Số lượt đăng ký" align="right" />
        <Table.Column<PlayerRecord>
          key="status"
          title="Trạng thái"
          render={(_, player) => (
            <Space size="small" wrap>
              {player.mergedIntoId ? <Tag>Đã gộp</Tag> : player.isActive ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Ngừng hoạt động</Tag>}
              {player.isPublicProfile ? <Tag color="blue">Hồ sơ công khai</Tag> : <Tag>Ẩn hồ sơ</Tag>}
            </Space>
          )}
        />
        <Table.Column<PlayerRecord>
          key="actions"
          title="Thao tác"
          render={(_, player) => (
            <Space size="small">
              <EditButton hideText size="small" recordItemId={player.id} />
              {canManage && !player.mergedIntoId && (
                <Dropdown menu={{ items: [{ key: 'merge', label: 'Gộp VĐV', onClick: () => setMergeTarget(player) }] }} trigger={['click']}>
                  <Button size="small" icon={<MoreOutlined />} aria-label="Thao tác khác" />
                </Dropdown>
              )}
            </Space>
          )}
        />
      </Table>
      <PlayerMergeModal target={mergeTarget} onClose={() => setMergeTarget(null)} onMerged={() => void tableQuery.refetch()} />
    </List>
  );
}
