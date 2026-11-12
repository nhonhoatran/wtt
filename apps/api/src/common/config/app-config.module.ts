import { Global, Module } from '@nestjs/common';
import { parseEnv } from '@kamito/shared';
import { apiEnvSchema, type ApiEnv } from './env-schema.js';

export const API_ENV = Symbol('API_ENV');

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return parseEnv(apiEnvSchema, source);
}

@Global()
@Module({
  providers: [{ provide: API_ENV, useFactory: () => loadApiEnv() }],
  exports: [API_ENV],
})
export class AppConfigModule {}
