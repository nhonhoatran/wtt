import { USER_ROLES } from '@kamito/shared';
import { z } from 'zod';

const role = z.enum(USER_ROLES, { message: 'Chọn vai trò' });

export const createUserBody = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(254),
  name: z.string().trim().min(1, 'Nhập họ tên').max(120),
  role: role.default('RESULTS_OPERATOR'),
});
export type CreateUserBody = z.infer<typeof createUserBody>;

export const updateUserBody = z
  .object({
    name: z.string().trim().min(1, 'Nhập họ tên').max(120),
    role,
    isActive: z.boolean(),
  })
  .partial();
export type UpdateUserBody = z.infer<typeof updateUserBody>;

/** Never includes password hashes or session tokens. */
export const USER_VIEW_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  tempPasswordExpiresAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
