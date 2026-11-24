import { CreateButton, List } from '@refinedev/antd';
import { Table } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import type { VenueRecord } from './venue-form';
import { useTableScroll } from '../../components/use-table-scroll';

const RESOURCE = 'venues';

export function VenueList() {
  const tableScroll = useTableScroll();
  const { canCreate } = useCatalogAccess();
  const { tableProps, sorters, filters, setFilters } = useCatalogTable<VenueRecord>(RESOURCE, { field: 'name', order: 'asc' });

  return (
    <List title="Địa điểm & bàn" headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm địa điểm</CreateButton> : undefined}>
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo tên, địa chỉ hoặc thành phố' },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        {sortColumn<VenueRecord>(sorters, 'name', 'Tên')}
        {sortColumn<VenueRecord>(sorters, 'city', 'Tỉnh / thành phố', (city: string | null) => city ?? '—')}
        <Table.Column<VenueRecord> key="address" dataIndex="address" title="Địa chỉ" render={(address: string | null) => address ?? '—'} />
        <Table.Column<VenueRecord> key="tableCount" dataIndex="tableCount" title="Số bàn" />
        {statusColumn<VenueRecord>()}
        {actionsColumn<VenueRecord>((venue) => ({ resource: RESOURCE, name: venue.name }))}
      </Table>
    </List>
  );
}
