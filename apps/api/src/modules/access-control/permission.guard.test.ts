import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { setAuthContext, type AuthContext } from '../auth/auth-context.js';
import { Public, RequirePermission, RequireSession } from './access-decorators.js';
import { PermissionGuard } from './permission.guard.js';

class Sample {
  @Public()
  open() {}

  @RequireSession()
  profile() {}

  @RequirePermission('users', 'list')
  list() {}

  unannotated() {}
}

@RequirePermission('settings', 'read')
class ClassLevel {
  inherited() {}
}

function contextFor(handler: (...args: never[]) => unknown, controller: new () => object, auth?: AuthContext): ExecutionContext {
  const req = {};
  if (auth) setAuthContext(req, auth);
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function auth(role: AuthContext['user']['role']): AuthContext {
  return {
    user: { id: 'u', email: 'u@x', name: 'U', role, mustChangePassword: false },
    session: { id: 's', stepUpAt: null },
  };
}

const guard = new PermissionGuard(new Reflector());

describe('PermissionGuard (deny-by-default)', () => {
  it('lets @Public routes through without a session', () => {
    expect(guard.canActivate(contextFor(Sample.prototype.open, Sample))).toBe(true);
  });

  it('forbids a route with no access decorator, even for ADMIN', () => {
    const ctx = contextFor(Sample.prototype.unannotated, Sample, auth('ADMIN'));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Route has no access rule');
  });

  it('forbids any annotated non-public route when no session was resolved', () => {
    expect(() => guard.canActivate(contextFor(Sample.prototype.profile, Sample))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(Sample.prototype.list, Sample))).toThrow(ForbiddenException);
  });

  it('allows any signed-in role on @RequireSession routes', () => {
    expect(guard.canActivate(contextFor(Sample.prototype.profile, Sample, auth('RESULTS_OPERATOR')))).toBe(true);
  });

  it('checks the role matrix on @RequirePermission routes', () => {
    expect(guard.canActivate(contextFor(Sample.prototype.list, Sample, auth('ADMIN')))).toBe(true);
    expect(() => guard.canActivate(contextFor(Sample.prototype.list, Sample, auth('RESULTS_OPERATOR')))).toThrow(
      'Permission denied',
    );
  });

  it('applies a class-level permission to methods without their own decorator', () => {
    const ctx = contextFor(ClassLevel.prototype.inherited, ClassLevel, auth('RESULTS_OPERATOR'));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor(ClassLevel.prototype.inherited, ClassLevel, auth('ADMIN')))).toBe(true);
  });
});
