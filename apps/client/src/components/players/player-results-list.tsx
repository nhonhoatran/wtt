import Link from 'next/link';
import type { PublicPlayerResults } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { EmptyState } from '../common/empty-state';
import { PaginationLinks } from '../common/pagination-links';
import { MatchCard } from '../matches/match-card';
import { PlayerResultsTable } from './player-results-table';
import styles from './player-results.module.css';

/** Table from 768px up, match cards below; both come from the same page of results. */
export function PlayerResultsList({ results, slug, locale, t }: { results: PublicPlayerResults; slug: string; locale: Locale; t: Dictionary }) {
  const base = `/${locale}/players/${slug}`;
  return <>
    {results.items.length === 0 ? <EmptyState text={t.players.profile.noResults} /> : <>
      <PlayerResultsTable items={results.items} slug={slug} locale={locale} t={t} />
      <ul className={styles.cards}>{results.items.map((match) => <li key={`${match.event.slug}:${match.matchNo}`}>
        <p className={styles.cardEvent}><Link className="text-link" href={`/${locale}/events/${match.event.slug}`}>{pickLocalized(locale, match.event.name, match.event.nameEn)}</Link></p>
        <MatchCard match={match} eventSlug={match.event.slug} locale={locale} timeZone={match.event.timezone} t={t} />
      </li>)}</ul>
    </>}
    <PaginationLinks {...results} hrefFor={(page) => `${base}${page > 1 ? `?page=${page}` : ''}#results`} t={t.common} />
  </>;
}
