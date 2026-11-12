import { Logger } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Express, NextFunction, Request, Response } from 'express';
import { AUTH_BASE_PATH, SIGN_IN_PATH, type Auth } from './auth-instance.js';
import type { LoginIpRateLimiter } from './login-ip-rate-limiter.service.js';

/**
 * Default-deny: only these exact Better Auth paths reach its handler. Everything else under /auth
 * falls through to Nest (our guarded controllers) or 404. Better Auth's own disabledPaths cannot
 * cover parametrized paths, so this list is the real gate.
 */
export const RAW_AUTH_ALLOWLIST: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'POST', path: SIGN_IN_PATH },
  { method: 'POST', path: '/sign-out' },
];

const logger = new Logger('AuthRawHandler');

export function isRawAuthRoute(method: string, subPath: string): boolean {
  return RAW_AUTH_ALLOWLIST.some((route) => route.method === method && route.path === subPath);
}

/** Must run before app.init() so Better Auth reads the raw body before Nest's JSON parser. */
export function mountAuthRawHandler(server: Express, auth: Auth, limiter: LoginIpRateLimiter): void {
  const handler = toNodeHandler(auth);

  server.all(`${AUTH_BASE_PATH}/*splat`, (req: Request, res: Response, next: NextFunction) => {
    const subPath = req.path.slice(AUTH_BASE_PATH.length);
    if (!isRawAuthRoute(req.method, subPath)) {
      next();
      return;
    }
    handleRaw(req, res, subPath).catch((error: unknown) => {
      logger.error(error);
      if (!res.headersSent) res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    });
  });

  async function handleRaw(req: Request, res: Response, subPath: string): Promise<void> {
    if (subPath === SIGN_IN_PATH) {
      const waitSeconds = await limiter.hit(req.ip ?? 'unknown');
      if (waitSeconds > 0) {
        res.setHeader('Retry-After', String(waitSeconds));
        res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Too many sign-in attempts' } });
        return;
      }
    }
    // Better Auth reads the client IP from X-Forwarded-For only; pin it to the IP Express resolved via
    // TRUST_PROXY_HOPS so a spoofed header cannot pick the recorded session IP.
    if (req.ip) req.headers['x-forwarded-for'] = req.ip;
    else delete req.headers['x-forwarded-for'];
    await handler(req, res);
  }
}
