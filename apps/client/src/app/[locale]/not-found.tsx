import Link from 'next/link';
import { getDictionary } from '../../i18n/get-dictionary';
import { DEFAULT_LOCALE } from '../../i18n/locales';

// not-found receives no params, so it speaks the default locale.
export default function NotFound() {
  const t = getDictionary(DEFAULT_LOCALE).notFound;
  return (
    <main id="content" className="container">
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <Link href={`/${DEFAULT_LOCALE}`}>{t.home}</Link>
    </main>
  );
}
