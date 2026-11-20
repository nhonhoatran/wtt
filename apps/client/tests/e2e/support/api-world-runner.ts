import { execSync } from 'node:child_process';
import { confirmedTestDatabaseUrl } from './test-database-target';

/** Runs seed files only against the caller's confirmed local test database. */
export function runApiSeed(file: 'public-world.seed.ts' | 'public-world.cleanup.seed.ts' | 'ranking-publish.seed.ts'): void {
  confirmedTestDatabaseUrl(process.env.DATABASE_URL, process.env.MIGRATE_CONFIRM_TARGET);
  execSync(`pnpm --filter @kamito/api exec vitest run -c vitest.playwright.config.ts test/playwright/${file}`, {
    stdio: 'inherit',
    env: process.env,
  });
}
