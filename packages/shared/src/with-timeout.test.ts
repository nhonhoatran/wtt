import { describe, expect, it } from 'vitest';
import { withTimeout } from './with-timeout.js';

describe('withTimeout', () => {
  it('returns the value when the work settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('rejects when the work hangs', async () => {
    await expect(withTimeout(new Promise<never>(() => undefined), 20)).rejects.toThrow(/timed out after 20 ms/);
  });
});
