import { vitestPreset } from '@kamito/config/vitest-preset';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...vitestPreset,
  test: {
    ...vitestPreset.test,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
