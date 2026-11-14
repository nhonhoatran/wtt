import type { PublicEventDetail } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { formatDateRange } from '../../lib/format-date-time';
import styles from './event-hero.module.css';

/** Event head on the navy data surface: tier, name, dates, place, sponsor line and the ticket link when enabled. */
export function EventHero({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  const place = [event.venue ? pickLocalized(locale, event.venue.name, event.venue.nameEn) : null, event.city].filter(Boolean).join(', ');
  return (
    <section className={styles.hero}>
      {event.banner && (
        // Pre-sized WebP variant from the media worker; decorative behind the text.
        <img className={styles.banner} src={event.banner.url} width={event.banner.width} height={event.banner.height} alt="" fetchPriority="high" />
      )}
      <div className={styles.inner}>
        <p className={styles.tier}>
          <span className={styles.dot} style={{ background: event.tier.colorHex }} aria-hidden="true" />
          {pickLocalized(locale, event.tier.name, event.tier.nameEn)} · {t.events.status[event.lifecycle]}
        </p>
        <h1 className="page-title">{pickLocalized(locale, event.name, event.nameEn)}</h1>
        <p className={styles.meta}>
          {formatDateRange(event.startDate, event.endDate, locale)}
          {place && ` · ${place}`}
        </p>
        {event.presentedBy && <p className={styles.meta}>{format(t.event.presentedBy, { name: event.presentedBy })}</p>}
        {pickLocalizedOrNull(locale, event.summary, event.summaryEn) && <p className={styles.summary}>{pickLocalizedOrNull(locale, event.summary, event.summaryEn)}</p>}
        {event.ticketUrl && (
          <a className={styles.ticket} href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
            {t.event.ticket}
          </a>
        )}
      </div>
    </section>
  );
}
