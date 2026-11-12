import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { API_ENV } from '../config/app-config.module.js';
import type { ApiEnv } from '../config/env-schema.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** CSRF defence for cookie-authenticated writes: the Origin header must be the admin origin. */
export function hasTrustedOrigin(req: Request, adminPublicUrl: string): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  const origin = req.headers.origin;
  return typeof origin === 'string' && origin === new URL(adminPublicUrl).origin;
}

export function sendOriginMismatch(res: Response): void {
  res.status(403).json({ error: { code: 'ORIGIN_MISMATCH', message: 'Origin not allowed' } });
}

@Injectable()
export class TrustedOriginMiddleware implements NestMiddleware {
  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (hasTrustedOrigin(req, this.env.ADMIN_PUBLIC_URL)) next();
    else sendOriginMismatch(res);
  }
}
