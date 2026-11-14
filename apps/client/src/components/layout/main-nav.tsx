import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import styles from './site-chrome.module.css';

/** Inline links on wide screens; on phones the same links fold into a <details> menu (works without JavaScript). */
export function MainNav({ locale, t }: { locale: Locale; t: Dictionary['nav'] }) {
  const links = (
    <ul className={styles.navList}>
      <li>
        <Link href={`/${locale}/events`}>{t.events}</Link>
      </li>
      <li>
        <Link href={`/${locale}/events/calendar`}>{t.calendar}</Link>
      </li>
    </ul>
  );
  return (
    <nav aria-label={t.label} className={styles.nav}>
      <div className={styles.navInline}>{links}</div>
      <details className={styles.navMenu}>
        <summary>{t.menu}</summary>
        <div className={styles.navPanel}>{links}</div>
      </details>
    </nav>
  );
}
