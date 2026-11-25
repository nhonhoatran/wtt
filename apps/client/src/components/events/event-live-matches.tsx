import type { PublicEventDetail, PublicMatchCard } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { SectionHeading } from '../common/section-heading';
import { MatchCard } from '../matches/match-card';
import cardStyles from '../matches/match-card.module.css';

/** Live matches first, then upcoming ones; the caller already cut the list to the display limit. */
export function EventLiveMatches({ event, matches, locale, t }: { event: PublicEventDetail; matches: PublicMatchCard[]; locale: Locale; t: Dictionary }) {
  return (
    <section aria-labelledby="event-live-matches">
      <SectionHeading id="event-live-matches" title={t.event.overview.liveMatches} link={{ href: `/${locale}/events/${event.slug}/matches`, label: t.event.overview.allMatches }} />
      <ul className={cardStyles.list}>
        {matches.map((m) => (
          <li key={m.matchNo}>
            <MatchCard match={m} eventSlug={event.slug} locale={locale} timeZone={event.timezone} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
