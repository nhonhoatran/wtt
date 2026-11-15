import { Prisma } from '@kamito/db';
import { publicSiteSettings } from '@kamito/shared';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AuditService } from '../src/common/audit/audit.service.js';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';

let kit: AuthTestKit;
beforeAll(async () => { kit = await AuthTestKit.start(); });
afterAll(async () => { await kit?.close(); });

it('two API service instances observe committed setting changes without a local TTL delay', async () => {
  const def = publicSiteSettings.rateLimitMaxRequests;
  const original = await kit.prisma.appSetting.findUnique({ where: { key: def.key } });
  const user = await kit.createUser({ role: 'ADMIN' });
  const first = new AppSettingsService(kit.prisma, kit.app.get(AuditService));
  const second = new AppSettingsService(kit.prisma, kit.app.get(AuditService));
  await second.get(def);
  try {
    await first.update(def, def.defaultValue + 1, user.id);
    expect(await second.get(def)).toBe(def.defaultValue + 1);
    await first.reset(def);
    expect(await second.get(def)).toBe(def.defaultValue);
  } finally {
    await kit.prisma.$transaction(async (tx) => {
      await tx.appSetting.deleteMany({ where: { key: def.key } });
      if (original) await tx.appSetting.create({ data: { ...original, value: original.value === null ? Prisma.JsonNull : original.value } });
    });
  }
});
