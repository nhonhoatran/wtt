import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { authSettings } from '@kamito/shared';
import type { Request } from 'express';
import { getRequestContext } from '../../common/audit/request-context.js';
import { IS_PUBLIC } from '../access-control/access-decorators.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { getAuthContext, setAuthContext } from './auth-context.js';
import { ALLOW_PENDING_PASSWORD_CHANGE, REQUIRES_STEP_UP } from './auth-decorators.js';
import { SessionResolver } from './session-resolver.service.js';

function isPublic(reflector: Reflector, context: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]) === true;
}

function flag(reflector: Reflector, context: ExecutionContext, key: string): boolean {
  return reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]) === true;
}

/** 1st global guard: every non-public route needs a live session. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: SessionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublic(this.reflector, context)) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const auth = await this.resolver.resolve(req.headers);
    setAuthContext(req, auth);
    const requestContext = getRequestContext();
    if (requestContext) {
      requestContext.userId = auth.user.id;
      requestContext.sessionId = auth.session.id;
    }
    return true;
  }
}

/** 2nd: a temporary password only opens /auth/me and /auth/change-password (sign-out is raw). */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublic(this.reflector, context)) return true;
    const auth = getAuthContext(context.switchToHttp().getRequest());
    if (!auth?.user.mustChangePassword || flag(this.reflector, context, ALLOW_PENDING_PASSWORD_CHANGE)) return true;
    throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Password change required' });
  }
}

/** 4th (after PermissionGuard): @RequireStepUp routes need a recent password re-entry. */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settings: AppSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!flag(this.reflector, context, REQUIRES_STEP_UP)) return true;
    const stepUpAt = getAuthContext(context.switchToHttp().getRequest())?.session.stepUpAt;
    const ttlMinutes = await this.settings.get(authSettings.stepUpTtlMinutes);
    if (stepUpAt && stepUpAt.getTime() + ttlMinutes * 60_000 > Date.now()) return true;
    throw new ForbiddenException({ code: 'STEP_UP_REQUIRED', message: 'Re-enter your password to continue' });
  }
}
