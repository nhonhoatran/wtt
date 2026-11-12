import { z } from 'zod';

/**
 * Registry of business settings stored in AppSetting (editable by admins).
 * Each entry owns its zod schema and default; technical knobs stay in env.
 */
export interface AppSettingDefinition<T extends z.ZodType = z.ZodType> {
  key: string;
  schema: T;
  defaultValue: z.infer<T>;
  description: string;
}

export function defineAppSetting<T extends z.ZodType>(def: AppSettingDefinition<T>): AppSettingDefinition<T> {
  return def;
}

export const appSettingRegistry = {
  siteName: defineAppSetting({
    key: 'site.name',
    schema: z.object({ vi: z.string().min(1).max(120), en: z.string().min(1).max(120) }),
    defaultValue: { vi: 'Giải bóng bàn Kamito', en: 'Kamito Table Tennis' },
    description: 'Tên site hiển thị ở header, tiêu đề trang',
  }),
} as const;

export type AppSettingKey = (typeof appSettingRegistry)[keyof typeof appSettingRegistry]['key'];

export function findAppSetting(key: string): AppSettingDefinition | undefined {
  return Object.values(appSettingRegistry).find((def) => def.key === key);
}

/** Parses a stored value; falls back to the default when invalid or missing. */
export function resolveAppSetting<T extends z.ZodType>(def: AppSettingDefinition<T>, stored: unknown): z.infer<T> {
  const parsed = def.schema.safeParse(stored);
  return parsed.success ? parsed.data : def.defaultValue;
}
