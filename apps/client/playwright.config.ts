import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// The client does not read the root .env itself; root values never override variables already set.
const rootEnv = path.join(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const apiPort = process.env.API_PORT ?? '3000';
const clientPort = 3001;
const siteUrl = `http://localhost:${clientPort}`;
process.env.E2E_WORLD_FILE ??= path.join(import.meta.dirname, 'test-results/e2e-world.json');
process.env.E2E_SITE_URL = siteUrl;

const serverEnv = {
  ...(process.env as Record<string, string>),
  API_FETCH_TIMEOUT_MS: '5000',
  REVALIDATE_ALLOWED_HOSTS: process.env.REVALIDATE_ALLOWED_HOSTS ?? `localhost:${clientPort}`,
};

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/artifacts',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: siteUrl, locale: 'vi-VN', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: [
    {
      // No --watch: a restart in the middle of a run would drop requests.
      command: 'pnpm --filter @kamito/api exec node --env-file-if-exists=../../.env --import @swc-node/register/esm-register src/main.ts',
      url: `http://localhost:${apiPort}/api/v1/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: serverEnv,
    },
    {
      command: `pnpm exec next dev --port ${clientPort}`,
      url: `${siteUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: serverEnv,
    },
  ],
});
