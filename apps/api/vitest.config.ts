import { existsSync } from 'node:fs';
import { vitestPreset } from '@kamito/config/vitest-preset';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

process.env.LOG_LEVEL ??= 'warn';
// e2e specs run against real dev dependencies; CI provides env directly.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

// SWC emits decorator metadata, which esbuild does not; Nest DI depends on it.
export default defineConfig({
  ...vitestPreset,
  test: {
    ...vitestPreset.test,
    include: ['src/**/*.test.ts', 'test/**/*.e2e-spec.ts'],
    setupFiles: ['reflect-metadata'],
    fileParallelism: false,
    // Forked workers crash intermittently on Windows (0xC0000409) with no stderr; threads have not.
    pool: 'threads',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
