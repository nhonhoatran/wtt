import { authSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountLockoutService } from '../src/modules/auth/account-lockout.service.js';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';

const CHANGE_PASSWORD = '/api/v1/auth/change-password';

describe('change-password shares the account lockout (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let settings: AppSettingsService;
  let lockout: AccountLockoutService;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    settings = kit.app.get(AppSettingsService);
    lockout = kit.app.get(AccountLockoutService);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('locks the account after repeated wrong current passwords, then refuses even the right one', async () => {
    const user = await kit.createUser();
    const cookie = await kit.signIn(user);
    const maxFailures = await settings.get(authSettings.lockoutMaxFailures);
    const newPassword = `${user.password}-next`;

    for (let i = 0; i < maxFailures; i += 1) {
      const res = await kit
        .write('post', CHANGE_PASSWORD, cookie, { currentPassword: `wrong-${i}-password`, newPassword })
        .expect(422);
      expect(res.body.error.fields).toHaveProperty('currentPassword');
    }
    expect(await lockout.isLocked(user.email)).toBe(true);

    await kit.write('post', CHANGE_PASSWORD, cookie, { currentPassword: user.password, newPassword }).expect(422);
    await lockout.clear(user.email);
  });
});
