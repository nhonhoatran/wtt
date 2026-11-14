import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_EVENT_STATUSES, PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { EmptyState } from '../../../components/common/empty-state';
import { FilterForm } from '../../../components/common/filter-form';
import { PaginationLinks } from '../../../components/common/pagination-links';
import { EventCard } from '../../../components/events/event-card';
import cardStyles from '../../../components/events/event-card.module.css';
import { format, getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { pickLocalized } from '../../../i18n/pick-localized';
import { getEventList } from '../../../lib/public-data';
import { anyText, isPageParam, oneOf, toQuery } from '../../../lib/public-query';
import { pageMetadata } from '../../../lib/page-metadata';

type SearchParams = Record<string, string | string[] | undefined>;

interface EventsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

export async function generateMetadata({ params }: EventsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).events;
  return pageMetadata(locale, '/events', { title: t.title, description: t.metaDescription });
}

export default async function EventsPage({ params, searchParams }: EventsPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const searching = Boolean(one(query.q).trim());
  // The unfiltered list (cached) names the codes and years a filter may take.
  const catalog = await getEventList('', false);
  if (!catalog) notFound();
  const rules = {
    q: anyText,
    tier: oneOf(catalog.filters.tiers.map((row) => row.code)),
    type: oneOf(catalog.filters.eventTypes.map((row) => row.code)),
    year: oneOf(catalog.filters.years.map(String)),
    status: oneOf(Object.keys(PUBLIC_EVENT_STATUSES)),
  };
  const filterQuery = toQuery(query, rules);
  const list = await getEventList(toQuery(query, { ...rules, page: isPageParam }), searching);
  if (!list) notFound();

  const base = `/${locale}/events`;
  const hrefFor = (page: number) => {
    const search = new URLSearchParams(filterQuery.slice(1));
    if (page > 1) search.set('page', String(page));
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const named = (row: { code: string; name: string; nameEn: string | null }) => ({ value: row.code, label: pickLocalized(locale, row.name, row.nameEn) });
  const tier = one(query.tier);

  return (
    <main id="content" className="container">
      <h1 className="page-title">{t.events.title}</h1>
      <FilterForm
        label={t.events.filters.label}
        action={base}
        t={t.common}
        fields={[
          { kind: 'search', name: 'q', label: t.events.filters.q, value: one(query.q), maxLength: PUBLIC_SEARCH_MAX_LENGTH },
          { kind: 'select', name: 'tier', label: t.events.filters.tier, value: tier, options: list.filters.tiers.map(named) },
          {
            kind: 'select',
            name: 'type',
            label: t.events.filters.type,
            value: one(query.type),
            options: list.filters.eventTypes.filter((type) => !tier || type.tierCode === tier).map(named),
          },
          { kind: 'select', name: 'year', label: t.events.filters.year, value: one(query.year), options: list.filters.years.map((y) => ({ value: String(y), label: String(y) })) },
          {
            kind: 'select',
            name: 'status',
            label: t.events.filters.status,
            value: one(query.status),
            options: Object.entries(PUBLIC_EVENT_STATUSES).map(([value, status]) => ({ value, label: t.events.status[status] })),
          },
        ]}
      />
      <h2 className="result-count">{format(t.common.resultCount, { n: list.total })}</h2>
      {list.items.length === 0 ? (
        <EmptyState text={t.events.empty} />
      ) : (
        <ul className={cardStyles.grid}>
          {list.items.map((event) => (
            <li key={event.slug}>
              <EventCard event={event} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      )}
      <PaginationLinks page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={hrefFor} t={t.common} />
    </main>
  );
}
