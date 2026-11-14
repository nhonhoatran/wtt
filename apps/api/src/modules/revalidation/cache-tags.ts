import { publicCacheTags as t } from '@kamito/shared';

export interface MatchTagContext {
  eventSlug: string;
  subEventCode: string;
  /** The match itself plus every match it fed (winner advanced into). */
  matchNos: number[];
  isGroupMatch: boolean;
  playerSlugs: string[];
}

export interface DrawTagContext {
  eventSlug: string;
  subEventCode: string;
  hasGroups: boolean;
}

const matchTags = (c: MatchTagContext) => [
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  t.draw(c.eventSlug, c.subEventCode),
  ...(c.isGroupMatch ? [t.groups(c.eventSlug, c.subEventCode)] : []),
  ...c.matchNos.map((no) => t.match(c.eventSlug, no)),
];

const drawTags = (c: DrawTagContext) => [
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  t.draw(c.eventSlug, c.subEventCode),
  ...(c.hasGroups ? [t.groups(c.eventSlug, c.subEventCode)] : []),
];

/**
 * Single map from admin mutation to the exact public cache tags it invalidates (no wildcards).
 * Mutations added in later phases register here (route coverage test: later part of phase 07).
 */
export const CACHE_TAGS = {
  'match.start': matchTags,
  'match.confirm': (c: MatchTagContext) => [...matchTags(c), t.resultsStrip(), ...c.playerSlugs.map(t.player)],
  'draw.publish': drawTags,
  // Unpublish and every edit of a published draw; the draw tag covers both MAIN and QUALIFYING of the sub-event.
  'draw.unpublish': drawTags,
  'draw.postPublishEdit': drawTags,
  'settings.update': () => [t.settings()],
} as const;

export type CacheTagMutation = keyof typeof CACHE_TAGS;
