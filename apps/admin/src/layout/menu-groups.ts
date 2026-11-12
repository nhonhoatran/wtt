import { can, type PermissionResource, type UserRoleName } from '@kamito/shared';

export interface MenuItemDef {
  key: string;
  label: string;
  path: string;
  resource: PermissionResource;
  /** bull-board is served by the API, outside the SPA router. */
  external?: boolean;
}

export interface MenuGroupDef {
  key: string;
  label: string;
  items: MenuItemDef[];
}

/**
 * Fixed menu groups from the plan; later phases add their items into the right group.
 * A group shows only when the role can list at least one of its items.
 */
export const MENU_GROUPS: MenuGroupDef[] = [
  { key: 'tournaments', label: 'Giải đấu', items: [] },
  { key: 'players', label: 'Vận động viên', items: [] },
  { key: 'rankings', label: 'Xếp hạng', items: [] },
  { key: 'content', label: 'Nội dung', items: [] },
  { key: 'sponsors', label: 'Nhà tài trợ', items: [] },
  {
    key: 'config',
    label: 'Cấu hình',
    items: [
      { key: 'settings', label: 'Cài đặt hệ thống', path: '/settings', resource: 'settings' },
      { key: 'queues', label: 'Hàng đợi xử lý', path: '/api/v1/admin/queues', resource: 'queues', external: true },
    ],
  },
  {
    key: 'users',
    label: 'Người dùng',
    items: [
      { key: 'users', label: 'Tài khoản nhân viên', path: '/users', resource: 'users' },
      { key: 'audit-logs', label: 'Nhật ký thao tác', path: '/audit-logs', resource: 'audit-logs' },
    ],
  },
];

export function visibleMenuGroups(role: UserRoleName): MenuGroupDef[] {
  return MENU_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(role, item.resource, 'list')) }))
    .filter((group) => group.items.length > 0);
}

export const ROLE_LABELS: Record<UserRoleName, string> = {
  ADMIN: 'Quản trị',
  RESULTS_OPERATOR: 'Nhập kết quả',
};
