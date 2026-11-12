export const AGE_CALCULATIONS = ['BIRTH_YEAR', 'EVENT_START_DATE'] as const;
export type AgeCalculation = (typeof AGE_CALCULATIONS)[number];

export interface BirthInfo {
  birthDate?: Date | string | null;
  birthYear?: number | null;
}

/** Calendar year of birth; birthDate wins over birthYear when both are set. */
export function effectiveBirthYear(info: BirthInfo): number | null {
  if (info.birthDate) return new Date(info.birthDate).getUTCFullYear();
  return info.birthYear ?? null;
}

/**
 * Age used for category limits. BIRTH_YEAR: event year − birth year. EVENT_START_DATE: whole
 * years on the start date; needs a full birth date, otherwise falls back to BIRTH_YEAR.
 * Returns null when nothing is known.
 */
export function ageOnEvent(info: BirthInfo, eventStart: Date | string, method: AgeCalculation): number | null {
  const start = new Date(eventStart);
  if (method === 'EVENT_START_DATE' && info.birthDate) {
    const birth = new Date(info.birthDate);
    let age = start.getUTCFullYear() - birth.getUTCFullYear();
    const beforeBirthday =
      start.getUTCMonth() < birth.getUTCMonth() ||
      (start.getUTCMonth() === birth.getUTCMonth() && start.getUTCDate() < birth.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age;
  }
  const year = effectiveBirthYear(info);
  return year === null ? null : start.getUTCFullYear() - year;
}
