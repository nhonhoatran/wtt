import type { Metadata } from 'next';
import Link from 'next/link';
import { EventShell } from '../../../../components/events/event-shell';
import styles from '../../../../components/events/event-overview.module.css';
import { sideClubs } from '../../../../components/matches/side-name';
import { SidePlayers } from '../../../../components/players/side-players';
import { ArticleCard } from '../../../../components/content/article-card';
import { VideoCard } from '../../../../components/content/video-card';
import { SponsorStrip } from '../../../../components/content/sponsor-strip';
import { StructuredData } from '../../../../components/content/structured-data';
import contentStyles from '../../../../components/content/content.module.css';
import { format } from '../../../../i18n/get-dictionary';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { loadEventPage } from '../../../../lib/event-page';
import { eventPageMetadata } from '../../../../lib/page-metadata';
import { sportsEventStructuredData } from '../../../../lib/json-ld';
import { serverEnv } from '../../../../lib/server-env';
import { getEventContent } from '../../../../lib/public-data';

interface OverviewProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: OverviewProps): Promise<Metadata> {
  const { locale, event } = await loadEventPage(params);
  return eventPageMetadata(locale, event, '');
}

export default async function EventOverviewPage({ params }: OverviewProps) {
  const { locale, event, t } = await loadEventPage(params);
  const content = await getEventContent(event.slug);
  const eventUrl = new URL(`/${locale}/events/${event.slug}`, serverEnv.publicSiteUrl()).toString();
  const o = t.event.overview;
  const subName = new Map(event.subEvents.map((s) => [s.code, pickLocalized(locale, s.name, s.nameEn)]));
  const base = `/${locale}/events/${event.slug}`;
  /** Where a sub-event's name links: its draw, else its groups, else its entry list. */
  const subHref = (s: (typeof event.subEvents)[number]) =>
    s.drawKinds.length ? `${base}/draws/${s.code}` : s.hasGroups ? `${base}/groups/${s.code}` : s.entryCount ? `${base}/players/${s.code}` : null;

  return (
    <EventShell event={event} locale={locale} t={t} active="overview">
      <StructuredData value={sportsEventStructuredData(event, locale, eventUrl)} />
      {event.champions.length > 0 && (
        <section aria-labelledby="champions">
          <h2 id="champions" className="section-title">
            {o.champions}
          </h2>
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

      <section aria-labelledby="facts">
        <h2 id="facts" className="section-title">
          {o.stats}
        </h2>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>{o.players}</dt>
            <dd>{event.stats.players}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{o.playedMatches}</dt>
            <dd>{event.stats.playedMatches}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{o.subEvents}</dt>
            <dd>{event.subEvents.length}</dd>
          </div>
        </dl>
      </section>

      {event.subEvents.length > 0 && (
      <section aria-labelledby="sub-events">
        <h2 id="sub-events" className="section-title">
          {o.subEvents}
        </h2>
          <ul className={styles.subEvents}>
            {event.subEvents.map((s) => {
              const href = subHref(s);
              const name = pickLocalized(locale, s.name, s.nameEn);
              return (
                <li key={s.code} className={styles.subEvent}>
                  {href ? <Link href={href}>{name}</Link> : <span>{name}</span>}
                  <span className={styles.club}>{format(o.entries, { n: s.entryCount })}</span>
                </li>
              );
            })}
          </ul>
      </section>
      )}

      {content?.articles.length ? <section aria-labelledby="event-news"><h2 id="event-news" className="section-title">{locale === 'vi' ? 'Tin tức giải' : 'Tournament news'}</h2><ul className={contentStyles.grid}>{content.articles.map((article) => <li key={article.slug}><ArticleCard article={article} locale={locale} /></li>)}</ul></section> : null}
      {content?.videos.length ? <section aria-labelledby="event-videos"><h2 id="event-videos" className="section-title">{locale === 'vi' ? 'Video giải' : 'Tournament videos'}</h2><ul className={contentStyles.grid}>{content.videos.map((video) => <li key={video.slug}><VideoCard video={video} locale={locale} playLabel={t.videos.play} /></li>)}</ul></section> : null}
      {content?.sponsors.length ? <section aria-labelledby="event-sponsors"><h2 id="event-sponsors" className="section-title">{t.home.sponsors}</h2><SponsorStrip sponsors={content.sponsors} locale={locale} /></section> : null}
    </EventShell>
  );
}
