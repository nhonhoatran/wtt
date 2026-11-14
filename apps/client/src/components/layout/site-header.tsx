import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { LocaleSwitcher } from './locale-switcher';
import { MainNav } from './main-nav';
import { ResultsStrip } from './results-strip';
import styles from './site-chrome.module.css';

/** Text wordmark until the official Kamito logo file is delivered. */
export function SiteHeader({ locale, siteName, t }: { locale: Locale; siteName: string; t: Dictionary }) {
  return (
    <>
      <a className={styles.skipLink} href="#content">
        {t.site.skipToContent}
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={`/${locale}`} className={styles.wordmark} aria-label={siteName}>
            KAMITO<span>.</span>
          </Link>
          <MainNav locale={locale} t={t.nav} />
          <LocaleSwitcher target={locale === 'vi' ? 'en' : 'vi'} label={t.nav.switchTo} code={t.nav.switchToCode} />
        </div>
        <ResultsStrip locale={locale} t={t} />
      </header>
    </>
  );
}
