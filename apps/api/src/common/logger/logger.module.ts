import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { SSR_SECRET_HEADER } from '@kamito/shared';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { API_ENV } from '../config/app-config.module.js';
import type { ApiEnv } from '../config/env-schema.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function resolveRequestId(req: IncomingMessage): string {
  const incoming = req.headers['x-request-id'];
  return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  `req.headers["${SSR_SECRET_HEADER}"]`,
  'res.headers["set-cookie"]',
  '*.password',
  '*.secret',
  '*.token',
];

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req, res) => {
            const id = resolveRequestId(req);
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: { paths: LOG_REDACT_PATHS, censor: '***' },
          autoLogging: { ignore: (req) => req.url?.includes('/health/') ?? false },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
