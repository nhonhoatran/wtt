import { SetMetadata } from '@nestjs/common';
import type { PermissionAction, PermissionResource } from '@kamito/shared';

export const IS_PUBLIC = 'access:isPublic';
export const REQUIRES_SESSION = 'access:requiresSession';
export const REQUIRED_PERMISSION = 'access:requiredPermission';

export interface RequiredPermission {
  resource: PermissionResource;
  action: PermissionAction;
}

/** No session needed (health, public site). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Any signed-in staff member, no specific permission (e.g. /auth/me). */
export const RequireSession = () => SetMetadata(REQUIRES_SESSION, true);

export const RequirePermission = (resource: PermissionResource, action: PermissionAction) =>
  SetMetadata(REQUIRED_PERMISSION, { resource, action } satisfies RequiredPermission);
