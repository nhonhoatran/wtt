import en from './en.json';
import vi from './vi.json';
import type { Locale } from './locales';

export type Dictionary = typeof vi;

const dictionaries: Record<Locale, Dictionary> = { vi, en };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];

/** Replaces `{name}` placeholders; unknown names are left as written. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
