import { z } from 'zod';

export interface NumberSettingEditor {
  kind: 'number';
  min: number;
  max: number;
  unit: string;
}

export const APP_SETTING_GROUPS = [
  { key: 'auth', label: 'Đăng nhập & phiên' },
  { key: 'list', label: 'Danh sách' },
] as const;
export type AppSettingGroupKey = (typeof APP_SETTING_GROUPS)[number]['key'];

export interface AppSettingDefinition<T extends z.ZodType = z.ZodType> {
  key: string;
  schema: T;
  defaultValue: z.infer<T>;
  description: string;
  /** Present only for settings shown on the admin /settings page. */
  group?: AppSettingGroupKey;
  label?: string;
  editor?: NumberSettingEditor;
}

export function defineAppSetting<T extends z.ZodType>(def: AppSettingDefinition<T>): AppSettingDefinition<T> {
  return def;
}

/** Bounds are validation guard rails (e.g. no lockout threshold that locks everyone out), not business values. */
export function defineNumberSetting(def: {
  key: string;
  group: AppSettingGroupKey;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
}): AppSettingDefinition<z.ZodNumber> {
  const { min, max, unit, ...rest } = def;
  return { ...rest, schema: z.number().int().min(min).max(max), editor: { kind: 'number', min, max, unit } };
}
