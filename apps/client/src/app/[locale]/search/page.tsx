import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';
import { EmptyState } from '../../../components/common/empty-state';
import { FilterForm } from '../../../components/common/filter-form';
import { EventMonthList } from '../../../components/events/event-month-list';
import { PlayerTable } from '../../../components/players/player-table';
import { format, getDictionary } from '../../../i18n/get-dictionary';
import { isLocale } from '../../../i18n/locales';
import { groupEventsByMonth } from '../../../lib/group-events-by-month';
import { pageMetadata } from '../../../lib/page-metadata';
import { getEventList, getPlayerList } from '../../../lib/public-data';
import { anyText, toQuery } from '../../../lib/public-query';
import styles from './search.module.css';

interface SearchProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: SearchProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).search;
  return { ...pageMetadata(locale, '/search', { title: t.title, description: t.description }), robots: { index: false, follow: true } };
}

/** Search existing public serializers in parallel; empty searches do not list everyone or call either API. */
export default async function SearchPage({ params, searchParams }: SearchProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const base = `/${locale}/search`;
  const applied = toQuery(query, { q: anyText });
  const q = new URLSearchParams(applied).get('q') ?? '';
  const [events, players] = q ? await Promise.allSettled([
    getEventList(applied, true), getPlayerList(applied, true),
  ]) : [];
  const eventList = events?.status === 'fulfilled' ? events.value : null;
  const playerList = players?.status === 'fulfilled' ? players.value : null;

  return (
    <main id="content" className="container">
      <h1 className="page-title">{t.search.title}</h1>
      <p className={styles.intro}>{t.search.description}</p>
      <FilterForm action={base} label={t.search.title} t={{ ...t.common, filter: t.search.submit, clearFilters: t.search.clear }} fields={[
        { kind: 'search', name: 'q', label: t.search.label, value: q, maxLength: PUBLIC_SEARCH_MAX_LENGTH },
      ]} />
      {!q ? <EmptyState text={t.search.hint} /> : <>
        <section className={styles.section} aria-labelledby="search-events">
          <div className={styles.heading}>
            <h2 id="search-events">{t.events.title}{eventList ? ` (${eventList.total})` : ''}</h2>
            {eventList && <Link href={`/${locale}/events${applied}`}>{format(t.search.allEvents, { n: eventList.total })}</Link>}
          </div>
          {!eventList ? <EmptyState text={t.search.unavailable} /> : eventList.items.length
            ? <EventMonthList groups={groupEventsByMonth(eventList.items)} locale={locale} t={t} />
            : <EmptyState text={t.search.noEvents} />}
        </section>
        <section className={styles.section} aria-labelledby="search-players">
          <div className={styles.heading}>
            <h2 id="search-players">{t.players.title}{playerList ? ` (${playerList.total})` : ''}</h2>
            {playerList && <Link href={`/${locale}/players${applied}`}>{format(t.search.allPlayers, { n: playerList.total })}</Link>}
          </div>
          {!playerList ? <EmptyState text={t.search.unavailable} /> : playerList.items.length
            ? <PlayerTable items={playerList.items} locale={locale} t={t.players} />
            : <EmptyState text={t.search.noPlayers} />}
        </section>
      </>}
    </main>
  );
}
