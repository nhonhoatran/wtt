import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { publicCacheTags, type PublicBracket, type PublicDrawKindParam } from '@kamito/shared';
import { BracketBoard } from '../../../../../../components/bracket/bracket-board';
import { getDictionary } from '../../../../../../i18n/get-dictionary';
import { isLocale, type Locale } from '../../../../../../i18n/locales';
import { pickLocalized } from '../../../../../../i18n/pick-localized';
import { publicGet } from '../../../../../../lib/api-client';
import styles from './draw-page.module.css';

interface DrawPageProps {
  params: Promise<{ locale: string; slug: string; subEventCode: string }>;
  searchParams: Promise<{ draw?: string | string[] }>;
}

const KIND_PARAMS: Record<string, PublicDrawKindParam> = { MAIN: 'main', QUALIFYING: 'qualifying' };

// No dots: a ".." segment would walk the server-side API URL out of /public.
const URL_PART = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Parts that cannot form a cache tag are a 404 before any API call. */
function drawTag(slug: string, subEventCode: string): string | null {
  return URL_PART.test(slug) && URL_PART.test(subEventCode) ? publicCacheTags.draw(slug, subEventCode) : null;
}

// The fetch carries a timeout signal, which disables Next's fetch memoization; cache() dedupes metadata + page.
const fetchBracket = cache((slug: string, subEventCode: string, kind: string, tag: string) =>
  publicGet<PublicBracket>(`/events/${slug}/draws/${subEventCode}?kind=${kind}`, { tags: [tag], policy: 'matchday' }),
);

async function loadDraw({ params, searchParams }: DrawPageProps) {
  const [{ locale, slug, subEventCode }, { draw }] = await Promise.all([params, searchParams]);
  const kind = draw === undefined ? 'main' : draw;
  const tag = drawTag(slug, subEventCode);
  if (!isLocale(locale) || !tag || (kind !== 'main' && kind !== 'qualifying')) notFound();
  const bracket = await fetchBracket(slug, subEventCode, kind, tag);
  if (!bracket) notFound();
  return { locale, bracket, t: getDictionary(locale) };
}

const titleOf = (locale: Locale, b: PublicBracket) =>
  `${pickLocalized(locale, b.subEvent.name, b.subEvent.nameEn)} · ${pickLocalized(locale, b.event.name, b.event.nameEn)}`;

export async function generateMetadata(props: DrawPageProps): Promise<Metadata> {
  const { locale, bracket, t } = await loadDraw(props);
  return { title: `${t.bracket.title} ${titleOf(locale, bracket)}` };
}

export default async function DrawPage(props: DrawPageProps) {
  const { locale, bracket, t } = await loadDraw(props);
  const base = `/${locale}/events/${bracket.event.slug}/draws/${bracket.subEvent.code}`;
  return (
    <main id="content" className="container">
      <p className={styles.eyebrow}>{pickLocalized(locale, bracket.event.name, bracket.event.nameEn)}</p>
      <h1 className={styles.title}>
        {t.bracket.title} · {pickLocalized(locale, bracket.subEvent.name, bracket.subEvent.nameEn)}
      </h1>
      {bracket.availableKinds.length > 1 && (
        <nav className={styles.kinds} aria-label={t.bracket.title}>
          {bracket.availableKinds.map((kind) => (
            <Link
              key={kind}
              href={kind === 'MAIN' ? base : `${base}?draw=${KIND_PARAMS[kind]}`}
              className={styles.kind}
              aria-current={kind === bracket.draw.kind ? 'page' : undefined}
            >
              {t.bracket.kind[kind]}
            </Link>
          ))}
        </nav>
      )}
      <BracketBoard bracket={bracket} locale={locale} t={t.bracket} />
    </main>
  );
}
