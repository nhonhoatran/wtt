import path from 'node:path';
import { defineConfig } from '@playwright/test';

const project = process.env.E2E_FULL_UI_PROJECT ?? 'desktop';
if (project !== 'desktop' && project !== 'mobile') throw new Error('E2E_FULL_UI_PROJECT must be desktop or mobile');
const output = process.env.E2E_FULL_UI_OUTPUT_DIR ?? path.join(import.meta.dirname, 'test-results/admin-full-flow', project);

// Servers and reference fixtures are explicitly leased and guarded outside this browser-only configuration.
export default defineConfig({
  testDir: 'tests/admin-full-flow',
  testMatch: '**/*.spec.ts',
  outputDir: path.join(output, 'artifacts'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: path.join(output, 'results.json') }]],
  use: {
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:3372',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: project, use: project === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1440, height: 900 } } }],
});
