import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { createAuth } from './auth-instance.js';

describe('Better Auth log privacy', () => {
  it('scrubs interpolated library messages and raw errors through the installed logger hook', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const auth = createAuth({}, {
        ADMIN_PUBLIC_URL: 'https://admin.example.test', AUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      } as ApiEnv, {
        allowAttempt: async () => true, onFailure: async () => undefined, onSuccess: async () => undefined,
      });
      const context = await auth.$context;
      context.logger.error('Invalid origin: https://person@example.test/private?token=secret',
        Object.assign(new Error('password=private-password person@example.test'), { code: 'P2002' }));
      context.logger.warn('Invalid origin: https://person@example.test/private?token=secret');
      expect(errorLog).toHaveBeenCalledWith({ msg: 'auth library event', level: 'error', err: { type: 'Error', code: 'P2002' } });
      expect(warnLog).toHaveBeenCalledWith({ msg: 'auth library event', level: 'warn', err: { type: 'UnknownError' } });
      const output = JSON.stringify([errorLog.mock.calls, warnLog.mock.calls]);
      for (const value of ['person@example.test', '/private', 'token=', 'private-password', 'stack']) expect(output).not.toContain(value);
    } finally {
      errorLog.mockRestore();
      warnLog.mockRestore();
    }
  });
});
