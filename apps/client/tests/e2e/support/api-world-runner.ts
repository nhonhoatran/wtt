import { execSync } from 'node:child_process';

/** Runs one of the API's seed files (own vitest config, never part of `vitest run`) against the dev database. */
export function runApiSeed(file: 'public-world.seed.ts' | 'public-world.cleanup.seed.ts'): void {
  execSync(`pnpm --filter @kamito/api exec vitest run -c vitest.playwright.config.ts test/playwright/${file}`, {
    stdio: 'inherit',
    env: process.env,
  });
}
