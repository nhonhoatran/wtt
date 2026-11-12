import { ConflictException } from '@nestjs/common';
import type { Prisma, UserRole } from '@kamito/db';
import { fieldError } from '../../common/validation/parse-body.js';
import type { UpdateUserBody } from './user-dtos.js';

interface UserState {
  id: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface UserChange {
  before: Partial<UpdateUserBody>;
  after: Partial<UpdateUserBody>;
}

export function rejectSelfLockout(actorId: string, current: UserState, body: UpdateUserBody): void {
  if (actorId !== current.id) return;
  if (body.role !== undefined && body.role !== current.role) {
    throw fieldError('role', 'Không thể tự đổi vai trò của chính mình', 'CANNOT_MODIFY_SELF');
  }
  if (body.isActive === false) {
    throw fieldError('isActive', 'Không thể tự khóa tài khoản của chính mình', 'CANNOT_MODIFY_SELF');
  }
}

/** Only fields that actually change; null when the request is a no-op. */
export function diffUser(current: UserState, body: UpdateUserBody): UserChange | null {
  const before: Partial<UpdateUserBody> = {};
  const after: Partial<UpdateUserBody> = {};
  for (const key of ['name', 'role', 'isActive'] as const) {
    if (body[key] === undefined || body[key] === current[key]) continue;
    Object.assign(before, { [key]: current[key] });
    Object.assign(after, { [key]: body[key] });
  }
  return Object.keys(after).length ? { before, after } : null;
}

export function describeUserChange(after: Partial<UpdateUserBody>): string {
  const keys = Object.keys(after);
  if (keys.length !== 1) return 'user.update';
  if (after.isActive === false) return 'user.lock';
  if (after.isActive === true) return 'user.unlock';
  if (after.role !== undefined) return 'user.role.change';
  return 'user.update';
}

export async function ensureActiveAdminRemains(tx: Pick<Prisma.TransactionClient, 'user'>): Promise<void> {
  const admins = await tx.user.count({ where: { role: 'ADMIN', isActive: true } });
  if (admins === 0) {
    throw new ConflictException({ code: 'LAST_ACTIVE_ADMIN', message: 'Phải còn ít nhất một quản trị đang hoạt động' });
  }
}
