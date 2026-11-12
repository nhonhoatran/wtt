import { z } from 'zod';

const MAX_URL_LENGTH = 2048;
const CONTROL_OR_SPACE = /[\s\x00-\x1f\x7f]/;

/** Only https: URLs are stored; blocks javascript:, data:, http: and protocol-relative tricks. */
export function isHttpsUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH || CONTROL_OR_SPACE.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH)
  .refine(isHttpsUrl, 'Chỉ nhận đường dẫn bắt đầu bằng https://');

/** Empty input clears the field. */
export const optionalHttpsUrlSchema = z
  .union([z.literal(''), httpsUrlSchema, z.null()])
  .transform((value) => (value ? value : null))
  .optional();
