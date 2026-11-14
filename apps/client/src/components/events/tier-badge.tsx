import type { PublicEventCard } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import styles from './tier-badge.module.css';

/** Tier label with its configured colour as a marker; the text stays ink so any admin colour remains readable. */
export function TierBadge({ tier, locale }: { tier: PublicEventCard['tier']; locale: Locale }) {
  return (
    <span className={styles.badge}>
      <span className={styles.dot} style={{ background: tier.colorHex }} aria-hidden="true" />
      {pickLocalized(locale, tier.name, tier.nameEn)}
    </span>
  );
}
