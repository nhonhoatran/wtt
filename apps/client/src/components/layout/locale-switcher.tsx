'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOCALE_COOKIE } from '../../i18n/negotiate-locale';
import { LOCALES, type Locale } from '../../i18n/locales';
import styles from './header.module.css';

const ONE_YEAR_SECONDS = 31_536_000;

/** "VI | EN": the current language is plain text, the other one keeps the page and filters and remembers the choice. */
export function LocaleSwitcher({ current, label, switchLabel }: { current: Locale; label: string; switchLabel: string }) {
  const pathname = usePathname() ?? '/';
  const rest = pathname.split('/').slice(2).join('/');
  const search = useSearchParams()?.toString();
  const hrefFor = (target: Locale) => `/${target}${rest ? `/${rest}` : ''}${search ? `?${search}` : ''}`;
  return (
    <div role="group" aria-label={label} className={styles.localeGroup}>
      {LOCALES.map((code, index) => (
        <span key={code} className={styles.localeItem}>
          {index > 0 && <span aria-hidden="true" className={styles.localeSep}>|</span>}
          {code === current ? (
            <span className={styles.locale} aria-current="true">{code.toUpperCase()}</span>
          ) : (
            <Link
              href={hrefFor(code)}
              hrefLang={code}
              lang={code}
              className={`${styles.locale} ${styles.localeLink}`}
              aria-label={`${code.toUpperCase()}, ${switchLabel}`}
              onClick={() => {
                document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
              }}
            >
              {code.toUpperCase()}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}
