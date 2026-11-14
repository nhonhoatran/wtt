'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOCALE_COOKIE } from '../../i18n/negotiate-locale';
import type { Locale } from '../../i18n/locales';
import styles from './site-chrome.module.css';

const ONE_YEAR_SECONDS = 31_536_000;

/** Same page and filters in the other language; remembers the choice so "/" opens in it next time. */
export function LocaleSwitcher({ target, label, code }: { target: Locale; label: string; code: string }) {
  const pathname = usePathname() ?? '/';
  const rest = pathname.split('/').slice(2).join('/');
  const search = useSearchParams()?.toString();
  const href = `/${target}${rest ? `/${rest}` : ''}${search ? `?${search}` : ''}`;
  return (
    <Link
      href={href}
      hrefLang={target}
      lang={target}
      className={styles.locale}
      aria-label={label}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
      }}
    >
      {code}
    </Link>
  );
}
