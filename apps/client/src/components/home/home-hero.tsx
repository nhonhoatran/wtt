import Link from 'next/link';
import type { PublicEventDetail } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { formatDateRange } from '../../lib/format-date-time';
import { StatusPill } from '../common/status-pill';
import { SubEventChips } from '../events/sub-event-chips';
import { TierBadge } from '../events/tier-badge';
import styles from './home-hero.module.css';

const PILL = { ONGOING: 'ongoing', UPCOMING: 'upcoming', COMPLETED: 'completed' } as const;

export function HomeHero({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  const base = `/${locale}/events/${event.slug}`;
  const place = [event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null, event.city].filter(Boolean).join(', ');
  const summary = pickLocalizedOrNull(locale, event.summary, event.summaryEn);
  return (
    <section className={styles.hero} aria-labelledby="home-hero-title" data-home-hero>
      {event.banner && (
        // Pre-sized WebP variant from the media worker; decorative behind the text and the LCP image.
        <img className={styles.banner} src={event.banner.url} width={event.banner.width} height={event.banner.height} alt="" fetchPriority="high" />
      )}
      <div className={styles.inner}>
        <div className={styles.badges}>
          <StatusPill variant={PILL[event.lifecycle]} label={t.events.status[event.lifecycle]} />
          <TierBadge tier={event.tier} locale={locale} filled />
          <span className={styles.type}>{pickLocalized(locale, event.eventType.name, event.eventType.nameEn)}</span>
        </div>
        <h1 id="home-hero-title" className={styles.title}>{pickLocalized(locale, event.name, event.nameEn)}</h1>
        <p className={styles.meta}>
          <span>{formatDateRange(event.startDate, event.endDate, locale)}</span>
          {place && <span>{place}</span>}
        </p>
        {summary && <p className={styles.summary}>{summary}</p>}
        <SubEventChips subEvents={event.subEvents} locale={locale} onDark />
        <div className={styles.actions}>
          <Link href={event.tabs.matches ? `${base}/matches` : base} className={styles.primary}>
            {event.tabs.matches ? t.home.heroSchedule : t.home.heroDetails}
          </Link>
          {event.tabs.draws && <Link href={`${base}/draws`} className={styles.secondary}>{t.home.heroDraws}</Link>}
        </div>
      </div>
    </section>
  );
}
