import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { API_ENV } from './common/config/app-config.module.js';
import type { ApiEnv } from './common/config/env-schema.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

export const API_GLOBAL_PREFIX = 'api/v1';

/** Builds a fully configured app without listening, shared by main.ts and e2e tests. */
export async function createApiApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = app.get<ApiEnv>(API_ENV);
  app.useLogger(app.get(Logger));
  // Explicit hop count: X-Forwarded-For is only trusted for the known proxy chain.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
