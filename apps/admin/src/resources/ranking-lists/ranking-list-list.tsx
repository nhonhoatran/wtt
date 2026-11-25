import { List } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { Table } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { COMPETITOR_KIND_LABELS, COMPETITOR_KIND_OPTIONS, GENDER_RULE_LABELS, GENDER_RULE_OPTIONS } from '../../pages/ranking/ranking-labels';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import type { RankingListRecord } from './ranking-list-form';
import { useTableScroll } from '../../components/use-table-scroll';

const RESOURCE = 'ranking-lists';
const PERMISSION = 'rankings';

export function RankingListList() {
  const tableScroll = useTableScroll();
  const { canCreate } = useCatalogAccess(PERMISSION);
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useCatalogTable<RankingListRecord>(RESOURCE, { field: 'order', order: 'asc' });

  return (
    <List title="Bảng xếp hạng" headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm bảng xếp hạng</CreateButton> : undefined}>
      <ListFilterBar searchForm={searchFormProps.form}
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo mã hoặc tên' },
          { kind: 'select', field: 'competitorKind', placeholder: 'Đơn / đôi', options: COMPETITOR_KIND_OPTIONS },
          { kind: 'select', field: 'genderRule', placeholder: 'Giới tính', options: GENDER_RULE_OPTIONS },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        {sortColumn<RankingListRecord>(sorters, 'order', 'Thứ tự')}
        {sortColumn<RankingListRecord>(sorters, 'code', 'Mã')}
        {sortColumn<RankingListRecord>(sorters, 'name', 'Tên')}
        <Table.Column<RankingListRecord> key="kind" title="Đơn / đôi" render={(_, row) => COMPETITOR_KIND_LABELS[row.competitorKind]} />
        <Table.Column<RankingListRecord> key="gender" title="Giới tính" render={(_, row) => GENDER_RULE_LABELS[row.genderRule]} />
        <Table.Column<RankingListRecord>
          key="category"
          title="Nhóm tuổi / trình độ"
          render={(_, row) => row.category?.name ?? '—'}
        />
        {sortColumn<RankingListRecord>(sorters, 'validityDays', 'Thời hạn', (days: number) => `${days} ngày`)}
        {statusColumn<RankingListRecord>()}
        {actionsColumn<RankingListRecord>((row) => ({ resource: RESOURCE, name: row.name, permission: PERMISSION }))}
      </Table>
    </List>
  );
}
