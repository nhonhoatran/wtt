import type { PublicEventDetail } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { EventWhenWhere, HeroBackLink } from './event-hero-parts';
import { TierBadge } from './tier-badge';
import styles from './event-hero.module.css';

/** Slim hero of the tabs below the overview: tier, name, dates and place only. */
export function EventHeroCompact({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  return (
    <section className={`${styles.hero} ${styles.compact}`} data-event-hero>
      <div className={styles.inner}>
        <HeroBackLink locale={locale} t={t} />
        <div className={styles.compactRow}>
          <h1 className={styles.compactTitle}>
            <TierBadge tier={event.tier} locale={locale} filled />
            <span>{pickLocalized(locale, event.name, event.nameEn)}</span>
          </h1>
          <EventWhenWhere event={event} locale={locale} t={t} />
        </div>
      </div>
    </section>
  );
}
