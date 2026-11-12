export const MEDIA_PURPOSES = [
  'tier-logo',
  'tier-background',
  'event-type-logo',
  'event-type-background',
  'event-banner',
  'player-photo',
] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const MEDIA_PROCESS_JOB = 'process-image';
export const MEDIA_CLEANUP_JOB = 'cleanup-expired-intents';

export const MEDIA_FAILURE = {
  notAnImage: 'NOT_AN_IMAGE',
  tooLarge: 'TOO_LARGE',
  intentExpired: 'INTENT_EXPIRED',
  missingUpload: 'MISSING_UPLOAD',
  processingError: 'PROCESSING_ERROR',
  processingTimeout: 'PROCESSING_TIMEOUT',
} as const;

export interface MediaVariant {
  width: number;
  height: number;
  key: string;
}

export const INCOMING_PREFIX = 'incoming/';
export const PUBLIC_PREFIX = 'public/';

export const incomingKeyFor = (purpose: MediaPurpose, uuid: string): string => `${INCOMING_PREFIX}${purpose}/${uuid}`;

export const publicKeyFor = (purpose: string, uuid: string, width: number, at: Date): string =>
  `${PUBLIC_PREFIX}${purpose}/${at.getUTCFullYear()}/${uuid}-${width}.webp`;

/** Effective upload cap: the admin setting (MB) bounded by the server ceiling (bytes). */
export function effectiveMaxImageBytes(settingMegabytes: number, ceilingBytes: number): number {
  return Math.min(Math.floor(settingMegabytes * 1024 * 1024), ceilingBytes);
}

/** Parses "320,640,1280" style widths: positive ints, unique, ascending. */
export function parseVariantWidths(raw: readonly string[]): number[] {
  const widths = raw.map((item) => Number(item));
  if (!widths.length || widths.some((width) => !Number.isInteger(width) || width <= 0 || width > 8192)) {
    throw new Error('MEDIA_IMAGE_VARIANT_WIDTHS must be positive integers');
  }
  return [...new Set(widths)].sort((a, b) => a - b);
}

/** Maps a public object key to its URL under MEDIA_PUBLIC_BASE_URL (which already points at the public/ prefix). */
export function publicUrlFor(baseUrl: string, key: string): string {
  const relative = key.startsWith(PUBLIC_PREFIX) ? key.slice(PUBLIC_PREFIX.length) : key;
  return `${baseUrl.replace(/\/+$/, '')}/${relative}`;
}
