import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dictionary = (locale: 'en' | 'vi') => JSON.parse(
  readFileSync(fileURLToPath(new URL(`../src/i18n/${locale}.json`, import.meta.url)), 'utf8'),
);

function leafKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe('locale dictionaries', () => {
  it('contains every Vietnamese translation key in English', () => {
    expect(leafKeys(dictionary('en')).sort()).toEqual(leafKeys(dictionary('vi')).sort());
  });
});
