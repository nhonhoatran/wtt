import { CreateButton, List } from '@refinedev/antd';
import { Table, Tag } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import { CATEGORY_KIND_LABELS, CATEGORY_KIND_OPTIONS, type CategoryRecord } from './category-form';

const RESOURCE = 'categories';

const ageRange = ({ minAge, maxAge }: CategoryRecord) => {
  if (minAge === null && maxAge === null) return '—';
  if (minAge !== null && maxAge !== null) return `${minAge}–${maxAge} tuổi`;
  return minAge !== null ? `Từ ${minAge} tuổi` : `Đến ${maxAge} tuổi`;
};

export function CategoryList() {
  const { canCreate } = useCatalogAccess();
  const { tableProps, sorters, filters, setFilters } = useCatalogTable<CategoryRecord>(RESOURCE, { field: 'order', order: 'asc' });

  return (
    <List
      title="Nhóm tuổi / trình độ"
      headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm nhóm</CreateButton> : undefined}
    >
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo mã hoặc tên' },
          { kind: 'select', field: 'kind', placeholder: 'Loại', options: CATEGORY_KIND_OPTIONS },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id">
        {sortColumn<CategoryRecord>(sorters, 'order', 'Thứ tự')}
        {sortColumn<CategoryRecord>(sorters, 'code', 'Mã')}
        {sortColumn<CategoryRecord>(sorters, 'name', 'Tên')}
        {sortColumn<CategoryRecord>(sorters, 'kind', 'Loại', (kind: CategoryRecord['kind']) => <Tag>{CATEGORY_KIND_LABELS[kind]}</Tag>)}
        <Table.Column<CategoryRecord> key="age" title="Độ tuổi" render={(_, category) => ageRange(category)} />
        {statusColumn<CategoryRecord>()}
        {actionsColumn<CategoryRecord>((category) => ({ resource: RESOURCE, name: category.name }))}
      </Table>
    </List>
  );
}
