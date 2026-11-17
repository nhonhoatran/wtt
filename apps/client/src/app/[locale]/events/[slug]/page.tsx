import type { Metadata } from 'next';
import Link from 'next/link';
import { EventShell } from '../../../../components/events/event-shell';
import styles from '../../../../components/events/event-overview.module.css';
import { sideClubs } from '../../../../components/matches/side-name';
import { SidePlayers } from '../../../../components/players/side-players';
import { format } from '../../../../i18n/get-dictionary';
import { pickLocalized } from '../../../../i18n/pick-localized';
import { loadEventPage } from '../../../../lib/event-page';
import { eventPageMetadata } from '../../../../lib/page-metadata';

interface OverviewProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: OverviewProps): Promise<Metadata> {
  const { locale, event } = await loadEventPage(params);
  return eventPageMetadata(locale, event, '');
}

export default async function EventOverviewPage({ params }: OverviewProps) {
  const { locale, event, t } = await loadEventPage(params);
  const o = t.event.overview;
  const subName = new Map(event.subEvents.map((s) => [s.code, pickLocalized(locale, s.name, s.nameEn)]));
  const base = `/${locale}/events/${event.slug}`;
  /** Where a sub-event's name links: its draw, else its groups, else its entry list. */
  const subHref = (s: (typeof event.subEvents)[number]) =>
    s.drawKinds.length ? `${base}/draws/${s.code}` : s.hasGroups ? `${base}/groups/${s.code}` : s.entryCount ? `${base}/players/${s.code}` : null;

  return (
    <EventShell event={event} locale={locale} t={t} active="overview">
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
    </EventShell>
  );
}
