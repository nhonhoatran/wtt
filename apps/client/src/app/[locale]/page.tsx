import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '../../components/common/empty-state';
import { EventCard } from '../../components/events/event-card';
import cardStyles from '../../components/events/event-card.module.css';
import { getDictionary } from '../../i18n/get-dictionary';
import { isLocale } from '../../i18n/locales';
import { pageMetadata } from '../../lib/page-metadata';
import { getEventList } from '../../lib/public-data';
import { getSiteName } from '../../lib/site-name';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, '', {});
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [ongoing, upcoming, siteName] = await Promise.all([getEventList('?status=ongoing', false), getEventList('?status=upcoming', false), getSiteName(locale)]);
  const sections = [
    { key: 'ongoing', title: t.home.ongoing, items: ongoing?.items ?? [] },
    { key: 'upcoming', title: t.home.upcoming, items: upcoming?.items ?? [] },
  ].filter((s) => s.items.length > 0);

  return (
    <main id="content" className="container">
      <h1 className="visually-hidden">{siteName}</h1>
      {sections.length === 0 && <EmptyState text={t.home.empty} />}
      {sections.map((s) => (
        <section key={s.key} aria-labelledby={`home-${s.key}`}>
          <h2 id={`home-${s.key}`} className="section-title">
            {s.title}
          </h2>
          <ul className={cardStyles.grid}>
            {s.items.map((event) => (
              <li key={event.slug}>
                <EventCard event={event} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p>
        <Link href={`/${locale}/events`} className="text-link">{t.home.allEvents}</Link>
      </p>
    </main>
  );
}
