import { EVENT_LIFECYCLE_LABELS } from '@kamito/shared';
import { getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { CanAccess, getDefaultFilter } from '@refinedev/core';
import { Table, Tag } from 'antd';
import { Link } from 'react-router';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import {
  eventTypeColor,
  formatDateRange,
  LIFECYCLE_COLORS,
  LIFECYCLE_OPTIONS,
  PUBLISH_LABELS,
  PUBLISH_OPTIONS,
  yearOptions,
  type EventRecord,
} from './event-labels';
import { useCatalogSelect } from './use-catalog-options';
import { useTableScroll } from '../../components/use-table-scroll';

export function EventList() {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useTable<EventRecord>({
    resource: 'events',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'startDate', order: 'desc' }] },
  });
  const eventTypes = useCatalogSelect('event-types', { selected: getDefaultFilter('eventTypeId', filters, 'eq') as string | undefined });

  return (
    <List
      title="Danh sách giải"
      headerButtons={
        <CanAccess resource="tournaments" action="create">
          <CreateButton>Thêm giải</CreateButton>
        </CanAccess>
      }
    >
      <ListFilterBar searchForm={searchFormProps.form}
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo tên hoặc slug' },
          { kind: 'select', field: 'eventTypeId', placeholder: 'Hạng giải', options: eventTypes.options, showSearch: true, onSearch: eventTypes.selectProps.onSearch },
          { kind: 'select', field: 'year', placeholder: 'Năm', options: yearOptions() },
          { kind: 'select', field: 'lifecycle', placeholder: 'Trạng thái', options: LIFECYCLE_OPTIONS },
          { kind: 'select', field: 'publishStatus', placeholder: 'Công bố', options: PUBLISH_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        <Table.Column<EventRecord>
          dataIndex="name"
          title="Tên giải"
          sorter
          defaultSortOrder={getDefaultSortOrder('name', sorters)}
          render={(name: string, event) => <Link to={`/events/${event.id}`}>{name}</Link>}
        />
        <Table.Column<EventRecord>
          key="eventType"
          title="Hạng giải"
          render={(_, event) => <Tag color={eventTypeColor(event)}>{event.eventType.name}</Tag>}
        />
        <Table.Column<EventRecord>
          dataIndex="startDate"
          title="Ngày"
          sorter
          defaultSortOrder={getDefaultSortOrder('startDate', sorters)}
          render={(_, event) => formatDateRange(event)}
        />
        <Table.Column<EventRecord> key="venue" title="Địa điểm" render={(_, event) => event.venue?.name ?? '—'} />
        <Table.Column<EventRecord>
          dataIndex="lifecycle"
          title="Trạng thái"
          render={(lifecycle: EventRecord['lifecycle']) => <Tag color={LIFECYCLE_COLORS[lifecycle]}>{EVENT_LIFECYCLE_LABELS[lifecycle]}</Tag>}
        />
        <Table.Column<EventRecord>
          dataIndex="publishStatus"
          title="Công bố"
          render={(status: EventRecord['publishStatus']) => <Tag color={status === 'PUBLISHED' ? 'green' : undefined}>{PUBLISH_LABELS[status]}</Tag>}
        />
        <Table.Column<EventRecord> key="subEvents" title="Số nội dung" align="right" render={(_, event) => event._count.subEvents} />
      </Table>
    </List>
  );
}
