import { authSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';

const ME = '/api/v1/auth/me';

describe('session idle window is refreshed by activity (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let settings: AppSettingsService;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    settings = kit.app.get(AppSettingsService);
  });

  afterAll(async () => {
    await kit.close();
  });

  it('keeps a session alive that is one minute short of the idle limit, and moves lastSeenAt forward', async () => {
    const user = await kit.createUser();
    const cookie = await kit.signIn(user);
    const idleMinutes = await settings.get(authSettings.sessionIdleMinutes);
    const almostIdle = new Date(Date.now() - (idleMinutes - 1) * 60_000);
    await kit.prisma.session.updateMany({ where: { userId: user.id }, data: { lastSeenAt: almostIdle } });

    await kit.get(ME, cookie).expect(200);

    const row = await kit.prisma.session.findFirstOrThrow({ where: { userId: user.id }, select: { lastSeenAt: true } });
    expect(row.lastSeenAt.getTime()).toBeGreaterThan(almostIdle.getTime() + 60_000);
  });
});
