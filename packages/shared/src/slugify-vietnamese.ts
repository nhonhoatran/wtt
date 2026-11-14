const MAX_SLUG_LENGTH = 120;

/** "Giải Vô địch Đơn nam 2026" → "giai-vo-dich-don-nam-2026"; one slug serves both languages. */
export function slugifyVietnamese(input: string, maxLength = MAX_SLUG_LENGTH): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Literal public routes that sit where a slug would (/events/calendar). */
export const RESERVED_SLUGS: readonly string[] = ['calendar'];

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value) && !RESERVED_SLUGS.includes(value);
}
