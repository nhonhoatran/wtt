import type { Metadata } from 'next';
import { contentSettings, todayInTimezone, type PublicMatchCard } from '@kamito/shared';
import { SectionHeading } from '../../../../components/common/section-heading';
import { ArticleCard } from '../../../../components/content/article-card';
import { StructuredData } from '../../../../components/content/structured-data';
import { VideoCard } from '../../../../components/content/video-card';
import contentStyles from '../../../../components/content/content.module.css';
import { EventDaysSchedule } from '../../../../components/events/event-days-schedule';
import { EventLiveMatches } from '../../../../components/events/event-live-matches';
import { EventQuickInfo } from '../../../../components/events/event-quick-info';
import { EventShell } from '../../../../components/events/event-shell';
import { EventSponsorsCard } from '../../../../components/events/event-sponsors-card';
import { SubEventCards } from '../../../../components/events/sub-event-cards';
import styles from '../../../../components/events/event-overview.module.css';
import { sideClubs } from '../../../../components/matches/side-name';
import { SidePlayers } from '../../../../components/players/side-players';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { loadEventPage } from '../../../../lib/event-page';
import { eventPageMetadata } from '../../../../lib/page-metadata';
import { sportsEventStructuredData } from '../../../../lib/json-ld';
import { getEventContent, getHomeContent, getMatches } from '../../../../lib/public-data';
import { serverEnv } from '../../../../lib/server-env';

interface OverviewProps {
  params: Promise<{ locale: string; slug: string }>;
}

const NO_MATCHES: PublicMatchCard[] = [];

export async function generateMetadata({ params }: OverviewProps): Promise<Metadata> {
  const { locale, event } = await loadEventPage(params);
  return eventPageMetadata(locale, event, '');
}

export default async function EventOverviewPage({ params }: OverviewProps) {
  const { locale, event, t } = await loadEventPage(params);
  // Same query strings as the matches tab, so both pages share one cache entry per state; a finished event has no live or upcoming matches.
  const wantMatches = event.tabs.matches && event.lifecycle !== 'COMPLETED';
  const [content, home, live, upcoming] = await Promise.all([
    getEventContent(event.slug),
    wantMatches ? getHomeContent().catch(() => null) : null,
    wantMatches ? getMatches(event.slug, '?state=live', false).catch(() => null) : null,
    wantMatches ? getMatches(event.slug, '?state=upcoming', false).catch(() => null) : null,
  ]);
  const limit = home?.itemsPerSection ?? contentSettings.homeItemsPerSection.defaultValue;
  const matches = [...(live?.items ?? NO_MATCHES), ...(upcoming?.items ?? NO_MATCHES)].slice(0, limit);

  const eventUrl = new URL(`/${locale}/events/${event.slug}`, serverEnv.publicSiteUrl()).toString();
  const subName = new Map(event.subEvents.map((s) => [s.code, pickLocalized(locale, s.name, s.nameEn)]));
  const today = todayInTimezone(event.timezone);
  const o = t.event.overview;

  return (
    <EventShell event={event} locale={locale} t={t} active="overview">
      <StructuredData value={sportsEventStructuredData(event, locale, eventUrl)} />
      <div className={styles.layout}>
        <div className={styles.main}>
          {event.champions.length > 0 && (
            <section aria-labelledby="champions">
              <SectionHeading id="champions" title={o.champions} />
              <ul className={styles.champions}>
                {event.champions.map((c) => (
                  <li key={c.subEventCode} className={styles.champion}>
                    <span className={styles.championSub}>{subName.get(c.subEventCode) ?? c.subEventCode}</span>
                    <strong className={styles.championName}><SidePlayers side={c.side} locale={locale} /></strong>
                    {sideClubs(c.side) && <span className={styles.club}>{sideClubs(c.side)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {matches.length > 0 && <EventLiveMatches event={event} matches={matches} locale={locale} t={t} />}
          {event.subEvents.length > 0 && <SubEventCards event={event} locale={locale} t={t} />}
          {content && content.articles.length > 0 && (
            <section aria-labelledby="event-news">
              <SectionHeading id="event-news" title={o.news} />
              <ul className={contentStyles.grid}>{content.articles.map((article) => <li key={article.slug}><ArticleCard article={article} locale={locale} /></li>)}</ul>
            </section>
          )}
          {content && content.videos.length > 0 && (
            <section aria-labelledby="event-videos">
              <SectionHeading id="event-videos" title={o.videos} />
              <ul className={contentStyles.grid}>{content.videos.map((video) => <li key={video.slug}><VideoCard video={video} locale={locale} playLabel={t.videos.play} /></li>)}</ul>
            </section>
          )}
        </div>
        <aside className={styles.aside}>
          <EventQuickInfo event={event} locale={locale} t={t} />
          <EventDaysSchedule event={event} today={today} locale={locale} t={t} />
          <EventSponsorsCard sponsors={content?.sponsors ?? []} locale={locale} t={t} />
        </aside>
      </div>
    </EventShell>
  );
}
