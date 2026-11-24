import { CreateButton, getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { useGetIdentity } from '@refinedev/core';
import { Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { ListFilterBar } from '../../components/list-filter-bar';
import { TempPasswordModal, type TempPasswordInfo } from '../../components/temp-password-modal';
import { ROLE_LABELS } from '../../layout/menu-groups';
import type { CurrentUser } from '../../providers/current-user';
import { ROLE_OPTIONS, STATUS_OPTIONS, type UserRecord } from './user-labels';
import { UserRowActions } from './user-row-actions';
import { useTableScroll } from '../../components/use-table-scroll';

const formatTime = (value: string | null) => (value ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—');

export function UserList() {
  const tableScroll = useTableScroll();
  const { data: me } = useGetIdentity<CurrentUser>();
  const [tempPassword, setTempPassword] = useState<TempPasswordInfo | null>(null);
  const { tableProps, sorters, filters, setFilters } = useTable<UserRecord>({
    resource: 'users',
    syncWithLocation: true,
    pagination: { pageSize: me?.listDefaultPageSize },
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
  });

  return (
    <List title="Tài khoản nhân viên" headerButtons={<CreateButton>Thêm người dùng</CreateButton>}>
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo tên hoặc email' },
          { kind: 'select', field: 'role', placeholder: 'Vai trò', options: ROLE_OPTIONS },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: STATUS_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        <Table.Column<UserRecord> dataIndex="name" title="Họ tên" sorter defaultSortOrder={getDefaultSortOrder('name', sorters)} />
        <Table.Column<UserRecord> dataIndex="email" title="Email" sorter defaultSortOrder={getDefaultSortOrder('email', sorters)} />
        <Table.Column<UserRecord>
          dataIndex="role"
          title="Vai trò"
          render={(role: UserRecord['role']) => <Tag color={role === 'ADMIN' ? 'red' : 'blue'}>{ROLE_LABELS[role]}</Tag>}
        />
        <Table.Column<UserRecord>
          key="status"
          title="Trạng thái"
          render={(_, user) => (
            <Space size="small" wrap>
              {user.isActive ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Đã khóa</Tag>}
              {user.mustChangePassword && <Tag color="orange">Chờ đổi mật khẩu</Tag>}
            </Space>
          )}
        />
        <Table.Column<UserRecord>
          dataIndex="lastLoginAt"
          title="Đăng nhập gần nhất"
          sorter
          defaultSortOrder={getDefaultSortOrder('lastLoginAt', sorters)}
          render={formatTime}
        />
        <Table.Column<UserRecord>
          key="actions"
          title="Thao tác"
          render={(_, user) => <UserRowActions user={user} isSelf={user.id === me?.id} onTempPassword={setTempPassword} />}
        />
      </Table>
      <TempPasswordModal info={tempPassword} onClose={() => setTempPassword(null)} />
    </List>
  );
}
