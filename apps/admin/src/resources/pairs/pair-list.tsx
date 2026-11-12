import { getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { Table } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { DISPLAY_DATE_FORMAT } from '../events/event-labels';
import { playerCodeName } from '../players/player-labels';

interface PairPlayer {
  id: string;
  code: string;
  fullName: string;
}

interface PairRecord {
  id: string;
  competitorId: string;
  playerA: PairPlayer;
  playerB: PairPlayer;
  entryCount: number;
  createdAt: string;
}

const playerLink = (player: PairPlayer) => <Link to={`/players/${player.id}/edit`}>{playerCodeName(player)}</Link>;

/** Pairs are created implicitly by doubles entries, so this list is read-only. */
export function PairList() {
  const pageSize = useListPageSize();
  const { tableProps, sorters, filters, setFilters } = useTable<PairRecord>({
    resource: 'pairs',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
  });

  return (
    <List title="Cặp đôi">
      <ListFilterBar filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tên hoặc mã VĐV' }]} />
      <Table {...tableProps} rowKey="id">
        <Table.Column<PairRecord> key="playerA" title="VĐV 1" render={(_, pair) => playerLink(pair.playerA)} />
        <Table.Column<PairRecord> key="playerB" title="VĐV 2" render={(_, pair) => playerLink(pair.playerB)} />
        <Table.Column<PairRecord> dataIndex="entryCount" title="Số lượt đăng ký" align="right" />
        <Table.Column<PairRecord>
          dataIndex="createdAt"
          title="Ngày tạo"
          sorter
          defaultSortOrder={getDefaultSortOrder('createdAt', sorters)}
          render={(value: string) => dayjs(value).format(DISPLAY_DATE_FORMAT)}
        />
      </Table>
    </List>
  );
}
