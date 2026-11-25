import { contentSettings, publicSiteDisplaySettings } from '@kamito/shared';
import type { ContentWorld, SettingJson } from './content-fixture';

type HomeSections = typeof contentSettings.homeSections.defaultValue;
type NavItems = typeof publicSiteDisplaySettings.navItems.defaultValue;

/** Restore only the version written by this test, so concurrent external changes are never overwritten. */
async function withAppSetting(cms: ContentWorld, key: string, value: SettingJson, run: () => Promise<void>): Promise<void> {
  const before = await cms.db.appSetting.findUnique({ where: { key } });
  const applied = await cms.db.appSetting.upsert({
    where: { key }, create: { key, value }, update: { value },
  });
  try {
    await cms.refresh(['home', 'settings']);
    await run();
  } finally {
    const where = { key, updatedAt: applied.updatedAt };
    const restored = before
      ? await cms.db.appSetting.updateMany({ where, data: { value: before.value as SettingJson, updatedById: before.updatedById } })
      : await cms.db.appSetting.deleteMany({ where });
    if (restored.count !== 1) throw new Error(`${key} changed outside this test; refusing to overwrite that change`);
    await cms.refresh(['home', 'settings']);
  }
}

export const withHomeSections = (cms: ContentWorld, value: HomeSections, run: () => Promise<void>) =>
  withAppSetting(cms, contentSettings.homeSections.key, value, run);

export const withSiteNavItems = (cms: ContentWorld, value: NavItems, run: () => Promise<void>) =>
  withAppSetting(cms, publicSiteDisplaySettings.navItems.key, value, run);
