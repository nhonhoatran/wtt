import { List, useTable, FilterDropdown, getDefaultSortOrder, CreateButton } from '@refinedev/antd';
import { getDefaultFilter } from '@refinedev/core';
import { Form, Input, Select, Table } from 'antd';

interface Player { id: number; full_name: string; email: string; city: string; status: string; created_at: string }

const CITIES = ['Ha Noi', 'Ho Chi Minh', 'Da Nang', 'Can Tho', 'Hai Phong'];
const STATUSES = ['active', 'inactive', 'banned'];

export function PlayerList() {
  const { tableProps, searchFormProps, filters, sorters } = useTable<Player>({
    resource: 'players',
    syncWithLocation: true,
    pagination: { pageSize: 10 },
    sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
    onSearch: (values) => [{ field: 'q', operator: 'contains', value: (values as { q?: string }).q }],
  });

  return (
    <List headerButtons={<CreateButton />}>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="q"><Input.Search placeholder="Tim ten / email" enterButton onSearch={() => searchFormProps.form?.submit()} /></Form.Item>
      </Form>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="id" title="ID" sorter defaultSortOrder={getDefaultSortOrder('id', sorters)} />
        <Table.Column dataIndex="full_name" title="Ho ten" sorter defaultSortOrder={getDefaultSortOrder('full_name', sorters)} />
        <Table.Column dataIndex="email" title="Email" />
        <Table.Column
          dataIndex="city" title="Thanh pho" sorter
          defaultFilteredValue={getDefaultFilter('city', filters, 'in')}
          filterDropdown={(props) => (
            <FilterDropdown {...props}><Select mode="multiple" getPopupContainer={(n) => n.parentElement!} style={{ minWidth: 200 }} options={CITIES.map((v) => ({ value: v }))} /></FilterDropdown>
          )}
        />
        <Table.Column
          dataIndex="status" title="Trang thai"
          defaultFilteredValue={getDefaultFilter('status', filters, 'in')}
          filterDropdown={(props) => (
            <FilterDropdown {...props}><Select mode="multiple" getPopupContainer={(n) => n.parentElement!} style={{ minWidth: 200 }} options={STATUSES.map((v) => ({ value: v }))} /></FilterDropdown>
          )}
        />
        <Table.Column dataIndex="created_at" title="Tao luc" sorter defaultSortOrder={getDefaultSortOrder('created_at', sorters)} />
      </Table>
    </List>
  );
}
