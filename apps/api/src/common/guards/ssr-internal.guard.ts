import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SSR_SECRET_HEADER } from '@kamito/shared';
import type { Request } from 'express';
import { API_ENV } from '../config/app-config.module.js';
import type { ApiEnv } from '../config/env-schema.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Public read APIs answer only the client's server-side renderer, which sends SSR_INTERNAL_SECRET. */
@Injectable()
export class SsrInternalGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.expected = digest(env.SSR_INTERNAL_SECRET);
  }

  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<Request>().headers[SSR_SECRET_HEADER];
    if (typeof header === 'string' && timingSafeEqual(digest(header), this.expected)) return true;
    throw new ForbiddenException({ code: 'SSR_ONLY', message: 'Forbidden' });
  }
}
