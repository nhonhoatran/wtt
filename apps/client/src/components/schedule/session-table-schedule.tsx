import Link from 'next/link';
import type { PublicSchedule } from '@kamito/shared';
import { format, type Dictionary } from '../../i18n/get-dictionary';
import type { Locale } from '../../i18n/locales';
import { pickLocalized, pickLocalizedOrNull } from '../../i18n/pick-localized';
import { sideSourceLabel } from '../../i18n/render-bracket-labels';
import { formatDay, formatMatchTime } from '../../lib/format-date-time';
import { EmptyState } from '../common/empty-state';
import { ScrollRegion } from '../common/scroll-region';
import { LiveBadge } from '../common/live-badge';
import { matchStageLabel } from '../matches/match-card';
import { sideClubs } from '../matches/side-name';
import { SidePlayers } from '../players/side-players';
import { PrintScheduleButton } from './print-schedule-button';
import styles from './session-table-schedule.module.css';

/** The API groups and filters the schedule; this component only renders its public whitelist. */
export function SessionTableSchedule({ schedule, locale, t }: { schedule: PublicSchedule; locale: Locale; t: Dictionary }) {
  const eventName = pickLocalized(locale, schedule.event.name, schedule.event.nameEn);
  const zone = schedule.event.timezone;
  const hasMatches = schedule.sessions.some((session) => session.tables.some((table) => table.matches.length));
  return (
    <section className={styles.schedule} aria-label={t.schedule.title}>
      <div className={styles.toolbar}>
        <h2 className="section-title">{t.schedule.title}</h2>
        {hasMatches && <PrintScheduleButton label={t.schedule.print} />}
      </div>
      {hasMatches && <p className={styles.hint}>{t.schedule.printHint}</p>}
      {!hasMatches && <EmptyState text={t.schedule.empty} />}
      {schedule.sessions.flatMap((session) => {
        const sessionName = pickLocalizedOrNull(locale, session.name, session.nameEn) ?? session.code;
        const sessionLabel = `${formatDay(session.date, locale)} · ${sessionName}`;
        const when = `${formatMatchTime(session.startsAt, locale, zone)}${session.endsAt ? ` – ${formatMatchTime(session.endsAt, locale, zone)}` : ''}`;
        return session.tables.filter((table) => table.matches.length > 0).map((table) => {
          const tableLabel = table.displayName ?? format(t.schedule.tableCode, { code: table.code });
          return (
            <section className={styles.sheet} key={`${session.code}-${table.code}`} data-schedule-table={table.code}>
              <div className={styles.sheetHead}>
                <p className={styles.printEvent}>{eventName} · {t.schedule.title}</p>
                <h3>{sessionLabel}</h3>
                <p>{when} · {format(t.schedule.timezone, { timezone: zone })}</p>
                {session.venue && <p>{pickLocalized(locale, session.venue.name, session.venue.nameEn)}</p>}
                <h4>{tableLabel}</h4>
              </div>
              <ScrollRegion label={`${sessionLabel} · ${tableLabel}`}>
                <table className={styles.table}>
                  <caption className="visually-hidden">{`${eventName} · ${sessionLabel} · ${tableLabel}`}</caption>
                  <thead>
                    <tr className={styles.printContext}><th colSpan={4}>{eventName} · {sessionLabel} · {tableLabel} · {zone}</th></tr>
                    <tr><th scope="col">{t.schedule.time}</th><th scope="col">{t.schedule.match}</th><th scope="col">{t.schedule.players}</th><th scope="col">{t.schedule.status}</th></tr>
                  </thead>
                  <tbody>{table.matches.map((match) => (
                    <tr key={match.matchNo}>
                      <td className={styles.time}>{match.scheduledAt ? <time dateTime={match.scheduledAt}>{formatMatchTime(match.scheduledAt, locale, zone)}</time> : t.schedule.timePending}</td>
                      <td>
                        <Link className="text-link" href={`/${locale}/events/${schedule.event.slug}/matches/${match.matchNo}`}>{format(t.bracket.match, { matchNo: match.matchNo })}</Link>
                        <span className={styles.detail}>{pickLocalized(locale, match.subEvent.name, match.subEvent.nameEn)}</span>
                        <span className={styles.detail}>{matchStageLabel(match, t)}</span>
                      </td>
                      <td>{[match.side1, match.side2].map((side, i) => (
                        <div key={i} className={styles.side}>
                          <span className={match.winnerSide === i + 1 ? styles.winner : undefined}>{side ? <SidePlayers side={side} locale={locale} /> : sideSourceLabel(t.bracket, i === 0 ? match.side1Source : match.side2Source)}</span>
                          {side && sideClubs(side) && <span className={styles.detail}>{sideClubs(side)}</span>}
                        </div>
                      ))}</td>
                      <td>
                        {match.status === 'LIVE' ? <LiveBadge label={t.match.status.LIVE} variant="schedule" /> : <span>{t.match.status[match.status]}</span>}
                        {match.status !== 'SCHEDULED' && match.games1 !== null && match.games2 !== null && <strong className={styles.detail}>{match.games1}–{match.games2}</strong>}
                        {match.resultType && match.resultType !== 'NORMAL' && <span className={styles.detail}>{t.bracket.result[match.resultType]}</span>}
                        {match.voided && <span className={styles.detail}>{t.matches.voided}</span>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </ScrollRegion>
            </section>
          );
        });
      })}
    </section>
  );
}
