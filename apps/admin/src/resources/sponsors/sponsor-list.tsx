import { EditButton, getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { CanAccess, getDefaultFilter } from '@refinedev/core';
import { Space, Table, Tag } from 'antd';
import { Link } from 'react-router';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { useContentEventOptions } from '../content/use-content-event-options';
import type { SponsorRecord } from '../content/content-labels';
import { useTableScroll } from '../../components/use-table-scroll';

export function SponsorList() {
  const tableScroll = useTableScroll();
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useTable<SponsorRecord>({ resource: 'sponsors', syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters: { initial: [{ field: 'order', order: 'asc' }] } });
  const selectedEvent = getDefaultFilter('eventId', filters, 'eq') as string | undefined;
  const events = useContentEventOptions(selectedEvent ? [selectedEvent] : []);
  return <List title="Nhà tài trợ" headerButtons={<CanAccess resource="sponsors" action="create"><CreateButton>Thêm nhà tài trợ</CreateButton></CanAccess>}>
    <ListFilterBar searchForm={searchFormProps.form} filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tên nhà tài trợ' }, { kind: 'select', field: 'eventId', placeholder: 'Giải', options: events.options, showSearch: true, onSearch: events.onSearch }]} />
    <Table {...tableProps} rowKey="id" scroll={tableScroll}>
      <Table.Column<SponsorRecord> dataIndex="name" title="Nhà tài trợ" sorter defaultSortOrder={getDefaultSortOrder('name', sorters)} render={(name, row) => <Link to={`/sponsors/${row.id}/edit`}>{name}</Link>} />
      <Table.Column<SponsorRecord> dataIndex="event" title="Phạm vi" render={(event) => event?.name ?? <Tag color="blue">Toàn site</Tag>} />
      <Table.Column<SponsorRecord> dataIndex="roleLabel" title="Vai trò" render={(value) => value ?? '—'} />
      <Table.Column<SponsorRecord> dataIndex="order" title="Thứ tự" sorter defaultSortOrder={getDefaultSortOrder('order', sorters)} />
      <Table.Column<SponsorRecord> dataIndex="isActive" title="Trạng thái" render={(active) => active ? <Tag color="green">Đang hiện</Tag> : <Tag>Đã ẩn</Tag>} />
      <Table.Column<SponsorRecord> key="actions" title="Thao tác" render={(_, row) => <Space><EditButton hideText size="small" recordItemId={row.id} /></Space>} />
    </Table>
  </List>;
}
