import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AUTH_TOKEN } from './auth/auth.guard.js';
import type { Auth } from './auth/create-auth.js';
import { mountAuthHandler, type MountOptions } from './auth/mount-auth-handler.js';

export const API_GLOBAL_PREFIX = 'api/v1';

export async function createSpikeApp(options: MountOptions & { trustProxyHops?: number } = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] });
  app.set('trust proxy', options.trustProxyHops ?? Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.disable('x-powered-by');
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  mountAuthHandler(app.getHttpAdapter().getInstance(), app.get<Auth>(AUTH_TOKEN), options);
  return app;
}
