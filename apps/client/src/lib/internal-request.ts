import { createHash, timingSafeEqual } from 'node:crypto';
import { serverEnv } from './server-env';

/**
 * Defence in depth, not the security boundary (the secret is): the worker reaches the client by its
 * internal service name, public traffic carries the public domain. Reads Host, never X-Forwarded-Host.
 */
export function isInternalHost(host: string | null): boolean {
  return host !== null && serverEnv.revalidateHosts().includes(host.toLowerCase());
}

const digest = (value: string) => createHash('sha256').update(value).digest();

export function isRevalidateSecret(value: string | null): boolean {
  return value !== null && timingSafeEqual(digest(value), digest(serverEnv.revalidateSecret()));
}
