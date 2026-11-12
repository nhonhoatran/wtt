import { existsSync } from 'node:fs';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['reflect-metadata'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
