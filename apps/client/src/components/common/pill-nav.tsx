import Link from 'next/link';
import styles from './pill-nav.module.css';

export interface PillNavItem {
  href: string;
  label: string;
  current: boolean;
  /** Marks the item as the current group rather than the exact page (aria-current="true"). */
  group?: boolean;
}

/**
 * Tabs and choosers as links: each option has its own URL and works without JavaScript. Scrolls sideways on narrow screens.
 * `pill` is the rounded chooser; `tabs` is the underlined tab bar with a red mark on the current item.
 */
export function PillNav({ label, items, variant = 'pill' }: { label: string; items: PillNavItem[]; variant?: 'pill' | 'tabs' }) {
  return (
    <nav className={variant === 'tabs' ? `${styles.nav} ${styles.tabsNav}` : styles.nav} aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={variant === 'tabs' ? styles.tab : styles.pill} aria-current={item.current ? (item.group ? 'true' : 'page') : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
