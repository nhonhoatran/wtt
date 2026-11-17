import Link from 'next/link';
import type { PublicPlayerResults } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { EmptyState } from '../common/empty-state';
import { PaginationLinks } from '../common/pagination-links';
import { MatchCard } from '../matches/match-card';
import styles from './players.module.css';

export function PlayerResultsList({ results, slug, locale, t }: { results: PublicPlayerResults; slug: string; locale: Locale; t: Dictionary }) {
  const base = `/${locale}/players/${slug}`;
  return <>
    {results.items.length === 0 ? <EmptyState text={t.players.profile.noResults} /> : (
      <ul className={styles.results}>{results.items.map((match) => <li key={`${match.event.slug}:${match.matchNo}`}>
        <p className={styles.resultEvent}><Link className="text-link" href={`/${locale}/events/${match.event.slug}`}>{pickLocalized(locale, match.event.name, match.event.nameEn)}</Link></p>
        <MatchCard match={match} eventSlug={match.event.slug} locale={locale} timeZone={match.event.timezone} t={t} />
      </li>)}</ul>
    )}
    <PaginationLinks {...results} hrefFor={(page) => `${base}${page > 1 ? `?page=${page}` : ''}#results`} t={t.common} />
  </>;
}
