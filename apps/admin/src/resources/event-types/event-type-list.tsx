import { CreateButton, List, useSelect } from '@refinedev/antd';
import { Space, Table, Tag } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import type { EventTypeRecord } from './event-type-form';

const RESOURCE = 'event-types';

export function EventTypeList() {
  const { canCreate } = useCatalogAccess();
  const { tableProps, sorters, filters, setFilters } = useCatalogTable<EventTypeRecord>(RESOURCE, { field: 'order', order: 'asc' });
  const { selectProps: tierSelect } = useSelect({
    resource: 'tiers',
    optionLabel: 'name',
    optionValue: 'id',
    onSearch: (text) => [{ field: 'q', operator: 'contains', value: text }],
  });

  return (
    <List title="Hạng giải" headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm hạng giải</CreateButton> : undefined}>
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo mã hoặc tên' },
          {
            kind: 'select',
            field: 'tierId',
            placeholder: 'Nhóm giải',
            options: (tierSelect.options ?? []).map((option) => ({ value: String(option.value), label: String(option.label) })),
            showSearch: true,
            onSearch: tierSelect.onSearch,
          },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={{ x: true }}>
        {sortColumn<EventTypeRecord>(sorters, 'order', 'Thứ tự')}
        {sortColumn<EventTypeRecord>(sorters, 'code', 'Mã')}
        {sortColumn<EventTypeRecord>(sorters, 'name', 'Tên')}
        <Table.Column<EventTypeRecord>
          key="tier"
          title="Nhóm giải"
          render={(_, eventType) => (
            <Space size="small">
              <Tag color={eventType.tier.colorHex}>{eventType.tier.name}</Tag>
            </Space>
          )}
        />
        {statusColumn<EventTypeRecord>()}
        {actionsColumn<EventTypeRecord>((eventType) => ({ resource: RESOURCE, name: eventType.name }))}
      </Table>
    </List>
  );
}
