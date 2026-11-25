import { entryChangeTags, publicCacheTags as t, type EntryChangeTagContext } from '@kamito/shared';
import type {
  MatchTagContext,
  DrawTagContext,
  RankingTagContext,
  EventTagContext,
  SubEventTagContext,
  PlayerTagContext,
  ScheduleTagContext,
  VenueTableTagContext,
  EventSlugsTagContext,
  SubEventUsageTagContext,
  RankingListTagContext,
} from './cache-tag-contexts.js';

export type {
  MatchTagContext,
  DrawTagContext,
  RankingTagContext,
  EventTagContext,
  SubEventTagContext,
  PlayerTagContext,
  ScheduleTagContext,
  VenueTableTagContext,
  EventSlugsTagContext,
  SubEventUsageTagContext,
  RankingListTagContext,
} from './cache-tag-contexts.js';

const eventTags = (c: EventTagContext) => [
  t.events(),
  ...c.eventSlugs.flatMap((slug) => [t.event(slug), t.schedule(slug), ...c.subEventCodes.flatMap((code) => [t.draw(slug, code), t.groups(slug, code)])]),
  ...c.eventSlugs.flatMap((slug) => (c.matchNos ?? []).map((no) => t.match(slug, no))),
];

const eventVisibilityTags = (c: EventTagContext) => [
  ...eventTags(c),
  t.resultsStrip(),
  ...c.eventSlugs.flatMap((slug) => (c.matchNos ?? []).map((no) => t.match(slug, no))),
  ...(c.playerSlugs ?? []).map(t.player),
];

const subEventTags = (c: SubEventTagContext) => [
  t.events(),
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  ...c.subEventCodes.flatMap((code) => [t.draw(c.eventSlug, code), t.groups(c.eventSlug, code)]),
];

const playerTags = (c: PlayerTagContext) => [
  t.players(),
  t.rankings(),
  ...c.playerSlugs.map(t.player),
  ...c.events.flatMap((event) => [
    ...entryChangeTags({ eventSlug: event.eventSlug, subEventCodes: event.subEventCodes, playerSlugs: [] }),
    t.schedule(event.eventSlug),
    ...event.matchNos.map((no) => t.match(event.eventSlug, no)),
  ]),
];

const venueTableTags = (c: VenueTableTagContext) => [
  ...c.matches.flatMap((m) => [
    t.event(m.eventSlug),
    t.schedule(m.eventSlug),
    t.draw(m.eventSlug, m.subEventCode),
    ...(m.isGroupMatch ? [t.groups(m.eventSlug, m.subEventCode)] : []),
    t.match(m.eventSlug, m.matchNo),
    ...m.playerSlugs.map(t.player),
  ]),
  ...(c.matches.length ? [t.resultsStrip()] : []),
];

const eventCardTags = (c: EventSlugsTagContext) => [t.events(), ...c.eventSlugs.map(t.event)];

const subEventUsageTags = (c: SubEventUsageTagContext) => [
  t.events(),
  t.rankings(),
  ...c.events.flatMap((e) => eventVisibilityTags({ eventSlugs: [e.eventSlug], subEventCodes: e.subEventCodes, matchNos: e.matchNos })),
];

const rankingListTags = (c: RankingListTagContext) => [t.rankings(), t.players(), ...c.codes.map(t.ranking)];

const scheduleTags = (c: ScheduleTagContext) => [
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  ...(c.subEventCodes ?? []).flatMap((code) => [t.draw(c.eventSlug, code), t.groups(c.eventSlug, code)]),
  ...(c.matchNos ?? []).map((no) => t.match(c.eventSlug, no)),
];

const matchTags = (c: MatchTagContext) => [
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  t.draw(c.eventSlug, c.subEventCode),
  ...(c.isGroupMatch ? [t.groups(c.eventSlug, c.subEventCode)] : []),
  ...c.matchNos.map((no) => t.match(c.eventSlug, no)),
];

const matchWithPlayerTags = (c: MatchTagContext) => [...matchTags(c), ...c.playerSlugs.map(t.player)];

const matchResultTags = (c: MatchTagContext) => [...matchTags(c), t.resultsStrip(), ...c.playerSlugs.map(t.player)];

/** Publishing or unpublishing a draw adds or removes public matches, which the event cards show. */
const drawVisibilityTags = (c: DrawTagContext) => [t.events(), ...drawTags(c)];

const drawTags = (c: DrawTagContext) => [
  t.event(c.eventSlug),
  t.schedule(c.eventSlug),
  t.draw(c.eventSlug, c.subEventCode),
  ...(c.hasGroups ? [t.groups(c.eventSlug, c.subEventCode)] : []),
  ...(c.matchNos ?? []).map((no) => t.match(c.eventSlug, no)),
  ...(c.playerSlugs ?? []).map(t.player),
];

/**
 * Single map from admin mutation to the exact public cache tags it invalidates (no wildcards).
 * Mutations added in later phases register here (route coverage test: later part of phase 07).
 */
export const CACHE_TAGS = {
  'match.start': matchWithPlayerTags,
  'match.unStart': matchWithPlayerTags,
  'match.saveProgress': matchWithPlayerTags,
  'match.confirm': matchResultTags,
  'match.amend': matchResultTags,
  'match.reopen': matchResultTags,
  // Group standings (manual ranks, recompute): event, schedule, draw and groups pages of the sub-event; the results strip shows matches, not standings.
  'group.standings': drawTags,
  'draw.publish': drawVisibilityTags,
  // Unpublish and every edit of a published draw; the draw tag covers both MAIN and QUALIFYING of the sub-event.
  'draw.unpublish': drawVisibilityTags,
  'draw.postPublishEdit': drawTags,
  // Qualifiers or group places filling slots of a published MAIN draw.
  'draw.placeQualifiers': drawTags,
  'schedule.update': scheduleTags,
  'session.create': scheduleTags,
  'session.update': scheduleTags,
  'session.delete': scheduleTags,
  // "Refresh public pages" button: every tag of the event.
  'event.refresh': eventVisibilityTags,
  'tier.write': eventCardTags,
  'eventType.write': eventCardTags,
  'venue.write': eventCardTags,
  'venueTable.write': venueTableTags,
  'media.update': (c: EventSlugsTagContext) => [...eventCardTags(c), t.players(), t.rankings(), t.articles(), t.sponsors(), t.home()],
  'discipline.write': subEventUsageTags,
  'category.write': subEventUsageTags,
  'rankingList.write': rankingListTags,
  'rankingRules.write': eventCardTags,
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
  'content.write': () => [t.articles(), t.videos(), t.pages(), t.sponsors(), t.home(), t.settings()],
} as const;

export type CacheTagMutation = keyof typeof CACHE_TAGS;
