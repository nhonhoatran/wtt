/** A DATE column is a calendar date, even when JSON encodes it as UTC midnight. */
export const rankingDateOnly = (value: string): string => value.slice(0, 10);

export const rankingPointsExpired = (expiresAt: string, today: string | undefined): boolean =>
  Boolean(today && rankingDateOnly(expiresAt) <= today);
