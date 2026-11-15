import { test as base } from '@playwright/test';
import { readWorld, type E2eWorldFile } from './world-file';

export const test = base.extend<object, { world: E2eWorldFile }>({
  // Read lazily: the file is written by globalSetup.
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixture argument.
  world: [async ({}, use) => use(readWorld()), { scope: 'worker' }],
});

export { expect } from '@playwright/test';
