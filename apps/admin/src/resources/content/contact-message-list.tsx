import { List, useTable } from '@refinedev/antd';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Descriptions, Drawer, Flex, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useTableScroll } from '../../components/use-table-scroll';
import { useListPageSize } from '../../providers/use-list-page-size';
import { CONTACT_STATUS_COLORS, CONTACT_STATUS_LABELS, CONTACT_STATUS_OPTIONS, dateTime, type ContactMessageRecord } from './content-labels';

export function ContactMessageList() {
  const { message } = App.useApp();
  const [selected, setSelected] = useState<ContactMessageRecord | null>(null);
  const tableScroll = useTableScroll();
  const { tableProps, searchFormProps, filters, setFilters, tableQuery } = useTable<ContactMessageRecord>({ resource: 'contact-messages', syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters: { initial: [{ field: 'createdAt', order: 'desc' }] } });
  const newCount = useQuery({ queryKey: ['contact-message-new-count'], queryFn: async () => (await apiFetch<{ data: ContactMessageRecord[]; total: number }>('/admin/contact-messages?page=1&pageSize=1&filter%5Bstatus%5D=NEW')).total, refetchInterval: 60_000 });
  const changeStatus = async (row: ContactMessageRecord, status: ContactMessageRecord['status']) => {
    try {
      await apiFetch(`/admin/contact-messages/${row.id}`, { method: 'PATCH', body: { status } });
      await Promise.all([tableQuery.refetch(), newCount.refetch()]);
      setSelected({ ...row, status });
      message.success(`Đã chuyển sang ${CONTACT_STATUS_LABELS[status].toLowerCase()}`);
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không cập nhật được trạng thái'); }
  };
  return <>
    <List title={<>Hộp thư liên hệ{newCount.data ? <Tag color="red" style={{ marginInlineStart: 8 }}>{newCount.data}</Tag> : null}</>}>
      <ListFilterBar searchForm={searchFormProps.form} filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tên, email, nội dung' }, { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: CONTACT_STATUS_OPTIONS }]} />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        <Table.Column<ContactMessageRecord> dataIndex="name" title="Người gửi" render={(name, row) => <Button type="link" onClick={() => { setSelected(row); if (row.status === 'NEW') void changeStatus(row, 'READ'); }}>{name}</Button>} />
        <Table.Column<ContactMessageRecord> dataIndex="email" title="Email" />
        <Table.Column<ContactMessageRecord> dataIndex="organization" title="Tổ chức" render={(value) => value ?? '—'} />
        <Table.Column<ContactMessageRecord> dataIndex="message" title="Nội dung" ellipsis width={240} />
        <Table.Column<ContactMessageRecord> dataIndex="createdAt" title="Gửi lúc" sorter render={dateTime} />
        <Table.Column<ContactMessageRecord> dataIndex="status" title="Trạng thái" render={(status: ContactMessageRecord['status']) => <Tag color={CONTACT_STATUS_COLORS[status]}>{CONTACT_STATUS_LABELS[status]}</Tag>} />
        <Table.Column<ContactMessageRecord> key="actions" title="Thao tác" render={(_, row) => <Space><Button size="small" onClick={() => setSelected(row)}>Mở</Button></Space>} />
      </Table>
    </List>
    <Drawer title="Tin nhắn liên hệ" open={Boolean(selected)} onClose={() => setSelected(null)} width={560}>
      {selected && <Flex vertical gap="middle"><Descriptions column={1} bordered size="small"><Descriptions.Item label="Người gửi">{selected.name}</Descriptions.Item><Descriptions.Item label="Email">{selected.email}</Descriptions.Item><Descriptions.Item label="Số điện thoại">{selected.phone ?? '—'}</Descriptions.Item><Descriptions.Item label="Tổ chức">{selected.organization ?? '—'}</Descriptions.Item><Descriptions.Item label="Thời gian">{dateTime(selected.createdAt)}</Descriptions.Item><Descriptions.Item label="Trạng thái"><Tag color={CONTACT_STATUS_COLORS[selected.status]}>{CONTACT_STATUS_LABELS[selected.status]}</Tag></Descriptions.Item></Descriptions><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.message}</div><Space wrap><Button disabled={selected.status === 'READ'} onClick={() => void changeStatus(selected, 'READ')}>Đánh dấu đã đọc</Button><Button disabled={selected.status === 'ARCHIVED'} onClick={() => void changeStatus(selected, 'ARCHIVED')}>Lưu trữ</Button></Space></Flex>}
    </Drawer>
  </>;
}
