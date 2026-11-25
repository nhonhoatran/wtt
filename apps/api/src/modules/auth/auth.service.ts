import { HttpException, Inject, Injectable } from '@nestjs/common';
import { appSettingRegistry, authSettings, permissionsFor } from '@kamito/shared';
import { verifyPassword } from 'better-auth/crypto';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { fieldError, parseBody } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { AccountLockoutService } from './account-lockout.service.js';
import type { AuthContext } from './auth-context.js';
import { AUTH_INSTANCE, type Auth } from './auth-instance.js';

const WRONG_PASSWORD = 'Mật khẩu không đúng';
const WRONG_CURRENT_PASSWORD = 'Mật khẩu hiện tại không đúng';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    private readonly lockout: AccountLockoutService,
    private readonly audit: AuditService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  async me({ user }: AuthContext) {
    const [listDefaultPageSize, siteName] = await Promise.all([this.pagination.defaultPageSize(), this.settings.get(appSettingRegistry.siteName)]);
    return { ...user, permissions: permissionsFor(user.role), listDefaultPageSize, siteName };
  }

  /** Better Auth revokes every session and issues a fresh cookie, which we relay. */
  async changePassword({ user }: AuthContext, rawBody: unknown, req: Request, res: Response): Promise<void> {
    const minLength = await this.settings.get(authSettings.passwordMinLength);
    const body = parseBody(
      z.object({
        currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
        newPassword: z.string().min(minLength, `Mật khẩu mới tối thiểu ${minLength} ký tự`).max(128),
      }),
      rawBody,
    );
    if (body.newPassword === body.currentPassword) {
      throw fieldError('newPassword', 'Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    // A stolen session must not allow unlimited guesses at the current password.
    if (await this.lockout.isLocked(user.email)) throw fieldError('currentPassword', WRONG_CURRENT_PASSWORD);
    const upstream = await this.auth.api.changePassword({
      body: { ...body, revokeOtherSessions: true },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });
    if (!upstream.ok) {
      const error = (await upstream.json().catch(() => ({}))) as { code?: string; message?: string };
      if (error.code === 'INVALID_PASSWORD') {
        await this.lockout.recordFailure(user.email);
        await this.audit.record({ action: 'auth.password.change.failed', entity: 'User', entityId: user.id });
        throw fieldError('currentPassword', WRONG_CURRENT_PASSWORD);
      }
      throw new HttpException(
        { code: error.code ?? 'CHANGE_PASSWORD_FAILED', message: error.message ?? 'Change password failed' },
        upstream.status,
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false, tempPasswordExpiresAt: null },
    });
    await this.audit.record({ action: 'auth.password.change', entity: 'User', entityId: user.id });
    for (const cookie of upstream.headers.getSetCookie()) res.append('set-cookie', cookie);
  }

  async stepUp({ user, session }: AuthContext, rawBody: unknown): Promise<{ stepUpExpiresAt: Date }> {
    const { password } = parseBody(z.object({ password: z.string().min(1, 'Nhập mật khẩu') }), rawBody);
    const locked = await this.lockout.isLocked(user.email);
    const ok = !locked && (await this.checkPassword(user.id, password));
    if (!ok) {
      // Retrying while locked must not extend the lock.
      if (!locked) await this.lockout.recordFailure(user.email);
      await this.audit.record({ action: 'auth.step-up.failed', entity: 'User', entityId: user.id });
      throw fieldError('password', WRONG_PASSWORD, 'STEP_UP_FAILED');
    }
    const now = new Date();
    await this.prisma.session.update({ where: { id: session.id }, data: { stepUpAt: now } });
    const ttlMinutes = await this.settings.get(authSettings.stepUpTtlMinutes);
    return { stepUpExpiresAt: new Date(now.getTime() + ttlMinutes * 60_000) };
  }

  private async checkPassword(userId: string, password: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { password: true },
    });
    return account?.password ? verifyPassword({ hash: account.password, password }) : false;
  }
}
