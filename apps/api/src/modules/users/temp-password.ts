import { randomInt } from 'node:crypto';

// No look-alike characters (0/O, 1/l/I) so the password can be read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const MIN_GENERATED_LENGTH = 14;

export function generateTempPassword(minLength: number): string {
  const length = Math.max(MIN_GENERATED_LENGTH, minLength);
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}
