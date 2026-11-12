import { stripDiacritics } from './strip-diacritics.js';

/** Trims and collapses inner whitespace; the stored display form of a typed name. */
export function cleanPersonName(input: string): string {
  return input.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Matching/search key: lowercase, no diacritics, single spaces. */
export function normalizePersonName(input: string): string {
  return stripDiacritics(cleanPersonName(input)).toLowerCase();
}
