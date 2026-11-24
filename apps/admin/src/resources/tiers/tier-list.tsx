import { CreateButton, List } from '@refinedev/antd';
import { Space, Table, theme } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import type { TierRecord } from './tier-form';
import { useTableScroll } from '../../components/use-table-scroll';

const RESOURCE = 'tiers';

export function TierList() {
  const tableScroll = useTableScroll();
  const { token } = theme.useToken();
  const { canCreate } = useCatalogAccess();
  const { tableProps, sorters, filters, setFilters } = useCatalogTable<TierRecord>(RESOURCE, { field: 'order', order: 'asc' });

  return (
    <List title="Nhóm giải" headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm nhóm giải</CreateButton> : undefined}>
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo mã hoặc tên' },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        {sortColumn<TierRecord>(sorters, 'order', 'Thứ tự')}
        {sortColumn<TierRecord>(sorters, 'code', 'Mã')}
        {sortColumn<TierRecord>(sorters, 'name', 'Tên', (_, tier) => (
          <Space size="small">
            <span
              aria-hidden
              style={{ display: 'inline-block', width: token.size, height: token.size, borderRadius: token.borderRadiusSM, background: tier.colorHex }}
            />
            {tier.name}
          </Space>
        ))}
        {statusColumn<TierRecord>()}
        {actionsColumn<TierRecord>((tier) => ({ resource: RESOURCE, name: tier.name }))}
      </Table>
    </List>
  );
}
