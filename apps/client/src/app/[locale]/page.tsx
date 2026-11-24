import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '../../components/common/empty-state';
import { ArticleCard } from '../../components/content/article-card';
import { SponsorStrip } from '../../components/content/sponsor-strip';
import { VideoCard } from '../../components/content/video-card';
import contentStyles from '../../components/content/content-layout.module.css';
import contentGridStyles from '../../components/content/content.module.css';
import { EventCard } from '../../components/events/event-card';
import cardStyles from '../../components/events/event-card.module.css';
import { getDictionary } from '../../i18n/get-dictionary';
import { isLocale } from '../../i18n/locales';
import { pageMetadata } from '../../lib/page-metadata';
import { getHomeContent } from '../../lib/public-data';
import { getSiteName } from '../../lib/site-name';
import { pickLocalized } from '../../i18n/pick-localized';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, '', { description: getDictionary(locale).home.metaDescription });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [home, siteName] = await Promise.all([
    getHomeContent(),
    getSiteName(locale),
  ]);
  const events = home?.upcomingEvents ?? [];
  const sections = home?.sections ?? { hero: true, events: true, news: true, videos: true, rankings: true, sponsors: true };
  const rankingItems = home?.topRankings ?? [];

  return (
    <main id="content" className="container">
      <h1 className="visually-hidden">{siteName}</h1>
      {!home && <EmptyState text={t.home.empty} />}
      {home?.sections.hero && home.featuredEvents.length > 0 && <section aria-labelledby="home-featured">
        <h2 id="home-featured" className="section-title">{t.home.featured}</h2>
        <ul className={contentStyles.homeHero}>{home.featuredEvents.map((event) => <li key={event.slug}><EventCard event={event} locale={locale} t={t} /></li>)}</ul>
      </section>}
      {sections.events && <section aria-labelledby="home-events">
        <h2 id="home-events" className="section-title">{t.home.upcoming}</h2>
        {events.length ? <ul className={cardStyles.grid}>{events.map((event) => <li key={event.slug}><EventCard event={event} locale={locale} t={t} /></li>)}</ul> : <p>{t.home.empty}</p>}
        <p><Link href={`/${locale}/events`} className="text-link">{t.home.allEvents}</Link></p>
      </section>}
      {sections.news && <section aria-labelledby="home-news"><h2 id="home-news" className="section-title">{t.home.news}</h2>
        {home?.featuredArticles.length ? <ul className={contentGridStyles.grid}>{home.featuredArticles.map((article) => <li key={article.slug}><ArticleCard article={article} locale={locale} /></li>)}</ul> : <p>{t.news.empty}</p>}
        <p><Link href={`/${locale}/news`} className="text-link">{t.home.allNews}</Link></p>
      </section>}
      {sections.videos && <section aria-labelledby="home-videos"><h2 id="home-videos" className="section-title">{t.home.videos}</h2>
        {home?.latestVideos.length ? <ul className={contentGridStyles.grid}>{home.latestVideos.map((video) => <li key={video.slug}><VideoCard video={video} locale={locale} playLabel={t.videos.play} /></li>)}</ul> : <p>{t.videos.empty}</p>}
        <p><Link href={`/${locale}/videos`} className="text-link">{t.home.allVideos}</Link></p>
      </section>}
      {sections.rankings && rankingItems.length ? <section aria-labelledby="home-rankings"><h2 id="home-rankings" className="section-title">{t.home.rankings}</h2>
        <div className={contentStyles.rankings}>{rankingItems.map((ranking) => <section key={ranking.list.code} className={contentStyles.rankingCard}>
          <h3><Link href={`/${locale}/rankings/${ranking.list.code}`}>{pickLocalized(locale, ranking.list.name, ranking.list.nameEn)}</Link></h3>
          <ol>{ranking.items.map((row) => <li key={`${ranking.list.code}-${row.rank}-${row.player.slug ?? row.player.name}`}><span>{row.rank}</span>{row.player.slug ? <Link href={`/${locale}/players/${row.player.slug}`}>{pickLocalized(locale, row.player.name, row.player.nameEn)}</Link> : <span>{pickLocalized(locale, row.player.name, row.player.nameEn)}</span>}<strong>{row.points}</strong></li>)}</ol>
        </section>)}</div>
        <p><Link href={`/${locale}/rankings`} className="text-link">{t.rankings.viewAll}</Link></p></section> : null}
      {sections.sponsors && home?.sponsors.length ? <section aria-labelledby="home-sponsors"><h2 id="home-sponsors" className="section-title">{t.home.sponsors}</h2><SponsorStrip sponsors={home.sponsors} locale={locale} /></section> : null}
    </main>
  );
}
