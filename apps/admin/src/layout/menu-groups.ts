import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ContactsOutlined,
  FileTextOutlined,
  GoldOutlined,
  HeartOutlined,
  InboxOutlined,
  LineChartOutlined,
  NumberOutlined,
  OrderedListOutlined,
  PlaySquareOutlined,
  ProfileOutlined,
  ReadOutlined,
  SettingOutlined,
  SolutionOutlined,
  TagsOutlined,
  TeamOutlined,
  TrophyOutlined,
  UnorderedListOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { can, type PermissionResource, type UserRoleName } from '@kamito/shared';
import type { ComponentType } from 'react';

export type MenuIcon = ComponentType;

export interface MenuItemDef {
  key: string;
  label: string;
  path: string;
  resource: PermissionResource;
  icon: MenuIcon;
  /** bull-board is served by the API, outside the SPA router. */
  external?: boolean;
}

export interface MenuGroupDef {
  key: string;
  label: string;
  icon: MenuIcon;
  /** `bottom` groups sit under a divider; a single-item bottom group renders as a plain entry. */
  placement: 'main' | 'bottom';
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
    icon: TrophyOutlined,
    placement: 'main',
    items: [
      { key: 'events', label: 'Giải đấu', path: '/events', resource: 'tournaments', icon: TrophyOutlined },
      { key: 'event-types', label: 'Hạng giải', path: '/event-types', resource: 'tournaments', icon: GoldOutlined },
      { key: 'venues', label: 'Địa điểm & bàn', path: '/venues', resource: 'tournaments', icon: CalendarOutlined },
      { key: 'results', label: 'Nhập tỷ số', path: '/results', resource: 'matches', icon: NumberOutlined },
    ],
  },
  {
    key: 'players',
    label: 'Vận động viên',
    icon: TeamOutlined,
    placement: 'main',
    items: [
      { key: 'players', label: 'Vận động viên', path: '/players', resource: 'players', icon: UsergroupAddOutlined },
      { key: 'pairs', label: 'Cặp đôi', path: '/pairs', resource: 'players', icon: TeamOutlined },
      { key: 'imports', label: 'Lịch sử import', path: '/imports', resource: 'tournaments', icon: InboxOutlined },
    ],
  },
  {
    key: 'rankings',
    label: 'Xếp hạng',
    icon: BarChartOutlined,
    placement: 'main',
    items: [
      { key: 'rankings', label: 'Bảng xếp hạng', path: '/rankings', resource: 'rankings', icon: BarChartOutlined },
      { key: 'ranking-rules', label: 'Quy tắc điểm', path: '/ranking-rules', resource: 'rankings', icon: OrderedListOutlined },
      { key: 'ranking-points', label: 'Sổ điểm', path: '/ranking-points', resource: 'rankings', icon: LineChartOutlined },
      { key: 'ranking-snapshots', label: 'Kỳ chốt', path: '/ranking-snapshots', resource: 'rankings', icon: AuditOutlined },
    ],
  },
  {
    key: 'content',
    label: 'Nội dung',
    icon: ReadOutlined,
    placement: 'main',
    items: [
      { key: 'articles', label: 'Tin tức', path: '/articles', resource: 'content', icon: ReadOutlined },
      { key: 'videos', label: 'Video', path: '/videos', resource: 'content', icon: PlaySquareOutlined },
      { key: 'static-pages', label: 'Trang tĩnh', path: '/static-pages', resource: 'content', icon: FileTextOutlined },
      { key: 'contact-messages', label: 'Hộp thư liên hệ', path: '/contact-messages', resource: 'content', icon: ContactsOutlined },
    ],
  },
  {
    key: 'sponsors',
    label: 'Nhà tài trợ',
    icon: HeartOutlined,
    placement: 'bottom',
    items: [{ key: 'sponsors', label: 'Nhà tài trợ', path: '/sponsors', resource: 'sponsors', icon: HeartOutlined }],
  },
  {
    key: 'config',
    label: 'Cấu hình',
    icon: SettingOutlined,
    placement: 'bottom',
    items: [
      { key: 'ranking-lists', label: 'Danh mục BXH', path: '/ranking-lists', resource: 'rankings', icon: BarChartOutlined },
      { key: 'tiers', label: 'Nhóm giải', path: '/tiers', resource: 'tournaments', icon: TagsOutlined },
      { key: 'disciplines', label: 'Nội dung chuẩn', path: '/disciplines', resource: 'tournaments', icon: AppstoreOutlined },
      { key: 'categories', label: 'Nhóm tuổi / trình độ', path: '/categories', resource: 'tournaments', icon: UnorderedListOutlined },
      { key: 'match-formats', label: 'Thể thức trận', path: '/match-formats', resource: 'tournaments', icon: ProfileOutlined },
      { key: 'group-scoring-rules', label: 'Luật vòng bảng', path: '/group-scoring-rules', resource: 'tournaments', icon: SolutionOutlined },
      { key: 'settings', label: 'Cài đặt hệ thống', path: '/settings', resource: 'settings', icon: SettingOutlined },
      { key: 'queues', label: 'Hàng đợi xử lý', path: '/api/v1/admin/queues', resource: 'queues', icon: InboxOutlined, external: true },
    ],
  },
  {
    key: 'users',
    label: 'Người dùng',
    icon: UserOutlined,
    placement: 'bottom',
    items: [
      { key: 'users', label: 'Tài khoản nhân viên', path: '/users', resource: 'users', icon: UserOutlined },
      { key: 'audit-logs', label: 'Nhật ký thao tác', path: '/audit-logs', resource: 'audit-logs', icon: AuditOutlined },
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

export type HomeKind = 'results' | 'dashboard';

/** Result operators land straight on score entry; everyone else gets the overview. */
export function homeKind(role: UserRoleName): HomeKind {
  return role === 'RESULTS_OPERATOR' && can(role, 'matches', 'list') ? 'results' : 'dashboard';
}

export const SHELL_LABELS = {
  root: 'Trang chủ',
  overview: 'Tổng quan',
  actions: { create: 'Tạo mới', edit: 'Chỉnh sửa' } as Record<string, string>,
};
