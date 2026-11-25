'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { navCurrent, type NavItem } from '../../lib/nav-items';
import styles from './header.module.css';

/** Inline links on wide screens; on phones the same links fold into a <details> menu (works without JavaScript). */
export function MainNav({ locale, items, t, panelExtra }: { locale: Locale; items: NavItem[]; t: Dictionary['nav']; panelExtra?: ReactNode }) {
  const pathname = usePathname();
  const links = (
    <ul className={styles.navList}>
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} aria-current={navCurrent(item.key, pathname, locale)}>{item.label}</Link>
        </li>
      ))}
    </ul>
  );
  return (
    <nav aria-label={t.label} className={styles.nav}>
      <div className={styles.navInline}>{links}</div>
      <details className={styles.navMenu}>
        <summary>{t.menu}</summary>
        <div className={styles.navPanel}>
          {links}
          {panelExtra}
        </div>
      </details>
    </nav>
  );
}
