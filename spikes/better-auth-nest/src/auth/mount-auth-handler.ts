import type { Express, Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AUTH_BASE_PATH } from './auth-env.js';
import type { Auth } from './create-auth.js';
import { RAW_ALLOWLIST } from './raw-allowlist.js';

export interface MountOptions {
  /** Exact Better Auth sub-paths reachable through the raw handler. Default-deny; null disables the filter. */
  rawAllowlist?: string[] | null;
}

/** Must run before Nest registers its body parsers (i.e. before app.init()). */
export function mountAuthHandler(server: Express, auth: Auth, options: MountOptions = {}): void {
  const handler = toNodeHandler(auth);
  const allow = options.rawAllowlist === null ? null : (options.rawAllowlist ?? RAW_ALLOWLIST);

  server.all(`${AUTH_BASE_PATH}/*splat`, (req: Request, res: Response) => {
    if (allow && !allow.includes(req.path.slice(AUTH_BASE_PATH.length))) {
      res.status(404).json({ message: 'Not Found' });
      return;
    }
    // Better Auth reads the client IP from X-Forwarded-For only; overwrite it with the IP Express
    // resolved via trust proxy so a spoofed header cannot choose the rate-limit bucket.
    if (req.ip) req.headers['x-forwarded-for'] = req.ip;
    else delete req.headers['x-forwarded-for'];
    handler(req, res).catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ message: 'Internal Server Error' });
    });
  });
}
