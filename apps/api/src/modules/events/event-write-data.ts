import type { Prisma } from '@kamito/db';
import { sanitizeRichHtmlOrNull } from '../../common/html/sanitize-rich-html.js';
import { formatDateOnly, parseDateOnly } from './date-only.js';
import type { UpdateEventBody } from './event-dtos.js';

export type EventFields = Partial<Omit<Prisma.EventUncheckedCreateInput, 'id'>>;

/** Request body -> column values: dates parsed, rich text sanitized, omitted keys dropped. */
export function toEventFields(body: UpdateEventBody): EventFields {
  const { startDate, endDate, infoBody, infoBodyEn, ...rest } = body;
  const fields: EventFields = { ...rest };
  if (startDate) fields.startDate = parseDateOnly(startDate);
  if (endDate) fields.endDate = parseDateOnly(endDate);
  if (infoBody !== undefined) fields.infoBody = sanitizeRichHtmlOrNull(infoBody);
  if (infoBodyEn !== undefined) fields.infoBodyEn = sanitizeRichHtmlOrNull(infoBodyEn);
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as EventFields;
}

const comparable = (value: unknown): unknown => (value instanceof Date ? formatDateOnly(value) : value);

/** Only the keys whose value differs from the stored row, as audit before/after. */
export function diffEventFields(current: Record<string, unknown>, fields: EventFields) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (comparable(current[key]) === comparable(value)) continue;
    before[key] = comparable(current[key]);
    after[key] = comparable(value);
  }
  return Object.keys(after).length ? { before, after } : null;
}
