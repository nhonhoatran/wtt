import { List } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { Table } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import {
  COMPETITOR_KIND_LABELS,
  COMPETITOR_KIND_OPTIONS,
  GENDER_RULE_LABELS,
  GENDER_RULE_OPTIONS,
  type DisciplineRecord,
} from './discipline-form';
import { useTableScroll } from '../../components/use-table-scroll';

const RESOURCE = 'disciplines';

export function DisciplineList() {
  const tableScroll = useTableScroll();
  const { canCreate } = useCatalogAccess();
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useCatalogTable<DisciplineRecord>(RESOURCE, { field: 'order', order: 'asc' });

  return (
    <List
      title="Nội dung chuẩn"
      headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm nội dung</CreateButton> : undefined}
    >
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
        {sortColumn<DisciplineRecord>(sorters, 'order', 'Thứ tự')}
        {sortColumn<DisciplineRecord>(sorters, 'code', 'Mã')}
        {sortColumn<DisciplineRecord>(sorters, 'name', 'Tên')}
        <Table.Column<DisciplineRecord> key="kind" title="Đơn / đôi" render={(_, row) => COMPETITOR_KIND_LABELS[row.competitorKind]} />
        <Table.Column<DisciplineRecord> key="gender" title="Giới tính" render={(_, row) => GENDER_RULE_LABELS[row.genderRule]} />
        {statusColumn<DisciplineRecord>()}
        {actionsColumn<DisciplineRecord>((row) => ({ resource: RESOURCE, name: row.name }))}
      </Table>
    </List>
  );
}
