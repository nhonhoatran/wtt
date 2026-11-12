import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestContext {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  /** Filled by the auth layer (phase 03). */
  sessionId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: unknown }, _res: Response, next: NextFunction): void {
    const userAgent = req.headers['user-agent'];
    const context: RequestContext = {
      requestId: typeof req.id === 'string' ? req.id : undefined,
      // req.ip honours the explicit "trust proxy" hop count set in main.ts.
      ip: req.ip,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined,
    };
    storage.run(context, next);
  }
}
