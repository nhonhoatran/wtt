import type { PublicEventDetail, PublicMatchCard } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { SectionHeading } from '../common/section-heading';
import { MatchCard } from '../matches/match-card';
import cardStyles from '../matches/match-card.module.css';
import styles from './home-sections.module.css';

/** Live matches first, then upcoming ones; the caller already cut the list to the display limit. */
export function HomeTodayMatches({ event, matches, locale, t }: { event: PublicEventDetail; matches: PublicMatchCard[]; locale: Locale; t: Dictionary }) {
  return (
    <section className="container" aria-labelledby="home-matches">
      <SectionHeading id="home-matches" title={t.home.matchesNow} link={{ href: `/${locale}/events/${event.slug}/matches`, label: t.home.allMatches }} />
      <ul className={`${cardStyles.list} ${styles.matchGrid}`}>
        {matches.map((m) => (
          <li key={m.matchNo}>
            <MatchCard match={m} eventSlug={event.slug} locale={locale} timeZone={event.timezone} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
