import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import styles from './events-page-header.module.css';

interface EventsPageHeaderProps {
  locale: Locale;
  t: Dictionary;
  title: string;
  /** Last breadcrumb item: the page itself. */
  crumb: string;
  description: string;
  /** Count chip, e.g. "12 events in 2027". Hidden when empty. */
  chip?: string;
  /** Link to the other view (list or month calendar). */
  switchTo: { href: string; label: string };
}

export function EventsPageHeader({ locale, t, title, crumb, description, chip, switchTo }: EventsPageHeaderProps) {
  return (
    <header className={styles.head}>
      <nav aria-label={t.events.breadcrumb} className={styles.crumbs}>
        <Link href={`/${locale}`} className={styles.crumb}>{t.events.breadcrumbHome}</Link>
        <span aria-hidden="true">/</span>
        <span className={styles.current} aria-current="page">{crumb}</span>
      </nav>
      <div className={styles.row}>
        <div>
          <h1 className={`page-title ${styles.title}`}>{title}</h1>
          <p className={styles.desc}>{description}</p>
        </div>
        <div className={styles.aside}>
          {chip && <p className={styles.chip}>{chip}</p>}
          <Link href={switchTo.href} className={styles.switch}>{switchTo.label}</Link>
        </div>
      </div>
    </header>
  );
}
