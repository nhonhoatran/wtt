import Link from 'next/link';
import type { Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { resolveNavItems } from '../../lib/nav-items';
import type { SiteChromeDisplay } from '../../lib/site-display';
import { LocaleSwitcher } from './locale-switcher';
import { MainNav } from './main-nav';
import { RegistrationButton } from './registration-button';
import { ResultsStrip } from './results-strip';
import styles from './header.module.css';

/** Wordmark is the site name from settings. DOM order: skip link, header, results strip. */
export function SiteHeader({ locale, siteName, t, display }: { locale: Locale; siteName: string; t: Dictionary; display: SiteChromeDisplay }) {
  const items = resolveNavItems(display.navItems, locale, t.nav);
  const register = { url: display.registrationUrl, label: t.nav.register, newTabLabel: t.nav.opensInNewTab };
  const searchIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
  return (
    <>
      <a className={styles.skipLink} href="#content">
        {t.site.skipToContent}
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={`/${locale}`} className={styles.wordmark}>
            <span className={styles.wordmarkText}>{siteName}</span>
            <span aria-hidden="true" className={styles.mark} />
          </Link>
          <MainNav locale={locale} items={items} t={t.nav} panelExtra={<>
            <Link href={`/${locale}/search`} className={styles.searchPanel}>{searchIcon}{t.search.title}</Link>
            <RegistrationButton {...register} className={styles.registerPanel} />
          </>} />
          <div className={styles.actions}>
            <Link href={`/${locale}/search`} className={styles.searchBar} aria-label={t.search.title}>{searchIcon}</Link>
            <LocaleSwitcher current={locale} label={t.nav.language} switchLabel={t.nav.switchTo} />
            <RegistrationButton {...register} className={styles.registerBar} />
          </div>
        </div>
      </header>
      <ResultsStrip locale={locale} t={t} />
    </>
  );
}
