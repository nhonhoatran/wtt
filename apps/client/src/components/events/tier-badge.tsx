import type { PublicEventCard } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { isHexColor, readableTextColor } from '../../lib/readable-text-color';
import styles from './tier-badge.module.css';

/**
 * Default: the tier colour as a marker dot with ink text, so any admin colour stays readable.
 * `filled`: the tier colour as background with white or ink text chosen by contrast.
 */
export function TierBadge({ tier, locale, filled = false }: { tier: PublicEventCard['tier']; locale: Locale; filled?: boolean }) {
  const name = pickLocalized(locale, tier.name, tier.nameEn);
  const color = isHexColor(tier.colorHex) ? tier.colorHex : null;
  if (filled) {
    const style = color ? { background: color, color: readableTextColor(color) } : undefined;
    return <span className={`${styles.badge} ${styles.filled}`} style={style}>{name}</span>;
  }
  return (
    <span className={styles.badge}>
      <span className={styles.dot} style={color ? { background: color } : undefined} aria-hidden="true" />
      {name}
    </span>
  );
}
