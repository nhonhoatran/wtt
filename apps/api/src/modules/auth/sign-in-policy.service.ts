import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountLockoutService } from './account-lockout.service.js';
import type { SignInPolicy } from './auth-instance.js';

@Injectable()
export class SignInPolicyService implements SignInPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lockout: AccountLockoutService,
  ) {}

  async allowAttempt(email: string): Promise<boolean> {
    if (await this.lockout.isLocked(email)) return false;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { isActive: true, mustChangePassword: true, tempPasswordExpiresAt: true },
    });
    if (!user) return true;
    if (!user.isActive) return false;
    const tempExpired = user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt <= new Date();
    return !tempExpired;
  }

  async onFailure(email: string): Promise<void> {
    await this.lockout.recordFailure(email);
  }

  async onSuccess(userId: string, email: string): Promise<void> {
    await this.lockout.clear(email);
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }
}
