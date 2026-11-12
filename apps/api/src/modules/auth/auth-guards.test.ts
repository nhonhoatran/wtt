import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { AppSettingsService } from '../settings/app-settings.service.js';
import { setAuthContext, type AuthContext } from './auth-context.js';
import { ALLOW_PENDING_PASSWORD_CHANGE, REQUIRES_STEP_UP } from './auth-decorators.js';
import { MustChangePasswordGuard, StepUpGuard } from './auth-guards.js';

const settings = { get: async () => 5 } as unknown as AppSettingsService;

function contextFor(auth: AuthContext, metadata: Record<string, boolean> = {}): ExecutionContext {
  const req = {};
  setAuthContext(req, auth);
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) Reflect.defineMetadata(key, value, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function auth(overrides: { stepUpAt?: Date | null; mustChangePassword?: boolean } = {}): AuthContext {
  return {
    user: { id: 'u', email: 'u@x', name: 'U', role: 'ADMIN', mustChangePassword: overrides.mustChangePassword ?? false },
    session: { id: 's', stepUpAt: overrides.stepUpAt ?? null },
  };
}

describe('StepUpGuard', () => {
  const guard = new StepUpGuard(new Reflector(), settings);

  it('ignores routes without @RequireStepUp', async () => {
    await expect(guard.canActivate(contextFor(auth()))).resolves.toBe(true);
  });

  it('rejects a missing or stale step-up with STEP_UP_REQUIRED', async () => {
    for (const stepUpAt of [null, new Date(Date.now() - 6 * 60_000)]) {
      const run = guard.canActivate(contextFor(auth({ stepUpAt }), { [REQUIRES_STEP_UP]: true }));
      await expect(run).rejects.toBeInstanceOf(ForbiddenException);
      await expect(run).rejects.toMatchObject({ response: { code: 'STEP_UP_REQUIRED' } });
    }
  });

  it('accepts a step-up inside the configured window', async () => {
    const ctx = contextFor(auth({ stepUpAt: new Date(Date.now() - 60_000) }), { [REQUIRES_STEP_UP]: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

describe('MustChangePasswordGuard', () => {
  const guard = new MustChangePasswordGuard(new Reflector());

  it('blocks flagged users except on allowlisted routes', () => {
    expect(() => guard.canActivate(contextFor(auth({ mustChangePassword: true })))).toThrow(ForbiddenException);
    const allowed = contextFor(auth({ mustChangePassword: true }), { [ALLOW_PENDING_PASSWORD_CHANGE]: true });
    expect(guard.canActivate(allowed)).toBe(true);
    expect(guard.canActivate(contextFor(auth()))).toBe(true);
  });
});
