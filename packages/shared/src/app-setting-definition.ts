import { z } from 'zod';

export interface NumberSettingEditor {
  kind: 'number';
  min: number;
  max: number;
  unit: string;
}

export interface TextSettingEditor {
  kind: 'text';
  maxLength: number;
}

export interface BooleanSettingEditor {
  kind: 'boolean';
}

export interface TimezoneSettingEditor {
  kind: 'timezone';
}

/** One value from a fixed list of options. */
export interface ChoiceSettingEditor {
  kind: 'choice';
  options: { value: string; label: string }[];
}

/** Picks one tournament (or none) from /admin/events. */
export interface EventSettingEditor {
  kind: 'event';
}

export interface JsonSettingEditor { kind: 'json' }

export type AppSettingEditor =
  | NumberSettingEditor
  | TextSettingEditor
  | BooleanSettingEditor
  | TimezoneSettingEditor
  | EventSettingEditor
  | JsonSettingEditor
  | ChoiceSettingEditor;

export const APP_SETTING_GROUPS = [
  { key: 'event', label: 'Giải đấu' },
  { key: 'display', label: 'Hiển thị site công khai' },
  { key: 'media', label: 'Ảnh tải lên' },
  { key: 'players', label: 'Vận động viên' },
  { key: 'imports', label: 'Import Excel' },
  { key: 'auth', label: 'Đăng nhập & phiên' },
  { key: 'list', label: 'Danh sách' },
  { key: 'draw', label: 'Bốc thăm & nhánh đấu' },
  { key: 'ranking', label: 'Xếp hạng' },
  { key: 'publicAccess', label: 'Truy cập site công khai' },
  { key: 'content', label: 'Nội dung công khai' },
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
  editor?: AppSettingEditor;
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
}): AppSettingDefinition<z.ZodNumber> & { editor: NumberSettingEditor } {
  const { min, max, unit, ...rest } = def;
  return { ...rest, schema: z.number().int().min(min).max(max), editor: { kind: 'number' as const, min, max, unit } };
}
