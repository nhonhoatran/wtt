const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-12" -> Date at UTC midnight, the value stored in @db.Date columns. */
export const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00Z`);

export const formatDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export function isRealDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = parseDateOnly(value);
  return !Number.isNaN(parsed.getTime()) && formatDateOnly(parsed) === value;
}
