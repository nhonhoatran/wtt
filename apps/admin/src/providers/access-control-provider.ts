import { can, PERMISSION_RESOURCES, type PermissionAction, type PermissionResource } from '@kamito/shared';
import type { AccessControlProvider } from '@refinedev/core';
import { loadCurrentUser } from './current-user';

const ACTION_MAP: Record<string, PermissionAction> = {
  list: 'list',
  show: 'read',
  create: 'create',
  edit: 'update',
  delete: 'delete',
};

const isPermissionResource = (value: string | undefined): value is PermissionResource =>
  (PERMISSION_RESOURCES as readonly string[]).includes(value ?? '');

/** UI only: hides what the API would refuse. Uses the same matrix as the API guard. */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    if (!isPermissionResource(resource)) return { can: true };
    const user = await loadCurrentUser().catch(() => null);
    const mapped = ACTION_MAP[action] ?? (action as PermissionAction);
    const allowed = Boolean(user && can(user.role, resource, mapped));
    return allowed ? { can: true } : { can: false, reason: 'Vai trò của bạn không có quyền này' };
  },
  options: { buttons: { enableAccessControl: true, hideIfUnauthorized: true } },
};
