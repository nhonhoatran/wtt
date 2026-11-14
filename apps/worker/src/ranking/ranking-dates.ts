import type { IsoDate } from '@kamito/ranking-engine';

export const toIsoDate = (date: Date): IsoDate => date.toISOString().slice(0, 10);

/** @db.Date columns are read and written as UTC midnight. */
export const fromIsoDate = (date: IsoDate): Date => new Date(`${date}T00:00:00.000Z`);

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
