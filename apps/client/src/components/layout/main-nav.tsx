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
  const rankingsHref = `/${locale}/rankings`;
  const playersHref = `/${locale}/players`;
  const newsHref = `/${locale}/news`;
  const videosHref = `/${locale}/videos`;
  const contactHref = `/${locale}/contact`;
  const inEvents = pathname?.startsWith(`${eventsHref}/`) && pathname !== calendarHref;
  const links = (
    <ul className={styles.navList}>
      <li>
        <Link href={eventsHref} aria-current={pathname === eventsHref ? 'page' : inEvents ? 'location' : undefined}>{t.events}</Link>
      </li>
      <li>
        <Link href={calendarHref} aria-current={pathname === calendarHref ? 'page' : undefined}>{t.calendar}</Link>
      </li>
      <li>
        <Link href={rankingsHref} aria-current={pathname === rankingsHref ? 'page' : pathname?.startsWith(`${rankingsHref}/`) ? 'location' : undefined}>{t.rankings}</Link>
      </li>
      <li>
        <Link href={playersHref} aria-current={pathname === playersHref ? 'page' : pathname?.startsWith(`${playersHref}/`) ? 'location' : undefined}>{t.players}</Link>
      </li>
      <li><Link href={newsHref} aria-current={pathname === newsHref || pathname?.startsWith(`${newsHref}/`) ? 'location' : undefined}>{t.news}</Link></li>
      <li><Link href={videosHref} aria-current={pathname === videosHref || pathname?.startsWith(`${videosHref}/`) ? 'location' : undefined}>{t.videos}</Link></li>
      <li><Link href={contactHref} aria-current={pathname === contactHref ? 'page' : undefined}>{t.contact}</Link></li>
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
