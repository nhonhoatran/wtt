'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import styles from './site-chrome.module.css';

/** Inline links on wide screens; on phones the same links fold into a <details> menu (works without JavaScript). */
export function MainNav({ locale, t }: { locale: Locale; t: Dictionary['nav'] }) {
  const pathname = usePathname();
  const eventsHref = `/${locale}/events`;
  const calendarHref = `${eventsHref}/calendar`;
  const inEvents = pathname?.startsWith(`${eventsHref}/`) && pathname !== calendarHref;
  const links = (
    <ul className={styles.navList}>
      <li>
        <Link href={eventsHref} aria-current={pathname === eventsHref ? 'page' : inEvents ? 'location' : undefined}>{t.events}</Link>
      </li>
      <li>
        <Link href={calendarHref} aria-current={pathname === calendarHref ? 'page' : undefined}>{t.calendar}</Link>
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
