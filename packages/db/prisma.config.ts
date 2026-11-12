import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

const here = path.dirname(fileURLToPath(import.meta.url));
// Prisma 7 no longer loads .env itself; repo-root .env is the single source in dev.
loadEnv({ path: path.resolve(here, '../../.env'), quiet: true });

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: { path: path.join('prisma', 'migrations') },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
