'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getDictionary } from '../../i18n/get-dictionary';
import { DEFAULT_LOCALE, isLocale } from '../../i18n/locales';

export default function NotFound() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getDictionary(locale).notFound;
  return (
    <main id="content" className="container">
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <Link href={`/${locale}`}>{t.home}</Link>
    </main>
  );
}
