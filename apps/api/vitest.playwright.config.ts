import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

// Seed/cleanup runs started by the client's Playwright globalSetup; never part of `vitest run`.
export default defineConfig({ ...base, test: { ...base.test, include: ['test/playwright/*.seed.ts'] } });
