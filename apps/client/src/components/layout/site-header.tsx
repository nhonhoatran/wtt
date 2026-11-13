import Link from 'next/link';
import type { Locale } from '../../i18n/locales';
import styles from './site-chrome.module.css';

/** Text wordmark until the official Kamito logo file is delivered. */
export function SiteHeader({ locale, siteName, skipLabel }: { locale: Locale; siteName: string; skipLabel: string }) {
  return (
    <>
      <a className={styles.skipLink} href="#content">
        {skipLabel}
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={`/${locale}`} className={styles.wordmark} aria-label={siteName}>
            KAMITO<span>.</span>
          </Link>
        </div>
      </header>
    </>
  );
}
