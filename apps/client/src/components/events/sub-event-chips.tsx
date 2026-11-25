import type { PublicCoded } from '@kamito/shared';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import styles from './sub-event-chips.module.css';

/** Sub-event names as small tags. Plain text, so the surrounding link or heading stays the only control. */
export function SubEventChips({ subEvents, locale, onDark = false }: { subEvents: PublicCoded[]; locale: Locale; onDark?: boolean }) {
  if (subEvents.length === 0) return null;
  return (
    <ul className={onDark ? `${styles.chips} ${styles.onDark}` : styles.chips}>
      {subEvents.map((s) => <li key={s.code} className={styles.chip}>{pickLocalized(locale, s.name, s.nameEn)}</li>)}
    </ul>
  );
}
