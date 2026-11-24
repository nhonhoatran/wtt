import { defineConfig } from 'vitest/config';

/** Offline rendering checks: actual React/CSS and Chromium, with no API or database. */
export default defineConfig({
  test: { include: ['tests/offline/*.test.ts'], environment: 'node', pool: 'threads', testTimeout: 60_000 },
});
