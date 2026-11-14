import { z } from 'zod';
import { defineAppSetting, type AppSettingDefinition } from './app-setting-definition.js';
import { authSettings } from './auth-settings.js';
import { listSettings } from './list-settings.js';
import { importOperationalSettings } from './import-operational-settings.js';
import { importSettings, playerSettings } from './player-settings.js';
import { publicSiteSettings } from './public-site-settings.js';
import { tournamentSettings } from './tournament-settings.js';

export * from './app-setting-definition.js';

/**
 * Registry of settings stored in AppSetting (editable by admins).
 * Each entry owns its zod schema and default; secrets and connection strings stay in env.
 */
export const appSettingRegistry = {
  siteName: defineAppSetting({
    key: 'site.name',
    schema: z.object({ vi: z.string().min(1).max(120), en: z.string().min(1).max(120) }),
    defaultValue: { vi: 'Giải bóng bàn Kamito', en: 'Kamito Table Tennis' },
    description: 'Tên site hiển thị ở header, tiêu đề trang',
  }),
  ...authSettings,
  ...tournamentSettings,
  ...listSettings,
  ...playerSettings,
  ...importSettings,
  ...importOperationalSettings,
  ...publicSiteSettings,
} as const;

export type AppSettingKey = (typeof appSettingRegistry)[keyof typeof appSettingRegistry]['key'];

export function findAppSetting(key: string): AppSettingDefinition | undefined {
  return Object.values(appSettingRegistry).find((def) => def.key === key);
}

export function listEditableAppSettings(): AppSettingDefinition[] {
  return (Object.values(appSettingRegistry) as AppSettingDefinition[]).filter((def) => Boolean(def.editor));
}

/** Parses a stored value; falls back to the default when invalid or missing. */
export function resolveAppSetting<T extends z.ZodType>(def: AppSettingDefinition<T>, stored: unknown): z.infer<T> {
  const parsed = def.schema.safeParse(stored);
  return parsed.success ? parsed.data : def.defaultValue;
}
