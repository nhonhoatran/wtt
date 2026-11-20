import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { safeErrorSummary, SSR_SECRET_HEADER } from '@kamito/shared';
import type { Options } from 'pino-http';
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

const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE']);
type RoutedRequest = IncomingMessage & { route?: { path?: unknown } };
const matchedRoute = (req: RoutedRequest) => typeof req.route?.path === 'string' ? req.route.path : undefined;

/** Allowlist output fields; raw URLs, headers, remote addresses and exception details are never serialized. */
export function httpLoggerOptions(level: ApiEnv['LOG_LEVEL']): Options {
  return {
    level,
    genReqId: (req, res) => {
      const id = resolveRequestId(req);
      res.setHeader('x-request-id', id);
      return id;
    },
    wrapSerializers: false,
    serializers: {
      req: (req: IncomingMessage) => ({
        id: typeof req.id === 'string' && REQUEST_ID_PATTERN.test(req.id) ? req.id : undefined,
        method: req.method && HTTP_METHODS.has(req.method) ? req.method : 'UNKNOWN',
      }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      err: safeErrorSummary,
      error: safeErrorSummary,
    },
    customProps: (req) => ({ route: matchedRoute(req) }),
    redact: { paths: LOG_REDACT_PATHS, censor: '***' },
    autoLogging: { ignore: (req) => req.url?.includes('/health/') ?? false },
  };
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        pinoHttp: httpLoggerOptions(env.LOG_LEVEL),
      }),
    }),
  ],
})
export class LoggerModule {}
