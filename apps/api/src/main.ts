import 'reflect-metadata';
import { findPendingMigrations } from '@kamito/db';
import { createApiApp } from './bootstrap-app.js';
import { API_ENV, loadApiEnv } from './common/config/app-config.module.js';
import type { ApiEnv } from './common/config/env-schema.js';
import { PrismaService } from './modules/prisma/prisma.service.js';

async function bootstrap(): Promise<void> {
  // Fail fast with variable names (never values) before Nest starts wiring.
  loadApiEnv();
  const app = await createApiApp();
  const env = app.get<ApiEnv>(API_ENV);

  const pending = await findPendingMigrations(app.get(PrismaService));
  if (pending.length > 0) {
    console.error(`Refusing to start: migrations not applied: ${pending.join(', ')}`);
    await app.close();
    process.exit(1);
  }

  await app.listen(env.API_PORT, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
