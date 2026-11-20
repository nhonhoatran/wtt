import { HttpException, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { can, QueueName, safeErrorSummary } from '@kamito/shared';
import { Queue } from 'bullmq';
import type { Express, NextFunction, Request, Response } from 'express';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { hasTrustedOrigin, sendOriginMismatch } from '../../common/security/trusted-origin.js';
import type { SessionResolver } from '../auth/session-resolver.service.js';

export const BULL_BOARD_PATH = '/api/v1/admin/queues';

const logger = new Logger('BullBoard');
const READ_METHODS = new Set(['GET', 'HEAD']);

/**
 * bull-board is plain Express, outside Nest guards, so it repeats the checks here:
 * session -> password-change gate -> queues.read (GET) / queues.manage (writes) -> Origin.
 */
function guard(resolver: SessionResolver, env: ApiEnv) {
  return (req: Request, res: Response, next: NextFunction) => {
    const deny = (status: number, code: string) => res.status(status).json({ error: { code, message: code } });
    resolver
      // bull-board's UI polls its /api/* routes every few seconds; only page loads count as activity.
      .resolve(req.headers, { touch: !req.path.startsWith('/api/') })
      .then(({ user }) => {
        if (user.mustChangePassword) return deny(403, 'PASSWORD_CHANGE_REQUIRED');
        const action = READ_METHODS.has(req.method) ? 'read' : 'manage';
        if (!can(user.role, 'queues', action)) return deny(403, 'FORBIDDEN');
        if (!hasTrustedOrigin(req, env.ADMIN_PUBLIC_URL)) return sendOriginMismatch(res);
        next();
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) return deny(error.getStatus(), 'UNAUTHORIZED');
        logger.error({ msg: 'queue dashboard request failed', err: safeErrorSummary(error) });
        deny(500, 'INTERNAL_ERROR');
      });
  };
}

/** One BullMQ handle per known queue, closed with the app. */
@Injectable()
export class BullBoardQueues implements OnModuleDestroy {
  readonly queues: Queue[];

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.queues = Object.values(QueueName).map(
      (name) => new Queue(name, { connection: { url: env.REDIS_URL }, prefix: env.QUEUE_PREFIX }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.queues.map((queue) => queue.close()));
  }
}

export function mountBullBoard(server: Express, queues: BullBoardQueues, resolver: SessionResolver, env: ApiEnv): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);
  createBullBoard({ queues: queues.queues.map((queue) => new BullMQAdapter(queue)), serverAdapter });
  server.use(BULL_BOARD_PATH, guard(resolver, env), serverAdapter.getRouter());
}
