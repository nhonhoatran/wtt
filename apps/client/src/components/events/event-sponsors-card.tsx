import Link from 'next/link';
import type { PublicSponsor } from '@kamito/shared';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { SponsorStrip } from '../content/sponsor-strip';
import styles from './event-sidebar.module.css';

/** The event's sponsors; the card is left out when there are none, so no empty slots are shown. */
export function EventSponsorsCard({ sponsors, locale, t }: { sponsors: PublicSponsor[]; locale: Locale; t: Dictionary }) {
  if (sponsors.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="event-sponsors">
      <h2 id="event-sponsors" className={styles.title}>{t.home.sponsors}</h2>
      <SponsorStrip sponsors={sponsors} locale={locale} />
      <Link href={`/${locale}/contact`} className={styles.contact}>{t.event.sponsors.contact}</Link>
    </section>
  );
}
