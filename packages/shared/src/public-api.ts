/** Global route prefix of the API (no leading slash, as Nest expects). */
export const API_GLOBAL_PREFIX = 'api/v1';
export const PUBLIC_API_SEGMENT = 'public';

/** Header carrying SSR_INTERNAL_SECRET from the client's server renderer to the public API. */
export const SSR_SECRET_HEADER = 'x-internal-secret';
/** Header carrying REVALIDATE_SECRET from the worker to the client's /api/revalidate. */
export const REVALIDATE_SECRET_HEADER = 'x-revalidate-secret';
/** Upper bound of tags in one revalidate call; the worker splits nothing, so payloads above it are permanent errors. */
export const REVALIDATE_MAX_TAGS = 200;
