import { UnprocessableEntityException } from '@nestjs/common';
import type { z } from 'zod';

/** 422 with per-field messages, the shape the admin forms map onto their inputs. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new UnprocessableEntityException({ code: 'VALIDATION_FAILED', message: 'Dữ liệu không hợp lệ', fields });
}

export function fieldError(field: string, message: string, code = 'VALIDATION_FAILED'): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message, fields: { [field]: message } });
}
