import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PASSWORD_CHANGE = 'allowPasswordChange';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PASSWORD_CHANGE, true);
