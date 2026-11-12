import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { ALLOW_PASSWORD_CHANGE, IS_PUBLIC, ROLES_KEY } from './auth-decorators.js';
import type { Auth } from './create-auth.js';

export const AUTH_TOKEN = 'AUTH_TOKEN';

export interface AuthedUser {
  id: string;
  role: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(AUTH_TOKEN) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException();

    // Role and ban state come from the DB row, never from the session payload.
    const user = await this.prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, banned: true, banExpires: true, mustChangePassword: true },
    });
    if (!user) throw new UnauthorizedException();
    const banActive = user.banned && (!user.banExpires || user.banExpires.getTime() > Date.now());
    if (banActive) throw new ForbiddenException('Account is disabled.');
    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, targets)) {
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Password change required' });
    }

    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, targets);
    if (required && !required.includes(user.role)) throw new ForbiddenException();

    req.user = { id: user.id, role: user.role };
    return true;
  }
}
