import { DrawParamsError } from './types.js';

export function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && (value & (value - 1)) === 0;
}

export function bracketSize(entryCount: number): number {
  if (!Number.isInteger(entryCount) || entryCount < 0) {
    throw new DrawParamsError('INVALID_PARAMS', `Invalid entry count: ${entryCount}`);
  }
  let size = 2;
  while (size < entryCount) size *= 2;
  return size;
}

export function roundCountForSize(size: number): number {
  if (!isPowerOfTwo(size) || size < 2) throw new DrawParamsError('INVALID_SIZE', `Invalid bracket size: ${size}`);
  return Math.log2(size);
}

/** The slot facing `position` in round 1 (1-based). */
export function partnerPosition(position: number): number {
  return position % 2 === 1 ? position + 1 : position - 1;
}

/** Splits `total` into `parts` sizes differing by at most one, larger parts first. */
export function splitEvenly(total: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1 || !Number.isInteger(total) || total < 0) {
    throw new DrawParamsError('INVALID_PARAMS', `Cannot split ${total} into ${parts} parts`);
  }
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}
