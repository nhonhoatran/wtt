import { USER_ROLES } from '@kamito/shared';
import { ROLE_LABELS } from '../../layout/menu-groups';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: (typeof USER_ROLES)[number];
  isActive: boolean;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export const ROLE_OPTIONS = USER_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

export const STATUS_OPTIONS = [
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã khóa' },
];
