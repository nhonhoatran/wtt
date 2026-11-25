import Link from 'next/link';
import type { PublicEventDetail, PublicSubEventSummary } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized } from '../../i18n/pick-localized';
import { SectionHeading } from '../common/section-heading';
import styles from './event-overview.module.css';

/** Where a sub-event leads: its draw, else its groups, else its entry list. */
function subEventLink(s: PublicSubEventSummary, base: string, o: Dictionary['event']['overview']) {
  if (s.drawKinds.length) return { href: `${base}/draws/${s.code}`, label: o.viewDraw };
  if (s.hasGroups) return { href: `${base}/groups/${s.code}`, label: o.viewGroups };
  if (s.entryCount) return { href: `${base}/players/${s.code}`, label: o.viewEntries };
  return null;
}

/** One card per event of the tournament: name, entry count, format and a link to the best view of it. */
export function SubEventCards({ event, locale, t }: { event: PublicEventDetail; locale: Locale; t: Dictionary }) {
  const o = t.event.overview;
  const base = `/${locale}/events/${event.slug}`;
  return (
    <section aria-labelledby="event-sub-events">
      <SectionHeading id="event-sub-events" title={format(o.subEvents, { n: event.subEvents.length })} />
      <ul className={styles.subEvents}>
        {event.subEvents.map((s) => {
          const name = pickLocalized(locale, s.name, s.nameEn);
          const link = subEventLink(s, base, o);
          const qualifying = s.drawKinds.includes('QUALIFYING');
          return (
            <li key={s.code} className={styles.subEvent}>
              <div className={styles.subEventHead}>
                <h3 className={styles.subEventName}>{name}</h3>
                {s.entryCount > 0 && <span className={styles.entryCount}>{format(s.competitorKind === 'DOUBLES' ? o.entriesDoubles : o.entriesSingles, { n: s.entryCount })}</span>}
              </div>
              <p className={styles.subEventFormat}>
                {o.formatLabel}: {o.formats[s.format]}
                {qualifying && ` (${o.withQualifying})`}
              </p>
              {link && (
                <Link href={link.href} className={styles.subEventLink}>
                  {link.label}
                  <span className="visually-hidden"> · {name}</span> <span aria-hidden="true">→</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
