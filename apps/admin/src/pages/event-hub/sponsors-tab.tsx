import { useQuery } from '@tanstack/react-query';
import { HolderOutlined } from '@ant-design/icons';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { App, Button, Empty, Flex, InputNumber, Skeleton, Table, Tag, Typography, theme } from 'antd';
import { Link } from 'react-router';
import { createContext, useContext, useState, type HTMLAttributes } from 'react';
import { apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import type { SponsorRecord } from '../../resources/content/content-labels';
import type { HubTabContext } from './hub-tab-context';
import { useListPageSize } from '../../providers/use-list-page-size';
import { useTableScroll } from '../../components/use-table-scroll';

type HandleContextValue = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners' | 'setActivatorNodeRef'> & { label: string; disabled: boolean };
const HandleContext = createContext<HandleContextValue | null>(null);

interface SponsorRowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
  'data-sponsor-name': string;
  'data-drag-disabled': boolean;
}

/** Keeps a dragged row vertical and inside the table body, so the table's horizontal scroll box never clips it. */
const keepInsideRows: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 };
  const minY = containerNodeRect.top - draggingNodeRect.top;
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom;
  return { ...transform, x: 0, y: Math.min(Math.max(transform.y, minY), maxY) };
};

function SponsorRow({ style, children, ...props }: SponsorRowProps) {
  const { token } = theme.useToken();
  const sortable = useSortable({ id: props['data-row-key'], disabled: props['data-drag-disabled'] });
  return <HandleContext.Provider value={{ ...sortable, label: props['data-sponsor-name'], disabled: props['data-drag-disabled'] }}>
    <tr {...props} ref={sortable.setNodeRef} style={{
      ...style,
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
      position: 'relative',
      zIndex: sortable.isDragging ? 1 : undefined,
      background: sortable.isDragging ? token.colorFillSecondary : undefined,
    }}>{children}</tr>
  </HandleContext.Provider>;
}

function SponsorDragHandle() {
  const context = useContext(HandleContext);
  if (!context) return null;
  return <Button type="text" icon={<HolderOutlined />} ref={context.setActivatorNodeRef} {...context.attributes} {...context.listeners}
    disabled={context.disabled} aria-label={`Kéo đổi thứ tự nhà tài trợ: ${context.label}`} style={{ cursor: context.disabled ? 'not-allowed' : 'grab', touchAction: 'none' }} />;
}

export function SponsorsTab({ event, canUpdate }: HubTabContext) {
  const tableScroll = useTableScroll();
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const pageSize = useListPageSize();
  const query = useQuery({
    queryKey: ['event-sponsors', event.id, page, pageSize],
    queryFn: () => apiFetch<{ data: SponsorRecord[]; total: number; pageSize: number }>(`/admin/sponsors?page=${page}${pageSize ? `&pageSize=${pageSize}` : ''}&filter%5BeventId%5D=${encodeURIComponent(event.id)}`),
  });
  if (query.isLoading) return <Skeleton active />;
  if (query.isError) return <Button onClick={() => void query.refetch()}>Tải lại danh sách tài trợ</Button>;
  const changeOrder = async (row: SponsorRecord, order: number) => {
    setSaving(true);
    try {
      const result = await apiFetch(`/admin/sponsors/${row.id}`, { method: 'PATCH', body: { order } });
      await query.refetch();
      showWarnings(message, warningsOf(result));
      message.success('Đã cập nhật thứ tự');
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không cập nhật được thứ tự'); }
    finally { setSaving(false); }
  };
  const rows = query.data?.data ?? [];
  const sponsorName = (id: string | number) => rows.find((row) => row.id === String(id))?.name ?? 'nhà tài trợ';
  const reorder = async ({ active, over }: DragEndEvent) => {
    if (saving || !canUpdate || !over || active.id === over.id) return;
    const ids = rows.map(({ id }) => id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    setSaving(true);
    try {
      const result = await apiFetch('/admin/sponsors/reorder', { method: 'POST', body: { eventId: event.id, orderedIds: arrayMove(ids, from, to) } });
      await query.refetch();
      showWarnings(message, warningsOf(result));
      message.success('Đã đổi thứ tự nhà tài trợ');
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không đổi được thứ tự'); }
    finally { setSaving(false); }
  };
  return <Flex vertical gap="middle">
    <Flex justify="space-between" align="center" wrap gap="small"><Typography.Text type="secondary">Nhà tài trợ gắn với giải này.</Typography.Text>{canUpdate && <Link to={`/sponsors/create?eventId=${encodeURIComponent(event.id)}`}><Button type="primary">Thêm nhà tài trợ</Button></Link>}</Flex>
    {canUpdate && <Typography.Text type="secondary">Kéo tay nắm để đổi thứ tự trong trang này; hoặc nhấn Space, phím mũi tên, rồi Space để thả. Nhấn Esc để hủy.</Typography.Text>}
    {query.data?.data.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[keepInsideRows]} onDragEnd={(event) => void reorder(event)}
      accessibility={{
        screenReaderInstructions: { draggable: 'Nhấn Space để nhấc nhà tài trợ, dùng phím mũi tên để di chuyển, nhấn Space để thả hoặc Esc để hủy.' },
        announcements: {
          onDragStart: ({ active }) => `Đã nhấc ${sponsorName(active.id)}.`,
          onDragOver: ({ active, over }) => over ? `${sponsorName(active.id)} tới vị trí của ${sponsorName(over.id)}.` : undefined,
          onDragEnd: ({ active, over }) => over ? `Đã thả ${sponsorName(active.id)}. Đang lưu thứ tự.` : 'Không đổi thứ tự.',
          onDragCancel: () => 'Đã hủy đổi thứ tự.',
        },
      }}>
      <SortableContext items={rows.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
      <Table dataSource={rows} rowKey="id" scroll={tableScroll} loading={saving || query.isFetching} components={{ body: { row: SponsorRow } }}
        onRow={(row) => ({ 'data-sponsor-name': row.name, 'data-drag-disabled': saving || !canUpdate }) as HTMLAttributes<HTMLTableRowElement>}
        pagination={{ current: page, pageSize: query.data.pageSize, total: query.data.total, showSizeChanger: false, disabled: saving, onChange: setPage }}>
      {canUpdate && <Table.Column<SponsorRecord> key="drag" title="Sắp xếp" width={80} render={() => <SponsorDragHandle />} />}
      <Table.Column<SponsorRecord> dataIndex="name" title="Nhà tài trợ" />
      <Table.Column<SponsorRecord> dataIndex="roleLabel" title="Vai trò" render={(value) => value ?? '—'} />
      <Table.Column<SponsorRecord> dataIndex="order" title="Thứ tự" render={(order, row) => canUpdate ? <InputNumber min={0} precision={0} value={order} disabled={saving} aria-label={`Thứ tự của ${row.name}`} onChange={(value) => value !== null && value !== order ? void changeOrder(row, value) : undefined} /> : order} />
      <Table.Column<SponsorRecord> dataIndex="isActive" title="Trạng thái" render={(active) => active ? <Tag color="green">Đang hiện</Tag> : <Tag>Đã ẩn</Tag>} />
      <Table.Column<SponsorRecord> key="actions" title="Thao tác" render={(_, row) => canUpdate ? <Link to={`/sponsors/${row.id}/edit`}>Sửa</Link> : '—'} />
    </Table>
    </SortableContext></DndContext> : <Empty description="Chưa có nhà tài trợ cho giải này" />}
  </Flex>;
}
