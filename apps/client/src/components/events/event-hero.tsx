import Link from 'next/link';
import type { PublicEventDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { StatusPill } from '../common/status-pill';
import { EventHeroStats } from './event-hero-stats';
import { EventWhenWhere, HeroBackLink } from './event-hero-parts';
import { TierBadge } from './tier-badge';
import styles from './event-hero.module.css';
import actions from './event-hero-actions.module.css';

const PILL = { ONGOING: 'ongoing', UPCOMING: 'upcoming', COMPLETED: 'completed' } as const;

/** Full hero of the overview: badges, name, when and where, summary, figures and the main calls to action. */
export function EventHero({ event, locale, t, today }: { event: PublicEventDetail; locale: Locale; t: Dictionary; today: string }) {
  const summary = pickLocalizedOrNull(locale, event.summary, event.summaryEn);
  const showToday = event.lifecycle === 'ONGOING' && event.tabs.matches;
  return (
    <section className={styles.hero} data-event-hero>
      {event.banner && (
        // Pre-sized WebP variant from the media worker; decorative behind the text.
        <img className={styles.banner} src={event.banner.url} width={event.banner.width} height={event.banner.height} alt="" fetchPriority="high" />
      )}
      <div className={styles.inner}>
        <HeroBackLink locale={locale} t={t} />
        <div className={styles.badges}>
          <TierBadge tier={event.tier} locale={locale} filled />
          <span className={styles.type}>{pickLocalized(locale, event.eventType.name, event.eventType.nameEn)}</span>
          <StatusPill variant={PILL[event.lifecycle]} label={t.events.status[event.lifecycle]} />
        </div>
        <h1 className={styles.title}>{pickLocalized(locale, event.name, event.nameEn)}</h1>
        <EventWhenWhere event={event} locale={locale} t={t} />
        {event.presentedBy && <p className={styles.presented}>{format(t.event.presentedBy, { name: event.presentedBy })}</p>}
        {summary && <p className={styles.summary}>{summary}</p>}
        <div className={actions.footer}>
          <EventHeroStats event={event} today={today} t={t} />
          {(showToday || event.ticketUrl) && (
            <div className={actions.actions}>
              {showToday && (
                <Link href={`/${locale}/events/${event.slug}/matches?date=${today}`} className={actions.primary}>
                  {t.event.hero.todayMatches}
                </Link>
              )}
              {event.ticketUrl && (
                <a className={actions.ticket} href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
                  {t.event.ticket}
                  <span className="visually-hidden"> ({t.nav.opensInNewTab})</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
