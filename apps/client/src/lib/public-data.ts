import { cache } from 'react';
import {
  publicCacheTags as tags,
  PUBLIC_URL_PART_PATTERN,
  type PublicBracket,
  type PublicEntryList,
  type PublicEventCalendar,
  type PublicEventDetail,
  type PublicEventInfo,
  type PublicEventList,
  type PublicGroups,
  type PublicMatchDetail,
  type PublicMatchList,
  type PublicResultsStrip,
  type PublicSchedule,
  type PublicSiteConfig,
  type PublicSitemap,
  type PublicRankingOverview,
  type PublicRankingList,
  type PublicPlayerList,
  type PublicPlayerProfile,
  type PublicPlayerRedirect,
  type PublicPlayerResults,
  type PublicEventRankingPoints,
} from '@kamito/shared';
import { publicGet } from './api-client';

/** URL parts that cannot form a cache tag or an API path are a 404 before any API call. */
export const isUrlPart = (value: string) => PUBLIC_URL_PART_PATTERN.test(value);

// The fetch carries a timeout signal, which disables Next's fetch memoization; cache() dedupes metadata + page.
export const getEventList = cache((query: string, searching: boolean) =>
  publicGet<PublicEventList>(`/events${query}`, { tags: [tags.events(), tags.settings()], policy: searching ? 'none' : 'standard' }),
);

export const getEventCalendar = cache((query: string) =>
  publicGet<PublicEventCalendar>(`/events/calendar${query}`, { tags: [tags.events()], policy: 'standard' }),
);

export const getEvent = cache((slug: string) => publicGet<PublicEventDetail>(`/events/${slug}`, { tags: [tags.event(slug), tags.players()], policy: 'matchday' }));

export const getEventInfo = cache((slug: string) => publicGet<PublicEventInfo>(`/events/${slug}/info`, { tags: [tags.event(slug)], policy: 'standard' }));

export const getSchedule = cache((slug: string, query = '') =>
  publicGet<PublicSchedule>(`/events/${slug}/schedule${query}`, { tags: [tags.schedule(slug), tags.event(slug), tags.players()], policy: 'matchday' }),
);

export const getMatches = cache((slug: string, query: string, searching: boolean) =>
  publicGet<PublicMatchList>(`/events/${slug}/matches${query}`, {
    tags: [tags.schedule(slug), tags.players(), tags.settings()],
    policy: searching ? 'none' : 'matchday',
  }),
);

export const getMatch = cache((slug: string, matchNo: number) =>
  publicGet<PublicMatchDetail>(`/events/${slug}/matches/${matchNo}`, { tags: [tags.match(slug, matchNo), tags.players()], policy: 'matchday' }),
);

export const getBracket = cache((slug: string, code: string, kind: string) =>
  publicGet<PublicBracket>(`/events/${slug}/draws/${code}?kind=${kind}`, { tags: [tags.draw(slug, code), tags.players()], policy: 'matchday' }),
);

export const getGroups = cache((slug: string, code: string) =>
  publicGet<PublicGroups>(`/events/${slug}/groups/${code}`, { tags: [tags.groups(slug, code), tags.players()], policy: 'matchday' }),
);

export const getEntries = cache((slug: string, code: string, query: string) =>
  publicGet<PublicEntryList>(`/events/${slug}/entries/${code}${query}`, { tags: [tags.event(slug), tags.players(), tags.settings()], policy: 'standard' }),
);

export const getResultsStrip = cache(() =>
  publicGet<PublicResultsStrip>('/results/strip', { tags: [tags.resultsStrip(), tags.players(), tags.settings()], policy: 'matchday' }),
);

export const getSiteConfig = cache(() => publicGet<PublicSiteConfig>('/site', { tags: [tags.settings()], policy: 'standard' }));

export const getSitemap = cache(() => publicGet<PublicSitemap>('/sitemap', { tags: [tags.events()], policy: 'standard' }));

export const getRankings = cache(() =>
  publicGet<PublicRankingOverview>('/rankings', { tags: [tags.rankings(), tags.players(), tags.events(), tags.settings()], policy: 'standard' }),
);

export const getRankingList = cache((code: string, query = '', searching = false) =>
  publicGet<PublicRankingList>(`/rankings/${code}${query}`, {
    tags: [tags.ranking(code), tags.rankings(), tags.players(), tags.events(), tags.settings()], policy: searching ? 'none' : 'standard',
  }),
);

export const getPlayerList = cache((query = '', searching = false) =>
  publicGet<PublicPlayerList>(`/players${query}`, { tags: [tags.players(), tags.rankings(), tags.settings()], policy: searching ? 'none' : 'standard' }),
);

export const getPlayerProfile = cache((slug: string) =>
  publicGet<PublicPlayerProfile | PublicPlayerRedirect>(`/players/${slug}`, {
    tags: [tags.player(slug), tags.players(), tags.rankings(), tags.events(), tags.settings()], policy: 'standard',
  }),
);

export const getPlayerResults = cache((slug: string, query = '') =>
  publicGet<PublicPlayerResults>(`/players/${slug}/results${query}`, {
    tags: [tags.player(slug), tags.players(), tags.events(), tags.settings()], policy: 'matchday',
  }),
);

export const getEventRankingPoints = cache((slug: string) =>
  publicGet<PublicEventRankingPoints>(`/events/${slug}/ranking-points`, {
    tags: [tags.event(slug), tags.rankings(), tags.settings()], policy: 'standard',
  }),
);
