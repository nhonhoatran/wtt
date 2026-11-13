'use client';

import { useParams } from 'next/navigation';
import { getDictionary } from '../../i18n/get-dictionary';
import { DEFAULT_LOCALE, isLocale } from '../../i18n/locales';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { locale } = useParams<{ locale: string }>();
  const t = getDictionary(isLocale(locale) ? locale : DEFAULT_LOCALE).error;
  return (
    <main id="content" className="container">
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <button type="button" onClick={reset}>
        {t.retry}
      </button>
    </main>
  );
}
