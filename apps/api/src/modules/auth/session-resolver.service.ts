import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { authSettings } from '@kamito/shared';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import type { AuthContext } from './auth-context.js';
import { AUTH_INSTANCE, type Auth } from './auth-instance.js';

// Throttles the lastSeenAt write; idle timeout precision is minutes, so this costs nothing.
const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

function unauthorized(code: string, message: string): UnauthorizedException {
  return new UnauthorizedException({ code, message });
}

/** Turns the session cookie into an AuthContext; role and status always come from the DB row. */
@Injectable()
export class SessionResolver {
  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** `touch: false` for background polling, so it does not keep an idle session alive. */
  async resolve(headers: IncomingHttpHeaders, { touch = true }: { touch?: boolean } = {}): Promise<AuthContext> {
    const found = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) });
    if (!found) throw unauthorized('UNAUTHORIZED', 'Not signed in');

    const row = await this.prisma.session.findUnique({
      where: { id: found.session.id },
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        stepUpAt: true,
        user: { select: { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true } },
      },
    });
    if (!row) throw unauthorized('UNAUTHORIZED', 'Not signed in');

    const [maxAgeHours, idleMinutes] = await Promise.all([
      this.settings.get(authSettings.sessionMaxAgeHours),
      this.settings.get(authSettings.sessionIdleMinutes),
    ]);
    const now = Date.now();
    if (!row.user.isActive) {
      await this.prisma.session.deleteMany({ where: { userId: row.user.id } });
      throw unauthorized('ACCOUNT_DISABLED', 'Account is disabled');
    }
    if (row.createdAt.getTime() + maxAgeHours * 3_600_000 <= now) {
      await this.prisma.session.deleteMany({ where: { id: row.id } });
      throw unauthorized('SESSION_EXPIRED', 'Session expired');
    }
    if (row.lastSeenAt.getTime() + idleMinutes * 60_000 <= now) {
      await this.prisma.session.deleteMany({ where: { id: row.id } });
      throw unauthorized('SESSION_IDLE_TIMEOUT', 'Session expired after inactivity');
    }
    if (touch && now - row.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
      await this.prisma.session.updateMany({ where: { id: row.id }, data: { lastSeenAt: new Date(now) } });
    }

    const { id, email, name, role, mustChangePassword } = row.user;
    return { user: { id, email, name, role, mustChangePassword }, session: { id: row.id, stepUpAt: row.stepUpAt } };
  }
}
