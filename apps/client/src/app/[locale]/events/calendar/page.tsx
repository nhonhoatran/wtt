import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '../../../../components/common/empty-state';
import { FilterForm } from '../../../../components/common/filter-form';
import { EventMonthList } from '../../../../components/events/event-month-list';
import { EventsPageHeader } from '../../../../components/events/events-page-header';
import { format, getDictionary } from '../../../../i18n/get-dictionary';
import { isLocale } from '../../../../i18n/locales';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { getEventCalendar, getEventList } from '../../../../lib/public-data';
import { isYearParam, oneOf, toQuery } from '../../../../lib/public-query';
import { pageMetadata } from '../../../../lib/page-metadata';

interface CalendarPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

async function load({ params, searchParams }: CalendarPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const catalog = await getEventList('', false);
  if (!catalog) notFound();
  const defaultCalendar = await getEventCalendar('');
  if (!defaultCalendar) notFound();
  const calendarQuery = toQuery(query, { year: isYearParam, tier: oneOf(catalog.filters.tiers.map((row) => row.code)) });
  const calendar = calendarQuery ? await getEventCalendar(calendarQuery) : defaultCalendar;
  if (!calendar) notFound();
  return { locale, query, calendar, defaultYear: defaultCalendar.year, t: getDictionary(locale) };
}

export async function generateMetadata(props: CalendarPageProps): Promise<Metadata> {
  const { locale, calendar, defaultYear, t } = await load(props);
  return pageMetadata(locale, calendar.year !== defaultYear ? `/events/calendar?year=${calendar.year}` : '/events/calendar', {
    title: format(t.calendar.title, { year: calendar.year }),
    description: t.calendar.metaDescription,
  });
}

export default async function CalendarPage(props: CalendarPageProps) {
  const { locale, query, calendar, t } = await load(props);
  const years = [...new Set([calendar.year, ...calendar.filters.years])].sort((a, b) => b - a);
  const total = calendar.months.reduce((sum, group) => sum + group.events.length, 0);
  return (
    <main id="content" className="container">
      <EventsPageHeader
        locale={locale}
        t={t}
        title={format(t.calendar.title, { year: calendar.year })}
        crumb={t.nav.calendar}
        description={t.calendar.description}
        chip={total > 0 ? format(t.events.countInYear, { n: total, year: calendar.year }) : undefined}
        switchTo={{ href: `/${locale}/events?year=${calendar.year}`, label: t.calendar.viewList }}
      />
      <FilterForm
        label={t.events.filters.label}
        action={`/${locale}/events/calendar`}
        t={t.common}
        fields={[
          {
            kind: 'select',
            name: 'year',
            label: t.calendar.year,
            value: String(calendar.year),
            options: years.map((y) => ({ value: String(y), label: String(y) })),
            allLabel: null,
          },
          {
            kind: 'select',
            name: 'tier',
            label: t.calendar.tier,
            value: one(query.tier),
            options: calendar.filters.tiers.map((row) => ({ value: row.code, label: pickLocalized(locale, row.name, row.nameEn) })),
          },
        ]}
      />
      {calendar.months.length === 0 && <EmptyState text={t.calendar.empty} />}
      <EventMonthList groups={calendar.months.map((group) => ({ month: group.month, items: group.events }))} locale={locale} t={t} />
    </main>
  );
}
