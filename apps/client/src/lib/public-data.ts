import { cache } from 'react';
import {
  publicCacheTags as tags,
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
  type PublicSiteConfig,
  type PublicSitemap,
} from '@kamito/shared';
import { publicGet } from './api-client';

// No dots: a ".." segment would walk the server-side API URL out of /public.
const URL_PART = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** URL parts that cannot form a cache tag or an API path are a 404 before any API call. */
export const isUrlPart = (value: string) => URL_PART.test(value);

// The fetch carries a timeout signal, which disables Next's fetch memoization; cache() dedupes metadata + page.
export const getEventList = cache((query: string, searching: boolean) =>
  publicGet<PublicEventList>(`/events${query}`, { tags: [tags.events(), tags.settings()], policy: searching ? 'none' : 'standard' }),
);

export const getEventCalendar = cache((query: string) =>
  publicGet<PublicEventCalendar>(`/events/calendar${query}`, { tags: [tags.events()], policy: 'standard' }),
);

export const getEvent = cache((slug: string) => publicGet<PublicEventDetail>(`/events/${slug}`, { tags: [tags.event(slug)], policy: 'matchday' }));

export const getEventInfo = cache((slug: string) => publicGet<PublicEventInfo>(`/events/${slug}/info`, { tags: [tags.event(slug)], policy: 'standard' }));

export const getMatches = cache((slug: string, query: string, searching: boolean) =>
  publicGet<PublicMatchList>(`/events/${slug}/matches${query}`, {
    tags: [tags.schedule(slug), tags.settings()],
    policy: searching ? 'none' : 'matchday',
  }),
);

export const getMatch = cache((slug: string, matchNo: number) =>
  publicGet<PublicMatchDetail>(`/events/${slug}/matches/${matchNo}`, { tags: [tags.match(slug, matchNo)], policy: 'matchday' }),
);

export const getBracket = cache((slug: string, code: string, kind: string) =>
  publicGet<PublicBracket>(`/events/${slug}/draws/${code}?kind=${kind}`, { tags: [tags.draw(slug, code)], policy: 'matchday' }),
);

export const getGroups = cache((slug: string, code: string) =>
  publicGet<PublicGroups>(`/events/${slug}/groups/${code}`, { tags: [tags.groups(slug, code)], policy: 'matchday' }),
);

export const getEntries = cache((slug: string, code: string, query: string) =>
  publicGet<PublicEntryList>(`/events/${slug}/entries/${code}${query}`, { tags: [tags.event(slug), tags.settings()], policy: 'standard' }),
);

export const getResultsStrip = cache(() =>
  publicGet<PublicResultsStrip>('/results/strip', { tags: [tags.resultsStrip(), tags.settings()], policy: 'matchday' }),
);

export const getSiteConfig = cache(() => publicGet<PublicSiteConfig>('/site', { tags: [tags.settings()], policy: 'standard' }));

export const getSitemap = cache(() => publicGet<PublicSitemap>('/sitemap', { tags: [tags.events()], policy: 'standard' }));
