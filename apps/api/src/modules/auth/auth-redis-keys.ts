import { createHash } from 'node:crypto';

/** Emails are hashed so Redis never holds PII; QUEUE_PREFIX keeps environments apart. */
export function authRedisKey(prefix: string, kind: string, subject: string): string {
  return `${prefix}:auth:${kind}:${createHash('sha256').update(subject).digest('hex').slice(0, 32)}`;
}

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
