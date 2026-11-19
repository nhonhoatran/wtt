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
  {
    key: 'tournaments',
    label: 'Giải đấu',
    items: [
      { key: 'events', label: 'Danh sách giải', path: '/events', resource: 'tournaments' },
      { key: 'venues', label: 'Địa điểm & bàn', path: '/venues', resource: 'tournaments' },
      { key: 'results', label: 'Nhập tỷ số', path: '/results', resource: 'matches' },
    ],
  },
  {
    key: 'players',
    label: 'Vận động viên',
    items: [
      { key: 'players', label: 'Danh sách VĐV', path: '/players', resource: 'players' },
      { key: 'pairs', label: 'Cặp đôi', path: '/pairs', resource: 'players' },
      { key: 'imports', label: 'Lịch sử import', path: '/imports', resource: 'tournaments' },
    ],
  },
  {
    key: 'rankings',
    label: 'Xếp hạng',
    items: [
      { key: 'ranking-lists', label: 'Bảng xếp hạng', path: '/ranking-lists', resource: 'rankings' },
      { key: 'ranking-rules', label: 'Quy tắc điểm', path: '/ranking-rules', resource: 'rankings' },
      { key: 'ranking-points', label: 'Sổ điểm', path: '/ranking-points', resource: 'rankings' },
      { key: 'ranking-snapshots', label: 'Kỳ chốt', path: '/ranking-snapshots', resource: 'rankings' },
    ],
  },
  {
    key: 'content',
    label: 'Nội dung',
    items: [
      { key: 'articles', label: 'Tin tức', path: '/articles', resource: 'content' },
      { key: 'videos', label: 'Video', path: '/videos', resource: 'content' },
      { key: 'static-pages', label: 'Trang tĩnh', path: '/static-pages', resource: 'content' },
      { key: 'contact-messages', label: 'Hộp thư liên hệ', path: '/contact-messages', resource: 'content' },
    ],
  },
  { key: 'sponsors', label: 'Nhà tài trợ', items: [{ key: 'sponsors', label: 'Nhà tài trợ', path: '/sponsors', resource: 'sponsors' }] },
  {
    key: 'config',
    label: 'Cấu hình',
    items: [
      { key: 'tiers', label: 'Nhóm giải', path: '/tiers', resource: 'tournaments' },
      { key: 'event-types', label: 'Hạng giải', path: '/event-types', resource: 'tournaments' },
      { key: 'disciplines', label: 'Nội dung chuẩn', path: '/disciplines', resource: 'tournaments' },
      { key: 'categories', label: 'Nhóm tuổi / trình độ', path: '/categories', resource: 'tournaments' },
      { key: 'match-formats', label: 'Thể thức trận', path: '/match-formats', resource: 'tournaments' },
      { key: 'group-scoring-rules', label: 'Luật vòng bảng', path: '/group-scoring-rules', resource: 'tournaments' },
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
