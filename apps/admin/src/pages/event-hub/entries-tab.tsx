import { PlusOutlined } from '@ant-design/icons';
import { useCan, useInvalidate } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Flex, Result, Skeleton, Tag } from 'antd';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { AddEntryForm } from './add-entry-form';
import { EntriesImportPanel } from './entries-import-panel';
import { EntriesToolbar } from './entries-toolbar';
import { entryCountsKey, type EntryCount, type EntrySubEvent } from './entry-labels';
import { entriesResource, EntryTable } from './entry-table';
import type { HubTabContext } from './hub-tab-context';
import { subEventsKey, entryUnit } from './sub-event-labels';
import { SubEventPills, useSubEventParam } from './sub-event-pills';

const IMPORT_QUERY_PARAM = 'import';

/** "Danh sách đăng ký" tab: pick a sub-event, manage its entries, import from Excel without leaving the tab. */
export function EntriesTab({ event, canCreate, canUpdate }: HubTabContext) {
  const [params, setParams] = useSearchParams();
  const invalidate = useInvalidate();
  const canOverride = useCan({ resource: 'tournaments', action: 'manage' }).data?.can ?? false;
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const subEvents = useQuery({
    queryKey: subEventsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntrySubEvent[] }>(`/admin/events/${event.id}/sub-events`)).data,
  });
  const counts = useQuery({
    queryKey: entryCountsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntryCount[] }>(`/admin/events/${event.id}/entry-counts`)).data,
  });
  const [selected, select] = useSubEventParam(subEvents.data ?? []);
  const importId = params.get(IMPORT_QUERY_PARAM);
  const showImport = canCreate && (importOpen || Boolean(importId));

  const setImportParam = useCallback(
    (id: string | null) =>
      setParams((current) => {
        if (id) current.set(IMPORT_QUERY_PARAM, id);
        else current.delete(IMPORT_QUERY_PARAM);
        return current;
      }),
    [setParams],
  );
  const restartImport = useCallback(() => setImportParam(null), [setImportParam]);
  const closeImport = () => {
    setImportOpen(false);
    setImportParam(null);
  };
  const refreshCounts = () => counts.refetch();
  const refreshEntries = useCallback(() => {
    if (selected) void invalidate({ resource: entriesResource(selected.id), invalidates: ['list'] });
    void counts.refetch();
  }, [selected, invalidate, counts]);

  if (subEvents.isLoading) return <Skeleton active />;
  if (subEvents.isError || !subEvents.data) {
    return <Result status="error" title="Không tải được nội dung thi đấu" extra={<Button onClick={() => subEvents.refetch()}>Thử lại</Button>} />;
  }
  if (!selected) {
    return (
      <Empty description="Chưa có nội dung">
        {canCreate && (
          <Link to={`/events/${event.id}/sub-events`}>
            <Button type="primary" icon={<PlusOutlined />}>
              Thêm nội dung
            </Button>
          </Link>
        )}
      </Empty>
    );
  }

  const toggleAdd = () => {
    setAddOpen((open) => !open);
    closeImport();
  };
  const toggleImport = () => {
    if (showImport) closeImport();
    else {
      setImportOpen(true);
      setAddOpen(false);
    }
  };
  const unit = entryUnit(selected.discipline.competitorKind);

  const panel = (
    <>
      {canCreate && addOpen && (
        <Card
          size="small"
          title={`Thêm ${unit} vào ${selected.code}`}
          extra={<Button type="text" onClick={() => setAddOpen(false)}>Đóng (Esc)</Button>}
          onKeyDown={(keyEvent) => keyEvent.key === 'Escape' && !keyEvent.defaultPrevented && setAddOpen(false)}
        >
          <AddEntryForm key={`add-${selected.id}`} subEvent={selected} canOverride={canOverride} onAdded={async () => refreshEntries()} />
        </Card>
      )}
      {showImport && (
        <EntriesImportPanel
          eventId={event.id}
          eventName={event.name}
          jobId={importId}
          onJobCreated={setImportParam}
          onRestart={restartImport}
          onClose={closeImport}
          onDone={refreshEntries}
        />
      )}
    </>
  );

  return (
    <Flex vertical gap="middle">
      <SubEventPills
        subEvents={subEvents.data}
        selectedId={selected.id}
        onSelect={select}
        renderMeta={(id) => <Tag bordered={false}>{counts.data?.find((row) => row.subEventId === id)?.confirmed ?? 0}</Tag>}
      />
      {counts.isError && (
        <Alert type="warning" showIcon message="Không tải được số đăng ký của từng nội dung." action={<Button size="small" onClick={() => counts.refetch()}>Thử lại</Button>} />
      )}
      <EntryTable
        key={`table-${selected.id}`}
        subEvent={selected}
        canUpdate={canUpdate}
        onCountsChanged={refreshCounts}
        panel={panel}
        toolbarActions={
          <EntriesToolbar
            eventId={event.id}
            subEventId={selected.id}
            canCreate={canCreate}
            addOpen={addOpen}
            importOpen={showImport}
            onToggleAdd={toggleAdd}
            onToggleImport={toggleImport}
          />
        }
      />
    </Flex>
  );
}
