import { CreateButton, List } from '@refinedev/antd';
import { Table } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import type { MatchFormatRecord } from './match-format-form';

const RESOURCE = 'match-formats';

export function MatchFormatList() {
  const { canCreate } = useCatalogAccess();
  const { tableProps, sorters, filters, setFilters } = useCatalogTable<MatchFormatRecord>(RESOURCE, { field: 'name', order: 'asc' });

  return (
    <List title="Thể thức trận" headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm thể thức</CreateButton> : undefined}>
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo tên' },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={{ x: true }}>
        {sortColumn<MatchFormatRecord>(sorters, 'name', 'Tên')}
        {sortColumn<MatchFormatRecord>(sorters, 'bestOf', 'Số ván tối đa', (bestOf: number) => `${bestOf} ván`)}
        {sortColumn<MatchFormatRecord>(sorters, 'pointsPerGame', 'Điểm mỗi ván', (points: number) => `${points} điểm`)}
        <Table.Column<MatchFormatRecord> key="winBy" title="Cách biệt" render={(_, row) => `${row.winBy} điểm`} />
        {sortColumn<MatchFormatRecord>(sorters, 'estimatedMinutes', 'Ước tính', (minutes: number) => `${minutes} phút`)}
        {statusColumn<MatchFormatRecord>()}
        {actionsColumn<MatchFormatRecord>((row) => ({ resource: RESOURCE, name: row.name, supportsDefault: true }))}
      </Table>
    </List>
  );
}
