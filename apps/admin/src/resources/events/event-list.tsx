import { useTable } from '@refinedev/antd';
import { CanAccess, getDefaultFilter, useCan } from '@refinedev/core';
import { Card, Table } from 'antd';
import { PageHeader } from '../../components/page-header';
import { CreateButton } from '../../components/crud-page';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useTableScroll } from '../../components/use-table-scroll';
import { useListPageSize } from '../../providers/use-list-page-size';
import { eventListColumns } from './event-list-columns';
import { EventLifecycleTabs } from './event-lifecycle-tabs';
import { PUBLISH_OPTIONS, yearOptions, type EventRecord } from './event-labels';
import { useCatalogSelect } from './use-catalog-options';
import { useEventLifecycleCounts } from './use-event-lifecycle-counts';

export function EventList() {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const canUpdate = useCan({ resource: 'tournaments', action: 'update' }).data?.can ?? false;
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useTable<EventRecord>({
    resource: 'events',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'startDate', order: 'desc' }] },
  });
  const current = (field: string) => getDefaultFilter(field, filters, 'eq') as string | undefined;
  const eventTypes = useCatalogSelect('event-types', { selected: current('eventTypeId') });
  const counts = useEventLifecycleCounts({
    q: current('q'),
    year: current('year'),
    eventTypeId: current('eventTypeId'),
    publishStatus: current('publishStatus'),
  });

  return (
    <>
      <PageHeader
        title="Giải đấu"
        subtitle="Quản lý tất cả giải"
        actions={
          <CanAccess resource="tournaments" action="create">
            <CreateButton>Thêm giải</CreateButton>
          </CanAccess>
        }
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <ListFilterBar
          showActiveChips
          searchForm={searchFormProps.form}
          filters={filters}
          setFilters={setFilters}
          fields={[
            { kind: 'search', field: 'q', placeholder: 'Tìm theo tên hoặc slug' },
            { kind: 'select', field: 'year', placeholder: 'Năm', options: yearOptions() },
            { kind: 'select', field: 'eventTypeId', placeholder: 'Hạng giải', options: eventTypes.options, showSearch: true, onSearch: eventTypes.selectProps.onSearch },
            { kind: 'select', field: 'publishStatus', placeholder: 'Công bố', options: PUBLISH_OPTIONS },
          ]}
        />
      </Card>
      <Card>
        <EventLifecycleTabs
          active={current('lifecycle') as EventRecord['lifecycle'] | undefined}
          counts={counts.data}
          onChange={(lifecycle) => setFilters([{ field: 'lifecycle', operator: 'eq', value: lifecycle }], 'merge')}
        />
        <Table {...tableProps} rowKey="id" scroll={tableScroll} columns={eventListColumns(sorters, canUpdate)} />
      </Card>
    </>
  );
}
