import { getDefaultSortOrder, useTable } from '@refinedev/antd';
import { Space, Table, Tag } from 'antd';
import type { ReactNode } from 'react';
import { useListPageSize } from '../../providers/use-list-page-size';
import { CatalogRowActions, type CatalogRowActionsProps } from './catalog-row-actions';

export interface CatalogRow {
  id: string;
  isActive: boolean;
  isDefault?: boolean;
}

export const ACTIVE_FILTER_OPTIONS = [
  { value: 'true', label: 'Đang hiện' },
  { value: 'false', label: 'Đã ẩn' },
];

export function useCatalogTable<T extends CatalogRow>(resource: string, initialSort: { field: string; order: 'asc' | 'desc' }) {
  const pageSize = useListPageSize();
  return useTable<T>({
    resource,
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [initialSort] },
  });
}

type Sorters = ReturnType<typeof useCatalogTable>['sorters'];

/** Column helpers are called as functions so antd Table sees real Column elements. */
export function sortColumn<T extends CatalogRow>(
  sorters: Sorters,
  field: string,
  title: string,
  render?: (value: never, record: T) => ReactNode,
) {
  return (
    <Table.Column<T>
      key={field}
      dataIndex={field}
      title={title}
      sorter
      defaultSortOrder={getDefaultSortOrder(field, sorters)}
      render={render as never}
    />
  );
}

export function statusColumn<T extends CatalogRow>(extra?: (record: T) => ReactNode) {
  return (
    <Table.Column<T>
      key="status"
      title="Trạng thái"
      render={(_, record) => (
        <Space size="small" wrap>
          {record.isActive ? <Tag color="green">Đang hiện</Tag> : <Tag>Đã ẩn</Tag>}
          {record.isDefault && <Tag color="blue">Mặc định</Tag>}
          {extra?.(record)}
        </Space>
      )}
    />
  );
}

export function actionsColumn<T extends CatalogRow>(props: (record: T) => Omit<CatalogRowActionsProps, 'record'>) {
  return <Table.Column<T> key="actions" title="Thao tác" render={(_, record) => <CatalogRowActions record={record} {...props(record)} />} />;
}
