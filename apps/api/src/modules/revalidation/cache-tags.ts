import { entryChangeTags, publicCacheTags as t, type EntryChangeTagContext } from '@kamito/shared';

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

export interface RankingTagContext {
  listCode: string;
  /** Players whose rank or points changed (new, moved or dropped) in the published snapshot. */
  playerSlugs: string[];
}

export interface EventTagContext {
  /** Old and new slug when the slug changed. */
  eventSlugs: string[];
  subEventCodes: string[];
  /** Set for publish, unpublish and cancel flips: the event's matches appear on results and match pages. */
  matchNos?: number[];
}

export interface SubEventTagContext {
  eventSlug: string;
  /** Old and new code when the code changed. */
  subEventCodes: string[];
}

export interface PlayerTagContext {
  playerSlugs: string[];
  /** Events whose pages show the player's name or entries, with the match numbers the player appears in. */
  events: { eventSlug: string; subEventCodes: string[]; matchNos: number[] }[];
}

const eventTags = (c: EventTagContext) => [
  t.events(),
  ...c.eventSlugs.flatMap((slug) => [t.event(slug), t.schedule(slug), ...c.subEventCodes.flatMap((code) => [t.draw(slug, code), t.groups(slug, code)])]),
];

const eventVisibilityTags = (c: EventTagContext) => [
  ...eventTags(c),
  t.resultsStrip(),
  ...c.eventSlugs.flatMap((slug) => (c.matchNos ?? []).map((no) => t.match(slug, no))),
];

const subEventTags = (c: SubEventTagContext) => [
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  ...c.subEventCodes.flatMap((code) => [t.draw(c.eventSlug, code), t.groups(c.eventSlug, code)]),
];

const playerTags = (c: PlayerTagContext) => [
  t.players(),
  ...c.playerSlugs.map(t.player),
  ...c.events.flatMap((event) => [
    ...entryChangeTags({ eventSlug: event.eventSlug, subEventCodes: event.subEventCodes, playerSlugs: [] }),
    t.schedule(event.eventSlug),
    ...event.matchNos.map((no) => t.match(event.eventSlug, no)),
  ]),
];

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
  'event.create': eventTags,
  'event.update': eventTags,
  'event.publish': eventVisibilityTags,
  'event.unpublish': eventVisibilityTags,
  'event.cancel': eventVisibilityTags,
  'event.uncancel': eventVisibilityTags,
  'event.delete': eventTags,
  'subEvent.create': subEventTags,
  'subEvent.update': subEventTags,
  'subEvent.delete': subEventTags,
  'entry.create': (c: EntryChangeTagContext) => entryChangeTags(c),
  'entry.update': (c: EntryChangeTagContext) => entryChangeTags(c),
  'entry.bulk': (c: EntryChangeTagContext) => entryChangeTags(c),
  'player.create': playerTags,
  'player.update': playerTags,
  'player.merge': playerTags,
  'settings.update': () => [t.settings()],
  'ranking.publish': (c: RankingTagContext) => [t.rankings(), t.ranking(c.listCode), t.players(), ...c.playerSlugs.map(t.player)],
} as const;

export type CacheTagMutation = keyof typeof CACHE_TAGS;
