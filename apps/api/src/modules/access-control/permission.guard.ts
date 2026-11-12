import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can } from '@kamito/shared';
import { getAuthContext } from '../auth/auth-context.js';
import { IS_PUBLIC, REQUIRED_PERMISSION, REQUIRES_SESSION, type RequiredPermission } from './access-decorators.js';

/** Deny-by-default: a route without @Public, @RequireSession or @RequirePermission is forbidden. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const auth = getAuthContext(context.switchToHttp().getRequest());
    if (!auth) throw new ForbiddenException();

    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(REQUIRED_PERMISSION, targets);
    if (required) {
      if (can(auth.user.role, required.resource, required.action)) return true;
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Permission denied' });
    }
    if (this.reflector.getAllAndOverride<boolean>(REQUIRES_SESSION, targets)) return true;
    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Route has no access rule' });
  }
}
