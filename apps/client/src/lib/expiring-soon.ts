import { localDay } from './bracket-derivations';

const DAY_MS = 86_400_000;

const dayNumber = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`) / DAY_MS;

/** Calendar days left until `expiresAt` (both YYYY-MM-DD) counted from `today`; negative once expired. */
export function daysUntil(expiresAt: string, today: string): number {
  return dayNumber(expiresAt) - dayNumber(today);
}

/** True while the points still count but expire within `thresholdDays`. 0 (or less) turns the label off. */
export function isExpiringSoon(expiresAt: string, today: string, thresholdDays: number): boolean {
  if (!(thresholdDays > 0)) return false;
  const left = daysUntil(expiresAt, today);
  return Number.isFinite(left) && left >= 0 && left <= thresholdDays;
}

/** Today's calendar day (YYYY-MM-DD) in the site timezone; falls back to UTC when the zone is unusable. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  try {
    return localDay(now.toISOString(), timezone);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
