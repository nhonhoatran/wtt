import Link from 'next/link';
import styles from './pill-nav.module.css';

export interface PillNavItem {
  href: string;
  label: string;
  current: boolean;
}

/** Tabs and choosers as links: each option has its own URL and works without JavaScript. Scrolls sideways on narrow screens. */
export function PillNav({ label, items }: { label: string; items: PillNavItem[] }) {
  return (
    <nav className={styles.nav} aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={styles.pill} aria-current={item.current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
