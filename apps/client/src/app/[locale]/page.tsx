import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentSettings, type PublicMatchCard } from '@kamito/shared';
import { EmptyState } from '../../components/common/empty-state';
import { SectionHeading } from '../../components/common/section-heading';
import { SponsorStrip } from '../../components/content/sponsor-strip';
import { VideoCard } from '../../components/content/video-card';
import contentGridStyles from '../../components/content/content.module.css';
import { EventCard } from '../../components/events/event-card';
import { HomeHero } from '../../components/home/home-hero';
import { HomeNews } from '../../components/home/home-news';
import { HomeTodayMatches } from '../../components/home/home-today-matches';
import { HomeTopRankings } from '../../components/home/home-top-rankings';
import sectionStyles from '../../components/home/home-sections.module.css';
import { getDictionary } from '../../i18n/get-dictionary';
import { isLocale } from '../../i18n/locales';
import { pickHomeRanking } from '../../lib/home-ranking-param';
import { pageMetadata } from '../../lib/page-metadata';
import { getEvent, getHomeContent, getMatches } from '../../lib/public-data';
import { getSiteName } from '../../lib/site-name';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return pageMetadata(locale, '', { description: getDictionary(locale).home.metaDescription });
}

const DEFAULT_SECTIONS = { hero: true, events: true, news: true, videos: true, rankings: true, sponsors: true };
const NO_MATCHES: PublicMatchCard[] = [];

interface HomePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [home, siteName, query] = await Promise.all([getHomeContent(), getSiteName(locale), searchParams]);
  const sections = home?.sections ?? DEFAULT_SECTIONS;
  const heroSlug = sections.hero ? home?.heroEventSlug ?? null : null;
  const hero = heroSlug ? await getEvent(heroSlug).catch(() => null) : null;

  // Same query strings as the match tab, so both pages share one cache entry per state.
  const limit = home?.itemsPerSection ?? contentSettings.homeItemsPerSection.defaultValue;
  const [live, upcoming] = hero?.lifecycle === 'ONGOING' && hero.tabs.matches
    ? await Promise.all((['live', 'upcoming'] as const).map((state) => getMatches(hero.slug, `?state=${state}`, false).catch(() => null)))
    : [null, null];
  const matches = [...(live?.items ?? NO_MATCHES), ...(upcoming?.items ?? NO_MATCHES)].slice(0, limit);

  const lists = home?.topRankings ?? [];
  const activeRanking = pickHomeRanking(lists, query.ranking);
  const events = home?.upcomingEvents ?? [];

  return (
    <main id="content">
      {hero ? <HomeHero event={hero} locale={locale} t={t} /> : <h1 className="visually-hidden">{siteName}</h1>}
      {!home && <div className="container"><EmptyState text={t.home.empty} /></div>}
      {hero && matches.length > 0 && <HomeTodayMatches event={hero} matches={matches} locale={locale} t={t} />}
      {sections.events && events.length > 0 && <section className="container" aria-labelledby="home-events">
        <SectionHeading id="home-events" title={t.home.upcoming} link={{ href: `/${locale}/events`, label: t.home.allEvents }} />
        <ul className={sectionStyles.eventGrid}>{events.map((event) => <li key={event.slug}><EventCard event={event} locale={locale} t={t} /></li>)}</ul>
      </section>}
      {sections.news && home && <HomeNews articles={home.featuredArticles} locale={locale} t={t} />}
      {sections.videos && home && home.latestVideos.length > 0 && <section className="container" aria-labelledby="home-videos">
        <SectionHeading id="home-videos" title={t.home.videos} link={{ href: `/${locale}/videos`, label: t.home.allVideos }} />
        <ul className={contentGridStyles.grid}>{home.latestVideos.map((video) => <li key={video.slug}><VideoCard video={video} locale={locale} playLabel={t.videos.play} /></li>)}</ul>
      </section>}
      {sections.rankings && activeRanking && <HomeTopRankings lists={lists} active={activeRanking} locale={locale} t={t} />}
      {sections.sponsors && home && home.sponsors.length > 0 && <div className={sectionStyles.sponsorBand}>
        <section className="container" aria-labelledby="home-sponsors">
          <SectionHeading id="home-sponsors" title={t.home.sponsors} />
          <SponsorStrip sponsors={home.sponsors} locale={locale} />
        </section>
      </div>}
    </main>
  );
}
