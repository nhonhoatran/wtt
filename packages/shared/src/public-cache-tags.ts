/** Next.js limits a cache tag to 256 characters. */
export const CACHE_TAG_MAX_LENGTH = 256;
export const REVALIDATE_TAGS_JOB = 'revalidate-tags';

const PART = /^[A-Za-z0-9_.-]+$/;

const join = (...parts: (string | number)[]) => {
  for (const part of parts) {
    if (!PART.test(String(part))) throw new RangeError(`invalid cache tag part: ${String(part)}`);
  }
  return parts.join('-');
};

/** Tags are built from identifiers that appear in public URLs, so a page can declare them before fetching. */
export const publicCacheTags = {
  events: () => 'events',
  event: (eventSlug: string) => join('event', eventSlug),
  schedule: (eventSlug: string) => join('schedule', eventSlug),
  draw: (eventSlug: string, subEventCode: string) => join('draw', eventSlug, subEventCode),
  groups: (eventSlug: string, subEventCode: string) => join('groups', eventSlug, subEventCode),
  match: (eventSlug: string, matchNo: number) => join('match', eventSlug, matchNo),
  resultsStrip: () => 'results-strip',
  players: () => 'players',
  player: (playerSlug: string) => join('player', playerSlug),
  rankings: () => 'rankings',
  ranking: (listCode: string) => join('ranking', listCode),
  settings: () => 'settings',
} as const;

const TAG = /^[a-z][A-Za-z0-9_.-]*$/;

export function isValidCacheTag(tag: unknown): tag is string {
  return typeof tag === 'string' && tag.length > 0 && tag.length <= CACHE_TAG_MAX_LENGTH && TAG.test(tag);
}
