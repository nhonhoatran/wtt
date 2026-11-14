import type { IsoDate } from './types.js';

const MS_PER_DAY = 86_400_000;

export function addDays(date: IsoDate, days: number): IsoDate {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid ISO date: ${date}`);
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10);
}
