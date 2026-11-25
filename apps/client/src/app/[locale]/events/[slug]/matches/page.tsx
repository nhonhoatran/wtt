import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_MATCH_STATES, PUBLIC_SEARCH_MAX_LENGTH, type PublicMatchState } from '@kamito/shared';
import { EmptyState } from '../../../../../components/common/empty-state';
import { FilterForm } from '../../../../../components/common/filter-form';
import { PaginationLinks } from '../../../../../components/common/pagination-links';
import { PillNav } from '../../../../../components/common/pill-nav';
import { EventShell } from '../../../../../components/events/event-shell';
import { MatchCard } from '../../../../../components/matches/match-card';
import { MatchTable } from '../../../../../components/matches/match-table';
import cardStyles from '../../../../../components/matches/match-card.module.css';
import { pickLocalized } from '../../../../../i18n/pick-localized';
import { loadEventPage } from '../../../../../lib/event-page';
import { loadMatchList } from '../../../../../lib/load-match-list';
import { getMatches } from '../../../../../lib/public-data';
import { anyText, dateWithin, isPageParam, oneOf, toQuery } from '../../../../../lib/public-query';
import { eventPageMetadata } from '../../../../../lib/page-metadata';

type SearchParams = Record<string, string | string[] | undefined>;

interface MatchesPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

export async function generateMetadata({ params }: MatchesPageProps): Promise<Metadata> {
  const { locale, event, t } = await loadEventPage(params);
  return eventPageMetadata(locale, event, '/matches', t.matches.title);
}

export default async function EventMatchesPage({ params, searchParams }: MatchesPageProps) {
  const [{ locale, event, t }, query] = await Promise.all([loadEventPage(params), searchParams]);
  if (!event.tabs.matches) notFound();
  const rules = {
    sub: oneOf(event.subEvents.map((s) => s.code)),
    date: dateWithin(event.startDate, event.endDate),
    q: anyText,
  };
  const searching = Boolean(one(query.q).trim());
  const fetchState = (s: PublicMatchState) =>
    getMatches(event.slug, toQuery({ ...query, state: s }, { state: anyText, ...rules, page: isPageParam }), searching);
  const { state, list } = await loadMatchList(event.lifecycle, query.state, fetchState);
  if (!list) notFound();

  const base = `/${locale}/events/${event.slug}/matches`;
  const filters = new URLSearchParams(toQuery(query, rules).slice(1));
  const href = (changes: Record<string, string>) => {
    const search = new URLSearchParams(filters);
    for (const [key, value] of Object.entries(changes)) search.set(key, value);
    return `${base}?${search}`;
  };

  return (
    <EventShell event={event} locale={locale} t={t} active="matches">
      <h2 className="visually-hidden print-show">
        {t.matches.title} · {t.matches.states[state]}
      </h2>
      <PillNav label={t.matches.statesLabel} items={PUBLIC_MATCH_STATES.map((s) => ({ href: href({ state: s }), label: t.matches.states[s], current: s === state }))} />
      <FilterForm
        label={t.matches.filters.label}
        action={base}
        keep={{ state }}
        t={t.common}
        fields={[
          {
            kind: 'select',
            name: 'sub',
            label: t.matches.filters.sub,
            value: one(query.sub),
            options: event.subEvents.map((s) => ({ value: s.code, label: pickLocalized(locale, s.name, s.nameEn) })),
          },
          {
            kind: 'date',
            name: 'date',
            label: t.matches.filters.date,
            value: filters.get('date') ?? '',
            min: event.startDate,
            max: event.endDate,
          },
          { kind: 'search', name: 'q', label: t.matches.filters.q, value: one(query.q), maxLength: PUBLIC_SEARCH_MAX_LENGTH },
        ]}
      />
      {list.items.length === 0 ? (
        <EmptyState text={t.matches.empty[state]} />
      ) : (
        <>
          <ul className={`${cardStyles.list} ${cardStyles.cardsOnly}`}>
            {list.items.map((m) => (
              <li key={m.matchNo}>
                <MatchCard match={m} eventSlug={event.slug} locale={locale} timeZone={event.timezone} t={t} />
              </li>
            ))}
          </ul>
          <MatchTable matches={list.items} eventSlug={event.slug} locale={locale} timeZone={event.timezone} t={t} />
        </>
      )}
      <PaginationLinks
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        hrefFor={(page) => href(page > 1 ? { state, page: String(page) } : { state })}
        t={t.common}
      />
    </EventShell>
  );
}
