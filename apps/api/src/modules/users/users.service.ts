import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { authSettings } from '@kamito/shared';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { AccountLockoutService } from '../auth/account-lockout.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { setCredentialPassword } from './credential-account.js';
import { SessionRevocationService } from './session-revocation.service.js';
import { generateTempPassword } from './temp-password.js';
import { type CreateUserBody, type UpdateUserBody, USER_VIEW_SELECT } from './user-dtos.js';
import { describeUserChange, diffUser, ensureActiveAdminRemains, rejectSelfLockout } from './user-update-rules.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly sessions: SessionRevocationService,
    private readonly lockout: AccountLockoutService,
  ) {}

  async create(body: CreateUserBody) {
    const temp = await this.newTempPassword();
    const id = randomUUID();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { id, ...body, mustChangePassword: true, tempPasswordExpiresAt: temp.expiresAt },
          select: USER_VIEW_SELECT,
        });
        await setCredentialPassword(tx, id, temp.hash);
        await this.audit.record({ action: 'user.create', entity: 'User', entityId: id, after: body }, tx);
        return created;
      });
      return { user, tempPassword: temp.password, tempPasswordExpiresAt: temp.expiresAt };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw fieldError('email', 'Email này đã có tài khoản');
      }
      throw error;
    }
  }

  async update(actorId: string, id: string, body: UpdateUserBody) {
    const current = await this.requireUser(id);
    rejectSelfLockout(actorId, current, body);
    const changes = diffUser(current, body);
    if (!changes) return current;

    const revoke = changes.after.role !== undefined || changes.after.isActive === false;
    const updated = await this.serializable(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: changes.after, select: USER_VIEW_SELECT });
      if (revoke) await this.sessions.revokeAll(id, tx);
      await ensureActiveAdminRemains(tx);
      await this.audit.record({ action: describeUserChange(changes.after), entity: 'User', entityId: id, ...changes }, tx);
      return user;
    });
    if (changes.after.isActive === true) await this.lockout.clear(current.email);
    return updated;
  }

  async resetPassword(actorId: string, id: string) {
    if (actorId === id) throw fieldError('id', 'Dùng "Đổi mật khẩu" cho tài khoản của chính mình', 'CANNOT_MODIFY_SELF');
    const current = await this.requireUser(id);
    const temp = await this.newTempPassword();
    await this.prisma.$transaction(async (tx) => {
      await setCredentialPassword(tx, id, temp.hash);
      await tx.user.update({ where: { id }, data: { mustChangePassword: true, tempPasswordExpiresAt: temp.expiresAt } });
      await this.sessions.revokeAll(id, tx);
      await this.audit.record({ action: 'user.password.reset', entity: 'User', entityId: id }, tx);
    });
    await this.lockout.clear(current.email);
    return { tempPassword: temp.password, tempPasswordExpiresAt: temp.expiresAt };
  }

  async revokeSessions(id: string) {
    await this.requireUser(id);
    const revoked = await this.prisma.$transaction(async (tx) => {
      const count = await this.sessions.revokeAll(id, tx);
      await this.audit.record({ action: 'user.sessions.revoke', entity: 'User', entityId: id, after: { count } }, tx);
      return count;
    });
    return { revoked };
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_VIEW_SELECT });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return user;
  }

  private async newTempPassword() {
    const [minLength, ttlHours] = await Promise.all([
      this.settings.get(authSettings.passwordMinLength),
      this.settings.get(authSettings.tempPasswordTtlHours),
    ]);
    const password = generateTempPassword(minLength);
    return { password, hash: await hashPassword(password), expiresAt: new Date(Date.now() + ttlHours * 3_600_000) };
  }

  /** Serializable so two admins demoting each other cannot both pass the last-admin check. */
  private async serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({ code: 'CONCURRENT_UPDATE', message: 'Dữ liệu vừa thay đổi, hãy thử lại' });
      }
      throw error;
    }
  }
}
