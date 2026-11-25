import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PUBLIC_EVENT_STATUSES, PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { EmptyState } from '../../../components/common/empty-state';
import { FilterForm } from '../../../components/common/filter-form';
import { PaginationLinks } from '../../../components/common/pagination-links';
import { EventMonthList } from '../../../components/events/event-month-list';
import { EventStatusPills } from '../../../components/events/event-status-pills';
import { EventsPageHeader } from '../../../components/events/events-page-header';
import { format, getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { pickLocalized } from '../../../i18n/pick-localized';
import { groupEventsByMonth } from '../../../lib/group-events-by-month';
import { getEventList } from '../../../lib/public-data';
import { anyText, isPageParam, oneOf, toQuery } from '../../../lib/public-query';
import { pageMetadata } from '../../../lib/page-metadata';

type SearchParams = Record<string, string | string[] | undefined>;

interface EventsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

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
  const searching = Boolean(typeof query.q === 'string' && query.q.trim());
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

  // Only values that passed validation drive the form, the pills and the chip.
  const applied = new URLSearchParams(filterQuery.slice(1));
  const status = applied.get('status') ?? '';
  const year = applied.get('year') ?? '';
  const base = `/${locale}/events`;
  const hrefFor = (page: number) => {
    const search = new URLSearchParams(applied);
    if (page > 1) search.set('page', String(page));
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const named = (row: { code: string; name: string; nameEn: string | null }) => ({ value: row.code, label: pickLocalized(locale, row.name, row.nameEn) });
  const tier = applied.get('tier') ?? '';
  const chip = format(year ? t.events.countInYear : t.events.count, { n: list.total, year });
  const calendarHref = `/${locale}/events/calendar${year ? `?year=${year}` : ''}`;

  return (
    <main id="content" className="container">
      <EventsPageHeader
        locale={locale}
        t={t}
        title={t.events.title}
        crumb={t.events.title}
        description={t.events.description}
        chip={chip}
        switchTo={{ href: calendarHref, label: t.events.viewCalendar }}
      />
      <FilterForm
        label={t.events.filters.label}
        action={base}
        t={t.common}
        keep={status ? { status } : {}}
        clearHref={base}
        extraActive={Boolean(status)}
        fields={[
          { kind: 'search', name: 'q', label: t.events.filters.q, value: applied.get('q') ?? '', maxLength: PUBLIC_SEARCH_MAX_LENGTH },
          { kind: 'select', name: 'tier', label: t.events.filters.tier, value: tier, options: list.filters.tiers.map(named) },
          {
            kind: 'select',
            name: 'type',
            label: t.events.filters.type,
            value: applied.get('type') ?? '',
            options: list.filters.eventTypes.filter((type) => !tier || type.tierCode === tier).map(named),
          },
          { kind: 'select', name: 'year', label: t.events.filters.year, value: year, options: list.filters.years.map((y) => ({ value: String(y), label: String(y) })) },
        ]}
      />
      <EventStatusPills base={base} filters={filterQuery} status={status} t={t} />
      {list.items.length === 0 ? (
        <EmptyState text={t.events.empty} />
      ) : (
        <EventMonthList groups={groupEventsByMonth(list.items)} locale={locale} t={t} />
      )}
      <PaginationLinks page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={hrefFor} t={t.common} />
    </main>
  );
}
